import { Hono } from 'hono';
import { HonoEnv } from '../types';

const app = new Hono<HonoEnv>();

/**
 * GET /api/config — Return public configuration (analytics IDs).
 * This route is NOT authenticated — it's called before login.
 */
app.get('/config', (c) => {
  return c.json({
    facebookPixelId: c.env.FACEBOOK_PIXEL_ID || null,
    gaMeasurementId: c.env.GA_MEASUREMENT_ID || null,
  });
});

export default app;
