import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const progressRoutes = new Hono<AppEnv>();

progressRoutes.get('/:id/progress', async (c) => {
  const { parentId } = c.get('session');
  const childId = Number(c.req.param('id'));

  const child = await c.env.DB.prepare(
    'SELECT id, name, avatar, age_band FROM children WHERE id = ? AND parent_id = ?',
  )
    .bind(childId, parentId)
    .first<{ id: number; name: string; avatar: string; age_band: string }>();
  if (!child) return c.json({ error: 'not_found' }, 404);

  const overall = await c.env.DB.prepare(
    `SELECT COUNT(*) AS completed, AVG(score) AS avg_score
     FROM attempts WHERE child_id = ? AND status = 'completed'`,
  )
    .bind(childId)
    .first<{ completed: number; avg_score: number | null }>();

  const sets = await c.env.DB.prepare(
    `SELECT es.id, es.title, s.name AS subject_name,
            COUNT(a.id) AS attempt_count,
            MAX(a.score) AS best_score,
            (SELECT a2.score FROM attempts a2
             WHERE a2.exercise_set_id = es.id AND a2.child_id = ? AND a2.status = 'completed'
             ORDER BY a2.completed_at DESC LIMIT 1) AS last_score,
            MAX(a.completed_at) AS last_attempt_at
     FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     LEFT JOIN attempts a ON a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed'
     WHERE asg.child_id = ? AND es.status = 'published'
     GROUP BY es.id
     ORDER BY last_attempt_at DESC NULLS LAST`,
  )
    .bind(childId, childId, childId)
    .all();

  const recent = await c.env.DB.prepare(
    `SELECT a.id, es.title, a.score, a.status, a.started_at, a.completed_at
     FROM attempts a JOIN exercise_sets es ON es.id = a.exercise_set_id
     WHERE a.child_id = ?
     ORDER BY a.started_at DESC LIMIT 20`,
  )
    .bind(childId)
    .all();

  return c.json({
    child: { id: child.id, name: child.name, avatar: child.avatar, ageBand: child.age_band },
    totalCompletedAttempts: overall?.completed ?? 0,
    averageScore: overall?.avg_score ?? null,
    sets: sets.results.map((r) => ({
      exerciseSetId: r.id,
      title: r.title,
      subjectName: r.subject_name,
      attemptCount: r.attempt_count,
      bestScore: r.best_score,
      lastScore: r.last_score,
      lastAttemptAt: r.last_attempt_at,
    })),
    recentAttempts: recent.results.map((r) => ({
      attemptId: r.id,
      exerciseSetTitle: r.title,
      score: r.score,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    })),
  });
});
