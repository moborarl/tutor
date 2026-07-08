import type { ChildProgress } from '@shared/types';

export async function loadChildProgress(
  db: D1Database,
  childId: number,
  parentId: number,
): Promise<ChildProgress | null> {
  const child = await db.prepare(
    'SELECT id, name, avatar, age_band FROM children WHERE id = ? AND parent_id = ?',
  )
    .bind(childId, parentId)
    .first<{ id: number; name: string; avatar: string; age_band: string }>();
  if (!child) return null;

  const overall = await db.prepare(
    `SELECT COUNT(*) AS completed, AVG(score) AS avg_score
     FROM attempts WHERE child_id = ? AND status = 'completed'`,
  )
    .bind(childId)
    .first<{ completed: number; avg_score: number | null }>();

  const sets = await db.prepare(
    `SELECT es.id, es.title, s.name AS subject_name,
            COUNT(a.id) AS attempt_count,
            MAX(a.score) AS best_score,
            (SELECT a2.score FROM attempts a2
             WHERE a2.exercise_set_id = es.id AND a2.child_id = ? AND a2.status = 'completed'
             ORDER BY a2.completed_at DESC LIMIT 1) AS last_score,
            MAX(a.completed_at) AS last_attempt_at,
            EXISTS (
              SELECT 1 FROM attempts a3
              WHERE a3.exercise_set_id = es.id AND a3.child_id = ? AND a3.status = 'in_progress'
            ) AS has_in_progress
     FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     LEFT JOIN attempts a ON a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed'
     WHERE asg.child_id = ? AND es.status = 'published'
     GROUP BY es.id
     ORDER BY last_attempt_at DESC NULLS LAST`,
  )
    .bind(childId, childId, childId, childId)
    .all();

  const recent = await db.prepare(
    `SELECT a.id, es.title, a.score, a.status, a.started_at, a.completed_at
     FROM attempts a JOIN exercise_sets es ON es.id = a.exercise_set_id
     WHERE a.child_id = ?
     ORDER BY a.started_at DESC LIMIT 20`,
  )
    .bind(childId)
    .all();

  const subjects = await db.prepare(
    `SELECT COALESCE(s.name, 'ไม่ระบุวิชา') AS subject_name,
            COUNT(DISTINCT es.id) AS assigned_count,
            COUNT(a.id) AS completed_attempts,
            MAX(a.score) AS best_score
     FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     LEFT JOIN attempts a ON a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed'
     WHERE asg.child_id = ? AND es.status = 'published'
     GROUP BY COALESCE(s.name, 'ไม่ระบุวิชา')
     ORDER BY subject_name`,
  )
    .bind(childId, childId)
    .all();

  return {
    child: { id: child.id, name: child.name, avatar: child.avatar, ageBand: child.age_band as 'young' | 'older' },
    totalCompletedAttempts: overall?.completed ?? 0,
    averageScore: overall?.avg_score ?? null,
    subjects: subjects.results.map((r) => ({
      subjectName: String(r.subject_name ?? 'ไม่ระบุวิชา'),
      assignedCount: Number(r.assigned_count ?? 0),
      completedAttempts: Number(r.completed_attempts ?? 0),
      bestScore: r.best_score == null ? null : Number(r.best_score),
    })),
    sets: sets.results.map((r) => ({
      exerciseSetId: Number(r.id),
      title: String(r.title ?? ''),
      subjectName: r.subject_name == null ? null : String(r.subject_name),
      attemptCount: Number(r.attempt_count ?? 0),
      bestScore: r.best_score == null ? null : Number(r.best_score),
      lastScore: r.last_score == null ? null : Number(r.last_score),
      lastAttemptAt: r.last_attempt_at == null ? null : String(r.last_attempt_at),
      hasInProgress: Boolean(r.has_in_progress),
    })),
    recentAttempts: recent.results.map((r) => ({
      attemptId: Number(r.id),
      exerciseSetTitle: String(r.title ?? ''),
      score: r.score == null ? null : Number(r.score),
      status: String(r.status ?? ''),
      startedAt: String(r.started_at ?? ''),
      completedAt: r.completed_at == null ? null : String(r.completed_at),
    })),
  };
}
