import { Context, Next } from 'hono';
import { jwtVerify, SignJWT } from 'jose';
import { HonoEnv, User } from '../types';

const encoder = new TextEncoder();

export async function signToken(
  payload: { id: number; email: string; sessionId: string },
  secret: string
): Promise<string> {
  const key = encoder.encode(secret);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ id: number; email: string; sessionId: string }> {
  const key = encoder.encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as { id: number; email: string; sessionId: string };
}

/**
 * Creates a new session for the user, enforcing session limits per plan.
 * Returns the new session ID.
 */
export async function createSession(
  db: D1Database,
  userId: number,
  subscriptionPlan: string | null,
  userAgent: string | null,
  ipAddress: string | null
): Promise<string> {
  // Session limits per plan
  const sessionLimits: Record<string, number> = {
    'Standard': 1,
    'Pro': 2,
    'Elite': 5,
  };
  const maxSessions = subscriptionPlan ? (sessionLimits[subscriptionPlan] || 1) : 1;

  // Generate a unique session ID
  const sessionId = crypto.randomUUID();

  // Get existing sessions ordered by creation date (oldest first)
  const existingSessions = await db.prepare(
    'SELECT id FROM active_sessions WHERE user_id = ? ORDER BY created_at ASC'
  )
    .bind(userId)
    .all();

  const sessionsToDelete: string[] = [];
  if (existingSessions.results.length >= maxSessions) {
    // Delete oldest sessions to make room
    const excess = existingSessions.results.length - maxSessions + 1;
    for (let i = 0; i < excess; i++) {
      sessionsToDelete.push(
        String(existingSessions.results[i].id)
      );
    }
  }

  // Batch: delete old sessions + insert new one
  const statements: D1PreparedStatement[] = [];

  for (const sessionDbId of sessionsToDelete) {
    statements.push(
      db.prepare('DELETE FROM active_sessions WHERE id = ?').bind(sessionDbId)
    );
  }

  statements.push(
    db.prepare(
      'INSERT INTO active_sessions (session_id, user_id, user_agent, ip_address) VALUES (?, ?, ?, ?)'
    ).bind(sessionId, userId, userAgent, ipAddress)
  );

  await db.batch(statements);

  return sessionId;
}

/**
 * Middleware: Verify JWT token and load user from D1.
 */
export async function isAuthenticated(c: Context<HonoEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'User not authenticated' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await verifyToken(token, c.env.SESSION_SECRET);

    if (!decoded.sessionId) {
      return c.json({ error: 'Token is missing session identifier.' }, 401);
    }

    // Verify session exists
    const session = await c.env.DB.prepare(
      'SELECT 1 FROM active_sessions WHERE session_id = ? AND user_id = ?'
    )
      .bind(decoded.sessionId, decoded.id)
      .first();

    if (!session) {
      return c.json({ error: 'Session terminated' }, 401);
    }

    // Fetch user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    )
      .bind(decoded.id)
      .first<User>();

    if (!user || user.deleted_at) {
      await c.env.DB.prepare(
        'DELETE FROM active_sessions WHERE session_id = ?'
      )
        .bind(decoded.sessionId)
        .run();
      return c.json({ error: 'User not found or account is deactivated' }, 401);
    }

    c.set('user', user);
    c.set('sessionId', decoded.sessionId);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

/**
 * Middleware: Require admin role (must be used after isAuthenticated).
 */
export async function isAdmin(c: Context<HonoEnv>, next: Next) {
  const user = c.get('user');
  if (user && user.role === 'admin') {
    await next();
  } else {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
}
