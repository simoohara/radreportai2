import { Hono } from 'hono';
import { HonoEnv } from '../types';
import { isAuthenticated } from '../middleware/auth';

const app = new Hono<HonoEnv>();

/**
 * GET /api/templates — List all templates for the current user.
 * Returns system templates (user_id IS NULL) + user's own templates,
 * excluding any that the user has hidden.
 */
app.get('/templates', isAuthenticated, async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(`
    SELECT t.* FROM templates t
    LEFT JOIN user_hidden_templates uht
      ON uht.template_id = t.id AND uht.user_id = ?
    WHERE (t.user_id IS NULL OR t.user_id = ?)
      AND uht.template_id IS NULL
    ORDER BY t.modality, t.name
  `)
    .bind(user.id, user.id)
    .all();

  return c.json(results);
});

/**
 * POST /api/templates — Create a new user template.
 */
app.post('/templates', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ name: string; modality: string; content: string }>();

  if (!body.name || !body.modality || !body.content) {
    return c.json({ error: 'Nom, modalité et contenu sont requis.' }, 400);
  }

  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO templates (user_id, modality, name, content) VALUES (?, ?, ?, ?)'
    )
      .bind(user.id, body.modality, body.name.trim(), body.content)
      .run();

    // Fetch the created template
    const template = await c.env.DB.prepare(
      'SELECT * FROM templates WHERE id = ?'
    )
      .bind(result.meta.last_row_id)
      .first();

    return c.json(template, 201);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Un modèle avec ce nom existe déjà pour cette modalité.' }, 409);
    }
    throw err;
  }
});

/**
 * PUT /api/templates/:id — Update a template (only if owned by user).
 */
app.put('/templates/:id', isAuthenticated, async (c) => {
  const user = c.get('user');
  const templateId = c.req.param('id');
  const body = await c.req.json<{ name?: string; content?: string; modality?: string }>();

  // Check ownership
  const template = await c.env.DB.prepare(
    'SELECT * FROM templates WHERE id = ? AND user_id = ?'
  )
    .bind(templateId, user.id)
    .first();

  if (!template) {
    return c.json({ error: 'Modèle non trouvé ou non autorisé.' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (body.name) {
    updates.push('name = ?');
    params.push(body.name.trim());
  }
  if (body.content) {
    updates.push('content = ?');
    params.push(body.content);
  }
  if (body.modality) {
    updates.push('modality = ?');
    params.push(body.modality);
  }

  if (updates.length === 0) {
    return c.json({ error: 'Aucune modification fournie.' }, 400);
  }

  updates.push("updated_at = datetime('now')");
  params.push(Number(templateId));

  try {
    await c.env.DB.prepare(
      `UPDATE templates SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    const updated = await c.env.DB.prepare('SELECT * FROM templates WHERE id = ?')
      .bind(templateId)
      .first();

    return c.json(updated);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Un modèle avec ce nom existe déjà pour cette modalité.' }, 409);
    }
    throw err;
  }
});

/**
 * DELETE /api/templates/:id — Delete a user template, or hide a system template.
 */
app.delete('/templates/:id', isAuthenticated, async (c) => {
  const user = c.get('user');
  const templateId = c.req.param('id');

  const template = await c.env.DB.prepare(
    'SELECT * FROM templates WHERE id = ?'
  )
    .bind(templateId)
    .first<{ id: number; user_id: number | null }>();

  if (!template) {
    return c.json({ error: 'Modèle non trouvé.' }, 404);
  }

  if (template.user_id === null) {
    // System template: hide it for this user
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_hidden_templates (user_id, template_id) VALUES (?, ?)'
    )
      .bind(user.id, template.id)
      .run();
  } else if (template.user_id === user.id) {
    // User's own template: delete it
    await c.env.DB.prepare('DELETE FROM templates WHERE id = ?')
      .bind(template.id)
      .run();
  } else {
    return c.json({ error: 'Non autorisé.' }, 403);
  }

  return c.json({ message: 'Modèle supprimé.' });
});

export default app;
