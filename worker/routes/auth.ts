import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { jwtVerify, SignJWT } from 'jose';
import type { HonoEnv, User } from '../types';
import { signToken, createSession } from '../middleware/auth';
import { sendFacebookEvent, sendGAEvent } from '../services/analytics';
import { sendNewUserAlert } from '../services/telegram';
import { authLimiter } from '../middleware/rateLimit';

const app = new Hono<HonoEnv>();
const encoder = new TextEncoder();
const OAUTH_STATE_COOKIE = 'oauth_state';

async function createOAuthState(referralCode: string | undefined, secret: string): Promise<string> {
  return new SignJWT(referralCode ? { referralCode } : {})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .setJti(crypto.randomUUID())
    .sign(encoder.encode(secret));
}

async function readOAuthState(state: string, secret: string): Promise<string | null> {
  const { payload } = await jwtVerify(state, encoder.encode(secret));
  return typeof payload.referralCode === 'string' ? payload.referralCode : null;
}

/**
 * Step 1: Redirect user to Google OAuth consent screen.
 */
app.get('/google', async (c) => {
  const referralCode = c.req.query('ref')?.trim().slice(0, 255);
  const state = await createOAuthState(referralCode, c.env.SESSION_SECRET);
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/auth/google/callback',
    maxAge: 10 * 60,
  });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.APP_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  params.set('state', state);

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/**
 * Step 2: Handle the Google OAuth callback.
 * Exchange the authorization code for tokens, fetch user profile,
 * upsert in D1, create session, sign JWT, redirect to frontend.
 */
app.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const savedState = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/auth/google/callback' });

  if (!code || !state || !savedState || state !== savedState) {
    return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
  }

  let referralCode: string | null = null;
  try {
    referralCode = await readOAuthState(state, c.env.SESSION_SECRET);
  } catch {
    return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${c.env.APP_URL}/auth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', await tokenResponse.text());
      return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // Fetch user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      console.error('Google profile fetch failed:', await profileResponse.text());
      return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
    }

    const profile = await profileResponse.json() as {
      id: string;
      email: string;
      name: string;
    };

    // Upsert user
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE google_id = ? OR email = ?'
    )
      .bind(profile.id, profile.email)
      .first<User>();

    if (!user) {
      // Create new user
      // Handle referral
      let referrerId: number | null = null;
      if (referralCode) {
        const referrer = await c.env.DB.prepare(
          'SELECT id FROM users WHERE referral_code = ?'
        )
          .bind(referralCode)
          .first<{ id: number }>();
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      // Generate a unique referral code
      const newReferralCode = crypto.randomUUID().replace(/-/g, '').substring(0, 12);

      await c.env.DB.prepare(
        `INSERT INTO users (google_id, email, display_name, generations_remaining, referrer_id, referral_code)
         VALUES (?, ?, ?, 20, ?, ?)`
      )
        .bind(profile.id, profile.email, profile.name, referrerId, newReferralCode)
        .run();

      user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE email = ?'
      )
        .bind(profile.email)
        .first<User>();

      if (!user) {
        return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
      }

      console.log(`New user created: ${profile.name} (${profile.email})`);

      // Fire-and-forget: analytics & notifications
      c.executionCtx.waitUntil(
        Promise.all([
          sendFacebookEvent(c.env, 'CompleteRegistration', { email: profile.email }, {}, c.req.url),
          sendGAEvent(c.env, 'sign_up', { method: 'Google' }, user.id),
          sendNewUserAlert(c.env, user),
        ])
      );

    } else {
      // Existing user — update if needed
      const updates: string[] = [];
      const params: (string | null)[] = [];

      // Reactivate if soft-deleted
      if (user.deleted_at) {
        updates.push('deleted_at = NULL');
        console.log(`Reactivating soft-deleted account for ${profile.name} (${profile.email})`);
      }

      // Link Google ID if missing (magic link user signing in with Google)
      if (!user.google_id) {
        updates.push('google_id = ?');
        params.push(profile.id);
      }

      if (updates.length > 0) {
        params.push(String(user.id));
        await c.env.DB.prepare(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
        )
          .bind(...params)
          .run();

        // Re-fetch updated user
        user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
          .bind(user.id)
          .first<User>();
      }

      console.log(`User logged in: ${profile.name} (${profile.email})`);
    }

    if (!user) {
      return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
    }

    // Create session and sign JWT
    const userAgent = c.req.header('User-Agent') || null;
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const sessionId = await createSession(
      c.env.DB,
      user.id,
      user.subscription_plan,
      userAgent,
      ip
    );

    const token = await signToken(
      { id: user.id, email: user.email, sessionId },
      c.env.SESSION_SECRET
    );

    return c.redirect(`${c.env.APP_URL}/?token=${token}`);

  } catch (err) {
    console.error('Google OAuth error:', err);
    return c.redirect(`${c.env.APP_URL}/?error=login_failed`);
  }
});

/**
 * Magic Link: Request a login link via email.
 */
app.post('/magiclink', authLimiter, async (c) => {
  const body = await c.req.json<{ email: string, ref?: string }>();
  const email = body.email?.toLowerCase()?.trim();
  const referralCode = body.ref?.trim().slice(0, 255);

  if (!email || !email.includes('@')) {
    return c.json({ error: 'Adresse email invalide.' }, 400);
  }

  if (!c.env.RESEND_API) {
    console.error('Magic link delivery is unavailable: RESEND_API is not configured.');
    return c.json({ error: 'L’envoi des liens de connexion n’est pas encore configuré.' }, 503);
  }

  try {
    // Find or create user
    let user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<User>();

    if (!user) {
      // Create new user with magic link
      let referrerId: number | null = null;
      if (referralCode) {
        const referrer = await c.env.DB.prepare('SELECT id FROM users WHERE referral_code = ?')
          .bind(referralCode)
          .first<{ id: number }>();
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      const newReferralCode = crypto.randomUUID().replace(/-/g, '').substring(0, 12);

      await c.env.DB.prepare(
        `INSERT INTO users (email, display_name, generations_remaining, referrer_id, referral_code)
         VALUES (?, ?, 20, ?, ?)`
      )
        .bind(email, email.split('@')[0], referrerId, newReferralCode)
        .run();

      user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
        .bind(email)
        .first<User>();

      if (user) {
        c.executionCtx.waitUntil(
          Promise.all([
            sendFacebookEvent(c.env, 'CompleteRegistration', { email }, {}, c.req.url),
            sendGAEvent(c.env, 'sign_up', { method: 'MagicLink' }, user.id),
            sendNewUserAlert(c.env, user),
          ])
        );
      }
    }

    if (!user) {
      return c.json({ error: 'Erreur lors de la création du compte.' }, 500);
    }

    // If soft-deleted, reactivate
    if (user.deleted_at) {
      await c.env.DB.prepare('UPDATE users SET deleted_at = NULL WHERE id = ?')
        .bind(user.id)
        .run();
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await c.env.DB.prepare(
      'INSERT INTO magic_link_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    )
      .bind(user.id, token, expiresAt)
      .run();

    // Auth routes are mounted at /auth (not /api/auth) in worker/index.ts.
    const magicLinkUrl = `${c.env.APP_URL}/auth/magiclink/verify?token=${token}`;

    // Send the link through Resend. Do not claim success if the provider rejects it.
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.RESEND_API}`,
      },
      body: JSON.stringify({
        from: 'Dr. Rad <contact@radreportai.com>',
        to: email,
        subject: 'Votre lien de connexion à Rad Report AI',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Connexion à Rad Report AI</h2>
              <p>Cliquez sur le bouton ci-dessous pour vous connecter :</p>
              <a href="${magicLinkUrl}" style="display: inline-block; padding: 12px 24px; background: #6C63FF; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Se connecter
              </a>
              <p style="color: #666; font-size: 14px; margin-top: 24px;">Ce lien expire dans 15 minutes.</p>
            </div>
          `,
      }),
    });

    if (!emailResponse.ok) {
      console.error('Magic link email delivery failed:', await emailResponse.text());
      return c.json({ error: 'Impossible d’envoyer le lien de connexion. Réessayez plus tard.' }, 502);
    }

    return c.json({ message: 'Lien de connexion envoyé. Vérifiez votre boîte de réception.' });

  } catch (err) {
    console.error('Magic link error:', err);
    return c.json({ error: 'Erreur lors de l\'envoi du lien.' }, 500);
  }
});

/**
 * Magic Link: Verify the token and log the user in.
 */
app.get('/magiclink/verify', async (c) => {
  const token = c.req.query('token');
  const clientErrorUrl = `${c.env.APP_URL}/?error=invalid_link`;

  if (!token) {
    return c.redirect(clientErrorUrl);
  }

  try {
    const record = await c.env.DB.prepare(
      'SELECT * FROM magic_link_tokens WHERE token = ?'
    )
      .bind(token)
      .first<{ id: number; user_id: number; expires_at: string; used_at: string | null }>();

    if (!record) {
      return c.redirect(clientErrorUrl);
    }

    // Check if already used
    if (record.used_at) {
      return c.redirect(`${c.env.APP_URL}/?error=link_used`);
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return c.redirect(`${c.env.APP_URL}/?error=link_expired`);
    }

    // Mark as used
    await c.env.DB.prepare(
      'UPDATE magic_link_tokens SET used_at = datetime(\'now\') WHERE id = ?'
    )
      .bind(record.id)
      .run();

    // Fetch user
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(record.user_id)
      .first<User>();

    if (!user) {
      return c.redirect(clientErrorUrl);
    }

    // Create session
    const userAgent = c.req.header('User-Agent') || null;
    const ip = c.req.header('CF-Connecting-IP') || null;
    const sessionId = await createSession(
      c.env.DB,
      user.id,
      user.subscription_plan,
      userAgent,
      ip
    );

    const jwtToken = await signToken(
      { id: user.id, email: user.email, sessionId },
      c.env.SESSION_SECRET
    );

    return c.redirect(`${c.env.APP_URL}/?token=${jwtToken}`);

  } catch (err) {
    console.error('Magic link verification error:', err);
    return c.redirect(clientErrorUrl);
  }
});

/**
 * Logout: Delete the current session.
 */
app.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Logged out' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const { verifyToken } = await import('../middleware/auth');
    const decoded = await verifyToken(token, c.env.SESSION_SECRET);

    if (decoded.sessionId) {
      await c.env.DB.prepare(
        'DELETE FROM active_sessions WHERE session_id = ?'
      )
        .bind(decoded.sessionId)
        .run();
    }
  } catch {
    // Token invalid, but that's fine for logout
  }

  return c.json({ message: 'Logged out' });
});

export default app;
