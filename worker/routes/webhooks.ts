import { Hono } from 'hono';
import type { HonoEnv } from '../types';

const app = new Hono<HonoEnv>();

// Webhook routes will be fully implemented in Phase 8.

/**
 * POST /api/webhooks/lemonsqueezy — Handle LemonSqueezy subscription webhooks.
 */
app.post('/webhooks/lemonsqueezy', async (c) => {
  // TODO: Phase 8 — HMAC validation, subscription processing
  return c.json({ message: 'Not yet implemented' }, 501);
});

export default app;
