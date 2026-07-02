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
  const result = await c.env.DB.prepare(
    'INSERT INTO subjects (parent_id, name) VALUES (?, ?)',
  )
    .bind(parentId, name)
    .run();
  return c.json({ id: result.meta.last_row_id, name }, 201);
});
