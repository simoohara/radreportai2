import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { HonoEnv } from './types';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import templateRoutes from './routes/templates';
import aiRoutes from './routes/ai';
import configRoutes from './routes/config';
import feedbackRoutes from './routes/feedback';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhooks';
import { processAutomatedEmails } from './services/marketing';

const app = new Hono<HonoEnv>();

// CORS — allow frontend origins
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://app.radreportai.com',
        'https://radreportai2.simoohara.workers.dev',
      ];
      return allowed.includes(origin) ? origin : '';
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { bodyLimit } from 'hono/body-limit';

// Standard 1MB limit for most routes to prevent DoS
const standardLimit = bodyLimit({
  maxSize: 1 * 1024 * 1024, // 1MB
  onError: (c) => c.json({ error: 'Payload Too Large' }, 413),
});

// Apply 1MB limit to standard routes
app.use('/auth/*', standardLimit);
// We can't apply it to /api/* directly because /api/transcribe needs 10MB.
// Apply to specific prefixes or apply 1MB inside individual routers.
// Actually, it's safer to just apply standardLimit to specific API sub-routes here.
app.use('/api/templates/*', standardLimit);
app.use('/api/feedback/*', standardLimit);
app.use('/api/billing/*', standardLimit);
app.use('/api/admin/*', standardLimit);
app.use('/api/webhooks/*', standardLimit);
app.use('/api/config/*', standardLimit);

// Mount routes
app.route('/auth', authRoutes);
app.route('/api', userRoutes);
app.route('/api', templateRoutes);
app.route('/api', aiRoutes);
app.route('/api', configRoutes);
app.route('/api', feedbackRoutes);
app.route('/api', billingRoutes);
app.route('/api', adminRoutes);
app.route('/api', webhookRoutes);

// Catch-all: API routes get 404, frontend routes get index.html (SPA)
app.notFound(async (c) => {
  const path = c.req.path;
  if (path.startsWith('/api/') || path.startsWith('/auth/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Serve the SPA index.html
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export const honoApp = app;

export default {
  fetch: app.fetch,
  scheduled: async (_event: any, env: HonoEnv['Bindings'], ctx: any) => {
    ctx.waitUntil(processAutomatedEmails(env));
  }
};
