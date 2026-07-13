import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HonoEnv } from './types';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import templateRoutes from './routes/templates';
import aiRoutes from './routes/ai';
import configRoutes from './routes/config';
import feedbackRoutes from './routes/feedback';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';
import webhookRoutes from './routes/webhooks';

const app = new Hono<HonoEnv>();

// CORS — allow frontend origins
app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        // Add production domains when deploying:
        // 'https://radreportai2.pages.dev',
        // 'https://app.radreportai.com',
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

// 404 catch-all for API routes
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
