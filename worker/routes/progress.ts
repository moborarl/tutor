import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { loadChildProgress } from '../lib/progress';

export const progressRoutes = new Hono<AppEnv>();

progressRoutes.get('/:id/progress', async (c) => {
  const { parentId } = c.get('session');
  const childId = Number(c.req.param('id'));

  const progress = await loadChildProgress(c.env.DB, childId, parentId);
  if (!progress) return c.json({ error: 'not_found' }, 404);
  return c.json(progress);
});

// Clears only a stuck/unfinished attempt for this child+exercise set (kept
// completed attempts and their scores untouched) — the only sanctioned way to
// let a kid redo questions they already answered, since re-entering the
// exercise on its own resumes the same in-progress attempt.
progressRoutes.post('/:id/exercise-sets/:setId/reset-in-progress', async (c) => {
  const { parentId } = c.get('session');
  const childId = Number(c.req.param('id'));
  const setId = Number(c.req.param('setId'));

  const child = await c.env.DB.prepare('SELECT id FROM children WHERE id = ? AND parent_id = ?')
    .bind(childId, parentId)
    .first();
  if (!child) return c.json({ error: 'not_found' }, 404);

  const stuck = await c.env.DB.prepare(
    `SELECT id FROM attempts WHERE child_id = ? AND exercise_set_id = ? AND status = 'in_progress'`,
  )
    .bind(childId, setId)
    .all<{ id: number }>();

  for (const row of stuck.results) {
    await c.env.DB.prepare('DELETE FROM attempt_answers WHERE attempt_id = ?').bind(row.id).run();
    await c.env.DB.prepare('DELETE FROM attempts WHERE id = ?').bind(row.id).run();
  }

  return c.json({ ok: true, resetCount: stuck.results.length });
});
