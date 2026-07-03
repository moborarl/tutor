import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hashSecret } from '../lib/crypto';

export const childrenRoutes = new Hono<AppEnv>();

const AGE_BANDS = ['young', 'older'];
const PIN_RE = /^\d{4}$/;

childrenRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const rows = await c.env.DB.prepare(
    'SELECT id, name, avatar, age_band FROM children WHERE parent_id = ? ORDER BY id',
  )
    .bind(parentId)
    .all<{ id: number; name: string; avatar: string; age_band: string }>();
  return c.json(
    rows.results.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, ageBand: r.age_band })),
  );
});

childrenRoutes.post('/', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req
    .json<{ name?: string; avatar?: string; ageBand?: string; pin?: string }>()
    .catch(() => null);
  const name = body?.name?.trim();
  if (!name) return c.json({ error: 'name_required' }, 400);
  if (!AGE_BANDS.includes(body?.ageBand ?? '')) return c.json({ error: 'invalid_age_band' }, 400);
  if (!PIN_RE.test(body?.pin ?? '')) return c.json({ error: 'pin_must_be_4_digits' }, 400);

  const pinHash = await hashSecret(body!.pin!);
  const result = await c.env.DB.prepare(
    'INSERT INTO children (parent_id, name, avatar, age_band, pin_hash) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(parentId, name, body!.avatar || '🐣', body!.ageBand, pinHash)
    .run();
  return c.json({ id: result.meta.last_row_id }, 201);
});

childrenRoutes.patch('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const body = await c.req
    .json<{ name?: string; avatar?: string; ageBand?: string; pin?: string }>()
    .catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const child = await c.env.DB.prepare(
    'SELECT id FROM children WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first();
  if (!child) return c.json({ error: 'not_found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.name?.trim()) {
    updates.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.avatar) {
    updates.push('avatar = ?');
    values.push(body.avatar);
  }
  if (body.ageBand) {
    if (!AGE_BANDS.includes(body.ageBand)) return c.json({ error: 'invalid_age_band' }, 400);
    updates.push('age_band = ?');
    values.push(body.ageBand);
  }
  if (body.pin) {
    if (!PIN_RE.test(body.pin)) return c.json({ error: 'pin_must_be_4_digits' }, 400);
    updates.push('pin_hash = ?');
    values.push(await hashSecret(body.pin));
  }
  if (updates.length === 0) return c.json({ ok: true });

  await c.env.DB.prepare(`UPDATE children SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  return c.json({ ok: true });
});

childrenRoutes.delete('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));

  const child = await c.env.DB.prepare('SELECT id FROM children WHERE id = ? AND parent_id = ?')
    .bind(id, parentId)
    .first();
  if (!child) return c.json({ error: 'not_found' }, 404);

  // Cascade delete: attempt_answers → attempts → assignments → children
  await c.env.DB.prepare(`
    DELETE FROM attempt_answers
    WHERE attempt_id IN (SELECT id FROM attempts WHERE child_id = ?)
  `)
    .bind(id)
    .run();

  await c.env.DB.prepare('DELETE FROM attempts WHERE child_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM assignments WHERE child_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM children WHERE id = ?').bind(id).run();

  return c.json({ ok: true });
});
