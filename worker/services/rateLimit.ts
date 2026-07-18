import type { D1Database } from '@cloudflare/workers-types';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Checks and increments the rate limit counter for a specific key in the D1 database.
 * If the limit is exceeded, returns success: false.
 * 
 * @param db The D1 Database binding
 * @param key Unique identifier (e.g., 'auth:ip:192.168.1.1' or 'billing:user:123')
 * @param limit Maximum number of requests allowed in the window
 * @param windowSeconds Duration of the rate limit window in seconds
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const expiresAt = new Date(now + windowSeconds * 1000).toISOString();
  const nowISO = new Date(now).toISOString();

  // Try to insert a new record or increment if it exists
  // If it exists but is expired, reset the hits to 1 and update expires_at
  const stmt = await db.prepare(`
    INSERT INTO rate_limits (id, route, hits, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET 
      hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN ? ELSE expires_at END
    RETURNING hits, expires_at
  `)
  .bind(key, key.split(':')[0], expiresAt, nowISO, nowISO, expiresAt)
  .first<{ hits: number, expires_at: string }>();

  // Async cleanup of globally expired limits (fire and forget happens in middleware usually, but we do it quickly here)
  db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(nowISO).run().catch(() => {});

  if (!stmt) {
    // Fallback if something weird happens
    return { success: true, limit, remaining: limit - 1, reset: now + windowSeconds * 1000 };
  }

  const resetTime = new Date(stmt.expires_at).getTime();
  
  if (stmt.hits > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetTime
    };
  }

  return {
    success: true,
    limit,
    remaining: limit - stmt.hits,
    reset: resetTime
  };
}
