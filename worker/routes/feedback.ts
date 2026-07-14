import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { isAuthenticated } from '../middleware/auth';

const app = new Hono<HonoEnv>();

/**
 * GET /api/feedback — List the current user's feedback.
 */
app.get('/feedback', isAuthenticated, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC'
  )
    .bind(user.id)
    .all();

  return c.json(results);
});

/**
 * POST /api/feedback — Submit new feedback.
 */
app.post('/feedback', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    type: 'suggestion' | 'bug' | 'question';
    subject: string;
    content: string;
  }>();

  if (!body.type || !body.subject || !body.content) {
    return c.json({ error: 'Type, sujet et contenu sont requis.' }, 400);
  }

  const validTypes = ['suggestion', 'bug', 'question'];
  if (!validTypes.includes(body.type)) {
    return c.json({ error: 'Type invalide.' }, 400);
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO feedback (user_id, type, subject, content) VALUES (?, ?, ?, ?)'
  )
    .bind(user.id, body.type, body.subject.trim(), body.content.trim())
    .run();

  const feedback = await c.env.DB.prepare('SELECT * FROM feedback WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first();

  return c.json(feedback, 201);
});

/**
 * PUT /api/feedback/:id — Edit own feedback.
 */
app.put('/feedback/:id', isAuthenticated, async (c) => {
  const user = c.get('user');
  const feedbackId = c.req.param('id');
  const body = await c.req.json<{ subject?: string; content?: string }>();

  const existing = await c.env.DB.prepare(
    'SELECT * FROM feedback WHERE id = ? AND user_id = ?'
  )
    .bind(feedbackId, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Feedback non trouvé.' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (body.subject) {
    updates.push('subject = ?');
    params.push(body.subject.trim());
  }
  if (body.content) {
    updates.push('content = ?');
    params.push(body.content.trim());
  }

  if (updates.length === 0) {
    return c.json({ error: 'Aucune modification.' }, 400);
  }

  params.push(Number(feedbackId));
  await c.env.DB.prepare(`UPDATE feedback SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM feedback WHERE id = ?')
    .bind(feedbackId)
    .first();

  return c.json(updated);
});

/**
 * DELETE /api/feedback/:id — Delete own feedback.
 */
app.delete('/feedback/:id', isAuthenticated, async (c) => {
  const user = c.get('user');
  const feedbackId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM feedback WHERE id = ? AND user_id = ?'
  )
    .bind(feedbackId, user.id)
    .first();

  if (!existing) {
    return c.json({ error: 'Feedback non trouvé.' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM feedback WHERE id = ?')
    .bind(feedbackId)
    .run();

  return c.json({ message: 'Feedback supprimé.' });
});

export default app;
