import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { isAuthenticated } from '../middleware/auth';

const app = new Hono<HonoEnv>();

/**
 * GET /api/me — Return the current authenticated user's data.
 */
app.get('/me', isAuthenticated, (c) => {
  const user = c.get('user');
  // Don't expose sensitive fields
  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    created_at: user.created_at,
    generations_used: user.generations_used,
    generations_remaining: user.generations_remaining,
    subscription_plan: user.subscription_plan,
    subscription_expires_at: user.subscription_expires_at,
    lemonsqueezy_subscription_id: user.lemonsqueezy_subscription_id,
    referral_code: user.referral_code,
    referral_points: user.referral_points,
    custom_keywords: user.custom_keywords,
  });
});

/**
 * PUT /api/me/profile — Update display name.
 */
app.put('/me/profile', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ display_name?: string }>();

  if (!body.display_name || body.display_name.trim().length === 0) {
    return c.json({ error: 'Le nom ne peut pas être vide.' }, 400);
  }

  const displayName = body.display_name.trim().substring(0, 255);

  await c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?')
    .bind(displayName, user.id)
    .run();

  return c.json({ display_name: displayName });
});

/**
 * PUT /api/me/keywords — Update custom transcription keywords.
 */
app.put('/me/keywords', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ custom_keywords?: string | null }>();

  // Allow null/empty to clear keywords; otherwise trim and cap at 5000 chars
  const keywords = body.custom_keywords?.trim() || null;
  const safeKeywords = keywords ? keywords.substring(0, 5000) : null;

  await c.env.DB.prepare('UPDATE users SET custom_keywords = ? WHERE id = ?')
    .bind(safeKeywords, user.id)
    .run();

  return c.json({ custom_keywords: safeKeywords });
});

/**
 * DELETE /api/me — Permanently delete the account and its user-owned data.
 */
app.delete('/me', isAuthenticated, async (c) => {
  const user = c.get('user');
  // Deleting the user cascades to templates, feedback, sessions and magic-link tokens.
  // This matches the irreversible deletion promise in the settings interface.
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

  return c.json({ message: 'Account deleted' });
});

export default app;
