import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const subjectRoutes = new Hono<AppEnv>();

subjectRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const rows = await c.env.DB.prepare(
    'SELECT id, name FROM subjects WHERE parent_id = ? ORDER BY name',
  )
    .bind(parentId)
    .all<{ id: number; name: string }>();
  return c.json(rows.results);
});

subjectRoutes.post('/', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{ name?: string }>().catch(() => null);
  const name = body?.name?.trim();
  if (!name) return c.json({ error: 'name_required' }, 400);
  const existing = await c.env.DB.prepare(
    'SELECT id, name FROM subjects WHERE parent_id = ? AND name = ?',
  )
    .bind(parentId, name)
    .first<{ id: number; name: string }>();
  if (existing) return c.json(existing);
  const result = await c.env.DB.prepare(
    'INSERT INTO subjects (parent_id, name) VALUES (?, ?)',
  )
    .bind(parentId, name)
    .run();
  return c.json({ id: result.meta.last_row_id, name }, 201);
});

subjectRoutes.delete('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'invalid_subject_id' }, 400);

  const subject = await c.env.DB.prepare(
    'SELECT id FROM subjects WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first<{ id: number }>();
  if (!subject) return c.json({ error: 'not_found' }, 404);

  await c.env.DB.prepare(
    'UPDATE exercise_sets SET subject_id = NULL WHERE parent_id = ? AND subject_id = ?',
  )
    .bind(parentId, id)
    .run();
  await c.env.DB.prepare(
    'DELETE FROM subjects WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .run();
  return c.json({ ok: true });
});
