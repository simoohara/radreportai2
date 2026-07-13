import { Hono } from 'hono';
import { HonoEnv } from '../types';
import { isAuthenticated, isAdmin } from '../middleware/auth';

const app = new Hono<HonoEnv>();

// Admin routes will be fully implemented in Phase 9.

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
