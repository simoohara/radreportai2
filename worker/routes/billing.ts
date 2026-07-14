import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { isAuthenticated } from '../middleware/auth';

const app = new Hono<HonoEnv>();

// Billing routes will be fully implemented in Phase 8.
// Placeholder structure is here so the app compiles.

/**
 * POST /api/billing/create-checkout-session
 */
app.post('/billing/create-checkout-session', isAuthenticated, async (c) => {
  // TODO: Phase 8
  return c.json({ error: 'Not yet implemented' }, 501);
});

/**
 * GET /api/billing/manage-url
 */
app.get('/billing/manage-url', isAuthenticated, async (c) => {
  // TODO: Phase 8
  return c.json({ error: 'Not yet implemented' }, 501);
});

export default app;
