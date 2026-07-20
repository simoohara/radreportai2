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
