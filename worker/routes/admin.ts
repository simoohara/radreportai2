import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const app = new Hono<HonoEnv>();

/**
 * GET /api/admin/stats — Dashboard stats (admin only).
 */
app.get('/admin/stats', isAuthenticated, isAdmin, async (c) => {
  const db = c.env.DB;

  const totalUsers = await db.prepare("SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL").first<{ count: number }>();
  const activeSubscribers = await db.prepare("SELECT COUNT(*) as count FROM users WHERE subscription_plan IS NOT NULL AND deleted_at IS NULL").first<{ count: number }>();
  const totalTemplates = await db.prepare("SELECT COUNT(*) as count FROM templates").first<{ count: number }>();
  const totalGenerations = await db.prepare("SELECT COALESCE(SUM(generations_used), 0) as total FROM users").first<{ total: number }>();
  const feedbackNew = await db.prepare("SELECT COUNT(*) as count FROM feedback WHERE status = 'new' AND is_archived = 0").first<{ count: number }>();
  const feedbackInProgress = await db.prepare("SELECT COUNT(*) as count FROM feedback WHERE status = 'in_progress' AND is_archived = 0").first<{ count: number }>();
  const feedbackResolved = await db.prepare("SELECT COUNT(*) as count FROM feedback WHERE status = 'resolved' AND is_archived = 0").first<{ count: number }>();

  return c.json({
    totalUsers: totalUsers?.count ?? 0,
    activeSubscribers: activeSubscribers?.count ?? 0,
    totalTemplates: totalTemplates?.count ?? 0,
    totalGenerations: totalGenerations?.total ?? 0,
    feedback: {
      new: feedbackNew?.count ?? 0,
      in_progress: feedbackInProgress?.count ?? 0,
      resolved: feedbackResolved?.count ?? 0,
    },
  });
});

/**
 * GET /api/admin/feedback — List all feedback (admin only).
 */
app.get('/admin/feedback', isAuthenticated, isAdmin, async (c) => {
  const includeArchived = c.req.query('includeArchived') === 'true';

  const query = includeArchived
    ? `SELECT f.*, u.display_name, u.email FROM feedback f
       JOIN users u ON f.user_id = u.id
       ORDER BY f.created_at DESC`
    : `SELECT f.*, u.display_name, u.email FROM feedback f
       JOIN users u ON f.user_id = u.id
       WHERE f.is_archived = 0
       ORDER BY f.created_at DESC`;

  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
});

/**
 * PUT /api/admin/feedback/:id/status — Update feedback status (admin only).
 */
app.put('/admin/feedback/:id/status', isAuthenticated, isAdmin, async (c) => {
  const feedbackId = c.req.param('id');
  const body = await c.req.json<{ status: string }>();

  const validStatuses = ['new', 'in_progress', 'resolved'];
  if (!body.status || !validStatuses.includes(body.status)) {
    return c.json({ error: 'Statut invalide.' }, 400);
  }

  await c.env.DB.prepare('UPDATE feedback SET status = ? WHERE id = ?')
    .bind(body.status, feedbackId)
    .run();

  return c.json({ message: 'Statut mis à jour.' });
});

/**
 * PUT /api/admin/feedback/:id/archive — Toggle archive (admin only).
 */
app.put('/admin/feedback/:id/archive', isAuthenticated, isAdmin, async (c) => {
  const feedbackId = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT is_archived FROM feedback WHERE id = ?')
    .bind(feedbackId)
    .first<{ is_archived: number }>();

  if (!existing) {
    return c.json({ error: 'Feedback non trouvé.' }, 404);
  }

  const newValue = existing.is_archived ? 0 : 1;
  await c.env.DB.prepare('UPDATE feedback SET is_archived = ? WHERE id = ?')
    .bind(newValue, feedbackId)
    .run();

  return c.json({ is_archived: newValue === 1 });
});

/**
 * GET /api/admin/users — List all users (admin only).
 */
app.get('/admin/users', isAuthenticated, isAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, email, display_name, role, created_at, generations_used, generations_remaining, transcriptions_used, transcriptions_remaining,
            subscription_plan, subscription_expires_at, referral_code, referral_points, deleted_at
     FROM users ORDER BY created_at DESC`
  ).all();
  return c.json(results);
});

/**
 * PUT /api/admin/users/:id/subscription — Update a user's subscription (admin only).
 */
app.put('/admin/users/:id/subscription', isAuthenticated, isAdmin, async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json<{ subscription_plan?: string; subscription_expires_at?: string; role?: 'user' | 'admin' }>();

  const validPlans = [null, 'Standard', 'Pro', 'Elite'];
  if (body.subscription_plan !== null && body.subscription_plan !== undefined && !validPlans.includes(body.subscription_plan)) {
    return c.json({ error: 'Forfait invalide.' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first<{ id: number }>();
  if (!existing) {
    return c.json({ error: 'Utilisateur non trouvé.' }, 404);
  }

  let quota: number | null = 20; // Default for null (free)
  if (body.subscription_plan === 'Standard') quota = 1000;
  if (body.subscription_plan === 'Pro') quota = 2000;
  if (body.subscription_plan === 'Elite') quota = null;

  const transcriptionQuota = body.subscription_plan ? null : 50;

  if (body.role && ['admin', 'user'].includes(body.role)) {
    await c.env.DB.prepare(
      'UPDATE users SET subscription_plan = ?, subscription_expires_at = ?, role = ?, generations_remaining = ?, transcriptions_remaining = ? WHERE id = ?'
    ).bind(body.subscription_plan ?? null, body.subscription_expires_at ?? null, body.role, quota, transcriptionQuota, userId).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE users SET subscription_plan = ?, subscription_expires_at = ?, generations_remaining = ?, transcriptions_remaining = ? WHERE id = ?'
    ).bind(body.subscription_plan ?? null, body.subscription_expires_at ?? null, quota, transcriptionQuota, userId).run();
  }

  return c.json({ message: 'Abonnement mis à jour.' });
});

/**
 * DELETE /api/admin/feedback/:id — Hard delete feedback (admin only).
 */
app.delete('/admin/feedback/:id', isAuthenticated, isAdmin, async (c) => {
  const feedbackId = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM feedback WHERE id = ?')
    .bind(feedbackId)
    .run();

  return c.json({ message: 'Feedback supprimé.' });
});

export default app;
