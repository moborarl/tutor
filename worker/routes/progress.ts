import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { loadChildProgress } from '../lib/progress';
import type { AttemptResult, LearningMode, ReasoningFeedback } from '../../shared/types';

export const progressRoutes = new Hono<AppEnv>();

progressRoutes.get('/:id/progress', async (c) => {
  const { parentId } = c.get('session');
  const childId = Number(c.req.param('id'));

  const progress = await loadChildProgress(c.env.DB, childId, parentId);
  if (!progress) return c.json({ error: 'not_found' }, 404);
  return c.json(progress);
});

progressRoutes.get('/:id/attempts/:attemptId/result', async (c) => {
  const { parentId } = c.get('session');
  const childId = Number(c.req.param('id'));
  const attemptId = Number(c.req.param('attemptId'));

  const attempt = await c.env.DB.prepare(
    `SELECT a.id, a.exercise_set_id, a.learning_mode, a.status, a.score,
            es.title AS exercise_title, s.name AS subject_name
     FROM attempts a
     JOIN children ch ON ch.id = a.child_id
     JOIN exercise_sets es ON es.id = a.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE a.id = ? AND a.child_id = ? AND ch.parent_id = ?`,
  )
    .bind(attemptId, childId, parentId)
    .first<{
      id: number;
      exercise_set_id: number;
      learning_mode: LearningMode;
      status: string;
      score: number | null;
      exercise_title: string;
      subject_name: string | null;
    }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);
  if (attempt.status !== 'completed') return c.json({ error: 'attempt_not_completed' }, 409);

  const questionRows = await c.env.DB.prepare(
    `SELECT q.id AS question_id, q.prompt, q.answer_json, q.explanation,
            aa.given_answer_json, aa.is_correct, aa.reasoning_text, aa.ai_feedback_json
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ? AND q.exercise_set_id = ?
     ORDER BY q.order_index, q.id`,
  )
    .bind(attemptId, attempt.exercise_set_id)
    .all<{
      question_id: number;
      prompt: string;
      answer_json: string;
      explanation: string | null;
      given_answer_json: string;
      is_correct: number;
      reasoning_text: string | null;
      ai_feedback_json: string | null;
    }>();

  const questions = questionRows.results.map((row) => ({
    questionId: row.question_id,
    prompt: row.prompt,
    givenAnswer: JSON.parse(row.given_answer_json),
    isCorrect: row.is_correct === 1,
    correctAnswer: JSON.parse(row.answer_json),
    explanation: row.explanation,
    reasoningText: row.reasoning_text,
    reasoningFeedback: row.ai_feedback_json ? JSON.parse(row.ai_feedback_json) as ReasoningFeedback : null,
  }));

  const result: AttemptResult = {
    attemptId: attempt.id,
    exerciseSetId: attempt.exercise_set_id,
    exerciseTitle: attempt.exercise_title,
    subjectName: attempt.subject_name,
    learningMode: attempt.learning_mode,
    score: Number(attempt.score ?? 0),
    correct: questions.filter((question) => question.isCorrect).length,
    total: questions.length,
    subjectCompleted: 0,
    subjectAssigned: 0,
    questions,
    recommendation: null,
  };
  return c.json(result);
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
