import type { Context, Next } from 'hono';
import { checkRateLimit } from '../services/rateLimit';
import type { HonoEnv } from '../types';

/**
 * Factory for creating D1-backed rate limiting middleware.
 * @param prefix Prefix for the key (e.g., 'auth', 'billing')
 * @param limit Max requests per window
 * @param windowSeconds Window length in seconds
 * @param keyFn Function to extract the unique key from the request (e.g., IP or user ID)
 */
export function createRateLimiter(
  prefix: string,
  limit: number,
  windowSeconds: number,
  keyFn: (c: Context<HonoEnv>) => string
) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const rawKey = keyFn(c);
    if (!rawKey) {
      // If we can't extract a key (e.g., no IP or no user), we might just pass through or block.
      // Usually, we pass through and let auth middleware block if unauthorized.
      return next();
    }

    const key = `${prefix}:${rawKey}`;
    const result = await checkRateLimit(c.env.DB, key, limit, windowSeconds);

    // Set standard RateLimit headers
    c.header('RateLimit-Limit', String(result.limit));
    c.header('RateLimit-Remaining', String(result.remaining));
    c.header('RateLimit-Reset', String(Math.ceil(result.reset / 1000)));

    if (!result.success) {
      return c.json({ error: 'Trop de requêtes. Veuillez réessayer plus tard.' }, 429);
    }

    return next();
  };
}

/**
 * Auth Rate Limiter: Max 5 requests per 15 minutes per IP.
 */
export const authLimiter = createRateLimiter(
  'auth:ip',
  5,
  15 * 60,
  (c) => c.req.header('cf-connecting-ip') || 'unknown'
);

/**
 * Billing Rate Limiter: Max 5 requests per 5 minutes per user.
 */
export const billingLimiter = createRateLimiter(
  'billing:user',
  5,
  5 * 60,
  (c) => {
    const user = c.get('user');
    return user ? String(user.id) : 'anonymous';
  }
);
