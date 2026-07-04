import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireParentSession, requireChildSession } from '../middleware/auth';
import { verifySecret, hashSecret } from '../lib/crypto';
import { gradeAnswer } from '../lib/grading';
import type { QuestionType } from '@shared/types';

export const playRoutes = new Hono<AppEnv>();

const MAX_PIN_FAILS = 5;

// --- Profile selection (requires parent session, not child) ---

playRoutes.get('/children', requireParentSession, async (c) => {
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

playRoutes.post('/select-child', requireParentSession, async (c) => {
  const session = c.get('session');
  const body = await c.req.json<{ childId?: number; pin?: string }>().catch(() => null);
  if (!body?.childId || !body.pin) return c.json({ error: 'invalid_body' }, 400);

  if (session.pinFailCount >= MAX_PIN_FAILS) {
    return c.json({ error: 'pin_locked' }, 429);
  }

  const child = await c.env.DB.prepare(
    'SELECT id, name, avatar, age_band, pin_hash FROM children WHERE id = ? AND parent_id = ?',
  )
    .bind(body.childId, session.parentId)
    .first<{ id: number; name: string; avatar: string; age_band: string; pin_hash: string }>();
  if (!child) return c.json({ error: 'not_found' }, 404);

  if (!(await verifySecret(body.pin, child.pin_hash))) {
    await c.env.DB.prepare(
      'UPDATE parent_sessions SET pin_fail_count = pin_fail_count + 1 WHERE id = ?',
    )
      .bind(session.sessionId)
      .run();
    const remaining = MAX_PIN_FAILS - session.pinFailCount - 1;
    return c.json({ error: 'wrong_pin', remaining: Math.max(0, remaining) }, 401);
  }

  await c.env.DB.prepare(
    'UPDATE parent_sessions SET active_child_id = ?, pin_fail_count = 0 WHERE id = ?',
  )
    .bind(child.id, session.sessionId)
    .run();
  return c.json({
    child: { id: child.id, name: child.name, avatar: child.avatar, ageBand: child.age_band },
  });
});

playRoutes.post('/switch-profile', requireParentSession, async (c) => {
  const session = c.get('session');
  await c.env.DB.prepare('UPDATE parent_sessions SET active_child_id = NULL, pin_fail_count = 0 WHERE id = ?')
    .bind(session.sessionId)
    .run();
  return c.json({ ok: true });
});

playRoutes.post('/forgot-pin', requireParentSession, async (c) => {
  const session = c.get('session');
  const body = await c.req
    .json<{ childId?: number; parentPassword?: string; newPin?: string }>()
    .catch(() => null);
  if (!body?.childId || !body.parentPassword || !body.newPin) {
    return c.json({ error: 'missing_fields' }, 400);
  }

  // Verify new PIN is 4 digits
  if (!/^\d{4}$/.test(body.newPin)) {
    return c.json({ error: 'invalid_pin_format' }, 400);
  }

  // Verify parent password
  const parent = await c.env.DB.prepare('SELECT password_hash FROM parents WHERE id = ?')
    .bind(session.parentId)
    .first<{ password_hash: string }>();
  if (!parent || !(await verifySecret(body.parentPassword, parent.password_hash))) {
    return c.json({ error: 'invalid_password' }, 401);
  }

  // Verify child belongs to this parent
  const child = await c.env.DB.prepare(
    'SELECT id FROM children WHERE id = ? AND parent_id = ?',
  )
    .bind(body.childId, session.parentId)
    .first();
  if (!child) return c.json({ error: 'not_found' }, 404);

  // Hash and update PIN
  const newPinHash = await hashSecret(body.newPin);
  await c.env.DB.prepare('UPDATE children SET pin_hash = ? WHERE id = ?')
    .bind(newPinHash, body.childId)
    .run();

  // Reset PIN fail count for this session
  await c.env.DB.prepare('UPDATE parent_sessions SET pin_fail_count = 0 WHERE id = ?')
    .bind(session.sessionId)
    .run();

  return c.json({ ok: true });
});

// --- Exercises + attempts (require a selected child) ---

playRoutes.get('/exercises', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const rows = await c.env.DB.prepare(
    `SELECT es.id, es.title, s.name AS subject_name,
            (SELECT COUNT(*) FROM questions q WHERE q.exercise_set_id = es.id) AS question_count,
            (SELECT MAX(a.score) FROM attempts a WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed') AS best_score,
            (SELECT COUNT(*) FROM attempts a WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed') AS completed_count
     FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE asg.child_id = ? AND es.status = 'published'
     ORDER BY asg.assigned_at DESC`,
  )
    .bind(activeChildId, activeChildId, activeChildId)
    .all();
  return c.json(
    rows.results.map((r) => ({
      id: r.id,
      title: r.title,
      subjectName: r.subject_name,
      questionCount: r.question_count,
      bestScore: r.best_score,
      completedCount: r.completed_count,
    })),
  );
});

// Questions for one assigned, published exercise — answers stripped.
playRoutes.get('/exercises/:id', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const id = Number(c.req.param('id'));
  const assigned = await c.env.DB.prepare(
    `SELECT es.id, es.title FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     WHERE asg.child_id = ? AND es.id = ? AND es.status = 'published'`,
  )
    .bind(activeChildId, id)
    .first<{ id: number; title: string }>();
  if (!assigned) return c.json({ error: 'not_found' }, 404);

  const questions = await c.env.DB.prepare(
    `SELECT id, order_index, question_type, prompt, content_json, image_id
     FROM questions WHERE exercise_set_id = ? ORDER BY order_index, id`,
  )
    .bind(id)
    .all();
  return c.json({
    id: assigned.id,
    title: assigned.title,
    questions: questions.results.map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      questionType: q.question_type,
      prompt: q.prompt,
      content: JSON.parse(q.content_json as string),
      imageId: q.image_id ?? null,
    })),
  });
});

// Serve a worksheet page image referenced by a question, for the kid player.
playRoutes.get('/exercises/:id/images/:imageId', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const id = Number(c.req.param('id'));
  const imageId = Number(c.req.param('imageId'));

  const assigned = await c.env.DB.prepare(
    `SELECT es.id FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     WHERE asg.child_id = ? AND es.id = ? AND es.status = 'published'`,
  )
    .bind(activeChildId, id)
    .first();
  if (!assigned) return c.json({ error: 'not_found' }, 404);

  const image = await c.env.DB.prepare(
    'SELECT r2_key, content_type FROM exercise_images WHERE id = ? AND exercise_set_id = ?',
  )
    .bind(imageId, id)
    .first<{ r2_key: string; content_type: string }>();
  if (!image) return c.json({ error: 'not_found' }, 404);

  const obj = await c.env.WORKSHEETS.get(image.r2_key);
  if (!obj) return c.json({ error: 'image_missing' }, 404);
  return new Response(obj.body, {
    headers: { 'content-type': image.content_type, 'cache-control': 'private, max-age=3600' },
  });
});

playRoutes.post('/attempts', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const body = await c.req.json<{ exerciseSetId?: number }>().catch(() => null);
  if (!body?.exerciseSetId) return c.json({ error: 'invalid_body' }, 400);

  const assigned = await c.env.DB.prepare(
    `SELECT es.id FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     WHERE asg.child_id = ? AND es.id = ? AND es.status = 'published'`,
  )
    .bind(activeChildId, body.exerciseSetId)
    .first();
  if (!assigned) return c.json({ error: 'not_found' }, 404);

  const result = await c.env.DB.prepare(
    'INSERT INTO attempts (child_id, exercise_set_id) VALUES (?, ?)',
  )
    .bind(activeChildId, body.exerciseSetId)
    .run();
  return c.json({ attemptId: result.meta.last_row_id }, 201);
});

// Submit one answer; graded server-side with immediate feedback.
playRoutes.post('/attempts/:id/answers', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ questionId?: number; answer?: unknown; timeSpentMs?: number }>()
    .catch(() => null);
  if (!body?.questionId) return c.json({ error: 'invalid_body' }, 400);

  const attempt = await c.env.DB.prepare(
    `SELECT id, exercise_set_id FROM attempts WHERE id = ? AND child_id = ? AND status = 'in_progress'`,
  )
    .bind(attemptId, activeChildId)
    .first<{ id: number; exercise_set_id: number }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);

  const question = await c.env.DB.prepare(
    'SELECT id, question_type, answer_json, explanation FROM questions WHERE id = ? AND exercise_set_id = ?',
  )
    .bind(body.questionId, attempt.exercise_set_id)
    .first<{ id: number; question_type: QuestionType; answer_json: string; explanation: string | null }>();
  if (!question) return c.json({ error: 'question_not_found' }, 404);

  // Answers are locked once submitted: a retried request returns the original result
  // instead of letting the kid change their answer after seeing it was wrong.
  const existing = await c.env.DB.prepare(
    'SELECT is_correct FROM attempt_answers WHERE attempt_id = ? AND question_id = ?',
  )
    .bind(attemptId, question.id)
    .first<{ is_correct: number }>();
  if (existing) {
    return c.json({
      isCorrect: existing.is_correct === 1,
      correctAnswer: JSON.parse(question.answer_json),
      explanation: question.explanation,
    });
  }

  const isCorrect = gradeAnswer(question.question_type, question.answer_json, body.answer);

  await c.env.DB.prepare(
    `INSERT INTO attempt_answers (attempt_id, question_id, given_answer_json, is_correct, time_spent_ms)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      attemptId,
      question.id,
      JSON.stringify(body.answer ?? {}),
      isCorrect ? 1 : 0,
      body.timeSpentMs ?? null,
    )
    .run();

  return c.json({ isCorrect, correctAnswer: JSON.parse(question.answer_json), explanation: question.explanation });
});

playRoutes.post('/attempts/:id/complete', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));

  const attempt = await c.env.DB.prepare(
    `SELECT id, exercise_set_id FROM attempts WHERE id = ? AND child_id = ? AND status = 'in_progress'`,
  )
    .bind(attemptId, activeChildId)
    .first<{ id: number; exercise_set_id: number }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);

  const stats = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM questions WHERE exercise_set_id = ?) AS total,
       (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = ? AND is_correct = 1) AS correct`,
  )
    .bind(attempt.exercise_set_id, attemptId)
    .first<{ total: number; correct: number }>();

  const score = stats && stats.total > 0 ? stats.correct / stats.total : 0;
  await c.env.DB.prepare(
    `UPDATE attempts SET status = 'completed', completed_at = datetime('now'), score = ? WHERE id = ?`,
  )
    .bind(score, attemptId)
    .run();
  return c.json({ score, correct: stats?.correct ?? 0, total: stats?.total ?? 0 });
});
