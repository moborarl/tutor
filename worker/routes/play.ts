import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import { requireParentSession, requireChildSession } from '../middleware/auth';
import { gradeAnswer } from '../lib/grading';
import { canUseAnswerEndpoint, sanitizeAttemptAnswer } from '../lib/attempt-mode';
import { loadChildProgress } from '../lib/progress';
import type {
  AttemptAnswerView,
  AttemptResult,
  LearningMode,
  PlayExercise,
  QuestionType,
} from '@shared/types';
import type { AiProvider, CustomAiFormat, ReasoningFeedback, ReasoningRubric } from '@shared/types';
import { decryptCredential } from '../lib/credential-crypto';
import { runReasoningFeedback } from '../lib/reasoning-ai';
import { recommendNextExercise } from '../lib/exercise-recommendation';

export const playRoutes = new Hono<AppEnv>();

interface ReasoningQuestion {
  prompt: string;
  content_json: string;
  answer_json: string;
  reasoning_prompt: string | null;
  reasoning_rubric_json: string | null;
}

async function createReasoningFeedback(
  c: Context<AppEnv>,
  attemptAnswerId: number,
  question: ReasoningQuestion,
  answer: unknown,
  reasoningText: string,
): Promise<ReasoningFeedback> {
  if (!question.reasoning_prompt) {
    return { status: 'unavailable', message: 'โจทย์นี้ยังไม่มีคำแนะนำการอธิบาย' };
  }
  const { parentId } = c.get('session');
  const setting = await c.env.DB.prepare(
    `SELECT provider, model, encrypted_api_key, base_url, api_format, enabled, daily_limit, monthly_limit
     FROM parent_ai_settings WHERE parent_id = ?`,
  ).bind(parentId).first<{
    provider: AiProvider;
    model: string;
    encrypted_api_key: string;
    base_url: string | null;
    api_format: CustomAiFormat;
    enabled: number;
    daily_limit: number;
    monthly_limit: number;
  }>();
  if (!setting || setting.enabled !== 1 || !c.env.AI_CREDENTIAL_ENCRYPTION_KEY) {
    return { status: 'unavailable', message: 'ผู้ปกครองยังไม่ได้เปิดใช้ผู้ช่วยอ่านคำอธิบาย' };
  }

  const usage = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN created_at >= date('now') THEN 1 ELSE 0 END) AS daily_count,
       SUM(CASE WHEN created_at >= date('now','start of month') THEN 1 ELSE 0 END) AS monthly_count
     FROM ai_feedback_usage WHERE parent_id = ?`,
  ).bind(parentId).first<{ daily_count: number | null; monthly_count: number | null }>();
  if ((usage?.daily_count ?? 0) >= setting.daily_limit || (usage?.monthly_count ?? 0) >= setting.monthly_limit) {
    return { status: 'limit_reached', message: 'ถึงขีดจำกัดการใช้ AI ที่ผู้ปกครองตั้งไว้แล้ว' };
  }

  const usageRow = await c.env.DB.prepare(
    `INSERT INTO ai_feedback_usage (parent_id, attempt_answer_id, provider, model, status)
     VALUES (?, ?, ?, ?, 'started')`,
  ).bind(parentId, attemptAnswerId, setting.provider, setting.model).run();
  const usageId = Number(usageRow.meta.last_row_id);
  try {
    const apiKey = await decryptCredential(setting.encrypted_api_key, c.env.AI_CREDENTIAL_ENCRYPTION_KEY);
    const content = JSON.parse(question.content_json) as { options?: string[] };
    const correct = JSON.parse(question.answer_json) as { correctIndex?: number };
    const selected = answer as { selectedIndex?: number } | null;
    const feedback = await runReasoningFeedback({
      provider: setting.provider,
      model: setting.model,
      apiKey,
      baseUrl: setting.base_url,
      apiFormat: setting.api_format,
      question: question.prompt,
      options: content.options ?? [],
      correctIndex: correct.correctIndex ?? -1,
      selectedIndex: selected?.selectedIndex ?? -1,
      reasoningText,
      reasoningPrompt: question.reasoning_prompt,
      rubric: question.reasoning_rubric_json
        ? JSON.parse(question.reasoning_rubric_json) as ReasoningRubric
        : null,
    });
    await c.env.DB.prepare("UPDATE ai_feedback_usage SET status = 'completed' WHERE id = ?")
      .bind(usageId)
      .run();
    return feedback;
  } catch {
    await c.env.DB.prepare("UPDATE ai_feedback_usage SET status = 'failed' WHERE id = ?")
      .bind(usageId)
      .run();
    return {
      status: 'failed',
      message: 'ยังอ่านคำอธิบายไม่ได้ แต่คำตอบถูกบันทึกเรียบร้อยแล้ว',
    };
  }
}

// --- Profile selection (requires parent session, not child) ---

playRoutes.get('/family', requireParentSession, async (c) => {
  const { parentId } = c.get('session');
  const parent = await c.env.DB.prepare('SELECT email, family_name FROM parents WHERE id = ?')
    .bind(parentId)
    .first<{ email: string; family_name: string | null }>();
  if (!parent) return c.json({ error: 'not_found' }, 404);
  const fallbackName = `${(parent.email.split('@')[0] || 'Family')} family`;
  return c.json({ familyName: parent.family_name || fallbackName });
});

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
  const body = await c.req.json<{ childId?: number }>().catch(() => null);
  if (!body?.childId) return c.json({ error: 'invalid_body' }, 400);

  const child = await c.env.DB.prepare(
    'SELECT id, name, avatar, age_band FROM children WHERE id = ? AND parent_id = ?',
  )
    .bind(body.childId, session.parentId)
    .first<{ id: number; name: string; avatar: string; age_band: string }>();
  if (!child) return c.json({ error: 'not_found' }, 404);

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

// --- Exercises + attempts (require a selected child) ---

playRoutes.get('/exercises', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const rows = await c.env.DB.prepare(
    `SELECT es.id, es.title, s.name AS subject_name,
            (SELECT COUNT(*) FROM questions q WHERE q.exercise_set_id = es.id) AS question_count,
            (SELECT MAX(a.score) FROM attempts a WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed') AS best_score,
            (SELECT COUNT(*) FROM attempts a WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed') AS completed_count,
            es.learning_mode,
            in_progress_attempt.id AS in_progress_attempt_id,
            (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = in_progress_attempt.id) AS in_progress_answered_count,
            asg.assigned_at
     FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     LEFT JOIN attempts in_progress_attempt ON in_progress_attempt.id = (
       SELECT a.id FROM attempts a
       WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'in_progress'
       ORDER BY a.started_at DESC, a.id DESC
       LIMIT 1
     )
     WHERE asg.child_id = ? AND es.status = 'published'
     ORDER BY
       CASE WHEN in_progress_attempt_id IS NOT NULL THEN 0
            WHEN completed_count = 0 THEN 1 ELSE 2 END,
       asg.assigned_at ASC,
       es.id ASC`,
  )
    .bind(activeChildId, activeChildId, activeChildId, activeChildId)
    .all();
  return c.json(
    rows.results.map((r) => ({
      id: r.id,
      title: r.title,
      subjectName: r.subject_name,
      questionCount: r.question_count,
      bestScore: r.best_score,
      completedCount: r.completed_count,
      learningMode: r.learning_mode,
      hasInProgress: r.in_progress_attempt_id != null,
      inProgressAnsweredCount: r.in_progress_answered_count,
      assignedAt: r.assigned_at,
    })),
  );
});

playRoutes.get('/progress', requireChildSession, async (c) => {
  const { parentId, activeChildId } = c.get('session');
  const progress = await loadChildProgress(c.env.DB, activeChildId!, parentId);
  if (!progress) return c.json({ error: 'not_found' }, 404);
  return c.json(progress);
});

// Questions for one assigned, published exercise — answers stripped.
playRoutes.get('/exercises/:id', requireChildSession, async (c) => {
  const { parentId, activeChildId } = c.get('session');
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
    `SELECT id, order_index, question_type, prompt, content_json, image_id, diagram_json, reasoning_prompt
     FROM questions WHERE exercise_set_id = ? ORDER BY order_index, id`,
  )
    .bind(id)
    .all();
  const aiSetting = await c.env.DB.prepare(
    'SELECT enabled FROM parent_ai_settings WHERE parent_id = ?',
  ).bind(parentId).first<{ enabled: number }>();
  return c.json({
    id: assigned.id,
    title: assigned.title,
    aiFeedbackAvailable: aiSetting?.enabled === 1 && !!c.env.AI_CREDENTIAL_ENCRYPTION_KEY,
    questions: questions.results.map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      questionType: q.question_type,
      prompt: q.prompt,
      content: JSON.parse(q.content_json as string),
      imageId: q.image_id ?? null,
      diagram: q.image_id ? null : q.diagram_json ? JSON.parse(q.diagram_json as string) : null,
      reasoningPrompt: q.reasoning_prompt ?? null,
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
    `SELECT es.id, es.learning_mode FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     WHERE asg.child_id = ? AND es.id = ? AND es.status = 'published'`,
  )
    .bind(activeChildId, body.exerciseSetId)
    .first<{ id: number; learning_mode: LearningMode }>();
  if (!assigned) return c.json({ error: 'not_found' }, 404);

  // Resume an unfinished attempt instead of always starting a new one — otherwise
  // exiting mid-way and coming back would spawn a fresh attempt with no locked
  // answers, letting the kid redo questions they already answered.
  const existing = await c.env.DB.prepare(
    `SELECT id, learning_mode FROM attempts
     WHERE child_id = ? AND exercise_set_id = ? AND status = 'in_progress'`,
  )
    .bind(activeChildId, body.exerciseSetId)
    .first<{ id: number; learning_mode: LearningMode }>();

  if (existing) {
    const existingAnswers = await c.env.DB.prepare(
      `SELECT aa.question_id, aa.given_answer_json, aa.time_spent_ms, aa.reasoning_text,
              aa.is_correct, aa.ai_feedback_json, q.answer_json, q.explanation
       FROM attempt_answers aa JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = ?`,
    )
      .bind(existing.id)
      .all<{
        question_id: number;
        given_answer_json: string;
        time_spent_ms: number | null;
        reasoning_text: string | null;
        is_correct: number;
        ai_feedback_json: string | null;
        answer_json: string;
        explanation: string | null;
      }>();
    return c.json({
      attemptId: existing.id,
      learningMode: existing.learning_mode,
      existingAnswers: existingAnswers.results.map((r) => {
        const answer: AttemptAnswerView = {
          questionId: r.question_id,
          givenAnswer: JSON.parse(r.given_answer_json),
          timeSpentMs: r.time_spent_ms,
          reasoningText: r.reasoning_text,
          isCorrect: r.is_correct === 1,
          correctAnswer: JSON.parse(r.answer_json),
          explanation: r.explanation,
          reasoningFeedback: r.ai_feedback_json ? JSON.parse(r.ai_feedback_json) : null,
        };
        return sanitizeAttemptAnswer(existing.learning_mode, false, answer);
      }),
    });
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO attempts (child_id, exercise_set_id, learning_mode) VALUES (?, ?, ?)',
  )
    .bind(activeChildId, body.exerciseSetId, assigned.learning_mode)
    .run();
  return c.json({
    attemptId: result.meta.last_row_id,
    learningMode: assigned.learning_mode,
    existingAnswers: [],
  }, 201);
});

// Submit one answer; graded server-side with immediate feedback.
playRoutes.post('/attempts/:id/answers', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ questionId?: number; answer?: unknown; timeSpentMs?: number; reasoningText?: string }>()
    .catch(() => null);
  if (!body?.questionId) return c.json({ error: 'invalid_body' }, 400);
  if (typeof body.reasoningText === 'string' && body.reasoningText.length > 500) {
    return c.json({ error: 'reasoning_too_long' }, 400);
  }

  const attempt = await c.env.DB.prepare(
    `SELECT id, exercise_set_id, learning_mode FROM attempts
     WHERE id = ? AND child_id = ? AND status = 'in_progress'`,
  )
    .bind(attemptId, activeChildId)
    .first<{ id: number; exercise_set_id: number; learning_mode: LearningMode }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);
  if (!canUseAnswerEndpoint(attempt.learning_mode, 'guided-submit')) {
    return c.json({ error: 'mode_requires_exam_save' }, 409);
  }

  const question = await c.env.DB.prepare(
    `SELECT id, question_type, prompt, content_json, answer_json, explanation, reasoning_prompt, reasoning_rubric_json
     FROM questions WHERE id = ? AND exercise_set_id = ?`,
  )
    .bind(body.questionId, attempt.exercise_set_id)
    .first<{
      id: number; question_type: QuestionType; prompt: string; content_json: string; answer_json: string;
      explanation: string | null; reasoning_prompt: string | null; reasoning_rubric_json: string | null;
    }>();
  if (!question) return c.json({ error: 'question_not_found' }, 404);

  // Answers are locked once submitted: a retried request returns the original result
  // instead of letting the kid change their answer after seeing it was wrong.
  const existing = await c.env.DB.prepare(
    'SELECT is_correct, ai_feedback_json FROM attempt_answers WHERE attempt_id = ? AND question_id = ?',
  )
    .bind(attemptId, question.id)
    .first<{ is_correct: number; ai_feedback_json: string | null }>();
  if (existing) {
    return c.json({
      isCorrect: existing.is_correct === 1,
      correctAnswer: JSON.parse(question.answer_json),
      explanation: question.explanation,
      reasoningFeedback: existing.ai_feedback_json ? JSON.parse(existing.ai_feedback_json) : null,
    });
  }

  const isCorrect = gradeAnswer(question.question_type, question.answer_json, body.answer);

  const reasoningText = typeof body.reasoningText === 'string' ? body.reasoningText.trim().slice(0, 500) : '';
  const inserted = await c.env.DB.prepare(
    `INSERT INTO attempt_answers (attempt_id, question_id, given_answer_json, is_correct, time_spent_ms, reasoning_text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      attemptId,
      question.id,
      JSON.stringify(body.answer ?? {}),
      isCorrect ? 1 : 0,
      body.timeSpentMs ?? null,
      reasoningText || null,
    )
    .run();

  let reasoningFeedback: ReasoningFeedback | null = null;
  if (reasoningText && question.question_type === 'multiple_choice' && question.reasoning_prompt) {
    reasoningFeedback = await createReasoningFeedback(
      c,
      Number(inserted.meta.last_row_id),
      question,
      body.answer,
      reasoningText,
    );
    await c.env.DB.prepare(
      'UPDATE attempt_answers SET ai_feedback_json = ?, ai_feedback_status = ? WHERE id = ?',
    ).bind(JSON.stringify(reasoningFeedback), reasoningFeedback.status, Number(inserted.meta.last_row_id)).run();
  }

  return c.json({ isCorrect, correctAnswer: JSON.parse(question.answer_json), explanation: question.explanation, reasoningFeedback });
});

playRoutes.put('/attempts/:id/answers', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ questionId?: number; answer?: unknown; timeSpentMs?: number; reasoningText?: string }>()
    .catch(() => null);
  if (!body?.questionId) return c.json({ error: 'invalid_body' }, 400);
  if (typeof body.reasoningText === 'string' && body.reasoningText.length > 500) {
    return c.json({ error: 'reasoning_too_long' }, 400);
  }

  const attempt = await c.env.DB.prepare(
    `SELECT id, exercise_set_id, learning_mode FROM attempts
     WHERE id = ? AND child_id = ? AND status = 'in_progress'`,
  )
    .bind(attemptId, activeChildId)
    .first<{ id: number; exercise_set_id: number; learning_mode: LearningMode }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);
  if (!canUseAnswerEndpoint(attempt.learning_mode, 'exam-save')) {
    return c.json({ error: 'mode_requires_guided_submit' }, 409);
  }

  const question = await c.env.DB.prepare(
    `SELECT id, question_type, answer_json
     FROM questions WHERE id = ? AND exercise_set_id = ?`,
  )
    .bind(body.questionId, attempt.exercise_set_id)
    .first<{ id: number; question_type: QuestionType; answer_json: string }>();
  if (!question) return c.json({ error: 'question_not_found' }, 404);

  const isCorrect = gradeAnswer(question.question_type, question.answer_json, body.answer);
  const reasoningText = typeof body.reasoningText === 'string' ? body.reasoningText.trim() : '';
  await c.env.DB.prepare(
    `INSERT INTO attempt_answers
       (attempt_id, question_id, given_answer_json, is_correct, time_spent_ms, reasoning_text)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(attempt_id, question_id) DO UPDATE SET
       given_answer_json = excluded.given_answer_json,
       is_correct = excluded.is_correct,
       time_spent_ms = excluded.time_spent_ms,
       reasoning_text = excluded.reasoning_text,
       ai_feedback_json = NULL,
       ai_feedback_status = NULL`,
  )
    .bind(
      attemptId,
      question.id,
      JSON.stringify(body.answer ?? {}),
      isCorrect ? 1 : 0,
      body.timeSpentMs ?? null,
      reasoningText || null,
    )
    .run();

  const answered = await c.env.DB.prepare(
    'SELECT COUNT(*) AS answered_count FROM attempt_answers WHERE attempt_id = ?',
  )
    .bind(attemptId)
    .first<{ answered_count: number }>();
  return c.json({ saved: true, answeredCount: answered?.answered_count ?? 0 });
});

playRoutes.post('/attempts/:id/complete', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));

  const attempt = await c.env.DB.prepare(
    `SELECT id, exercise_set_id, learning_mode FROM attempts
     WHERE id = ? AND child_id = ? AND status = 'in_progress'`,
  )
    .bind(attemptId, activeChildId)
    .first<{ id: number; exercise_set_id: number; learning_mode: LearningMode }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);

  const stats = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM questions WHERE exercise_set_id = ?) AS total,
       (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = ?) AS answered,
       (SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = ? AND is_correct = 1) AS correct`,
  )
    .bind(attempt.exercise_set_id, attemptId, attemptId)
    .first<{ total: number; answered: number; correct: number }>();

  const total = stats?.total ?? 0;
  const answered = stats?.answered ?? 0;
  if (answered !== total) {
    return c.json({ error: 'incomplete_attempt', answered, total }, 409);
  }

  const correct = stats?.correct ?? 0;
  const score = total > 0 ? correct / total : 0;
  const [updated, progressResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE attempts SET status = 'completed', completed_at = datetime('now'), score = ?
       WHERE id = ? AND status = 'in_progress'`,
    ).bind(score, attemptId),
    c.env.DB.prepare(
      `SELECT s.name AS subject_name,
              COUNT(DISTINCT CASE WHEN completed.id IS NOT NULL THEN assigned_es.id END) AS completed,
              COUNT(DISTINCT assigned_es.id) AS assigned
       FROM exercise_sets current_es
       LEFT JOIN subjects s ON s.id = current_es.subject_id
       JOIN exercise_sets assigned_es
         ON assigned_es.subject_id IS current_es.subject_id AND assigned_es.status = 'published'
       JOIN assignments asg ON asg.exercise_set_id = assigned_es.id AND asg.child_id = ?
       LEFT JOIN attempts completed
         ON completed.exercise_set_id = assigned_es.id
        AND completed.child_id = ?
        AND completed.status = 'completed'
       WHERE current_es.id = ?
       GROUP BY current_es.id, s.name`,
    ).bind(activeChildId, activeChildId, attempt.exercise_set_id),
  ]);
  if ((updated.meta.changes ?? 0) !== 1) {
    return c.json({ error: 'attempt_not_found' }, 404);
  }

  const progress = progressResult.results[0] as {
    subject_name: string | null;
    completed: number;
    assigned: number;
  } | undefined;
  return c.json({
    score,
    correct,
    total,
    learningMode: attempt.learning_mode,
    subjectProgress: {
      subjectName: progress?.subject_name ?? null,
      completed: Number(progress?.completed ?? 0),
      assigned: Number(progress?.assigned ?? 0),
    },
  });
});

playRoutes.get('/attempts/:id/result', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));
  const attempt = await c.env.DB.prepare(
    `SELECT a.id, a.exercise_set_id, a.learning_mode, a.status, a.score,
            es.title AS exercise_title, es.subject_id, s.name AS subject_name
     FROM attempts a
     JOIN exercise_sets es ON es.id = a.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE a.id = ? AND a.child_id = ?`,
  )
    .bind(attemptId, activeChildId)
    .first<{
      id: number;
      exercise_set_id: number;
      learning_mode: LearningMode;
      status: string;
      score: number | null;
      exercise_title: string;
      subject_id: number | null;
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

  const assignedRows = await c.env.DB.prepare(
    `SELECT es.id, es.title, s.name AS subject_name,
            (SELECT COUNT(*) FROM questions q WHERE q.exercise_set_id = es.id) AS question_count,
            (SELECT MAX(a.score) FROM attempts a WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed') AS best_score,
            (SELECT COUNT(*) FROM attempts a WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'completed') AS completed_count,
            es.learning_mode,
            in_progress_attempt.id AS in_progress_attempt_id,
            (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = in_progress_attempt.id) AS in_progress_answered_count,
            asg.assigned_at
     FROM assignments asg
     JOIN exercise_sets es ON es.id = asg.exercise_set_id
     LEFT JOIN subjects s ON s.id = es.subject_id
     LEFT JOIN attempts in_progress_attempt ON in_progress_attempt.id = (
       SELECT a.id FROM attempts a
       WHERE a.exercise_set_id = es.id AND a.child_id = ? AND a.status = 'in_progress'
       ORDER BY a.started_at DESC, a.id DESC LIMIT 1
     )
     WHERE asg.child_id = ? AND es.status = 'published'
     ORDER BY asg.assigned_at, es.id`,
  )
    .bind(activeChildId, activeChildId, activeChildId, activeChildId)
    .all<Record<string, unknown>>();
  const assignedExercises: PlayExercise[] = assignedRows.results.map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    subjectName: row.subject_name == null ? null : String(row.subject_name),
    questionCount: Number(row.question_count),
    bestScore: row.best_score == null ? null : Number(row.best_score),
    completedCount: Number(row.completed_count),
    learningMode: row.learning_mode as LearningMode,
    hasInProgress: row.in_progress_attempt_id != null,
    inProgressAnsweredCount: Number(row.in_progress_answered_count ?? 0),
    assignedAt: String(row.assigned_at),
  }));
  const subjectExercises = assignedExercises.filter((row) => row.subjectName === attempt.subject_name);
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
    subjectCompleted: subjectExercises.filter((row) => row.completedCount > 0).length,
    subjectAssigned: subjectExercises.length,
    questions,
    recommendation: recommendNextExercise(assignedExercises, attempt.exercise_set_id),
  };
  return c.json(result);
});

playRoutes.post('/attempts/:id/reasoning-feedback', requireChildSession, async (c) => {
  const { activeChildId } = c.get('session');
  const attemptId = Number(c.req.param('id'));
  const body = await c.req.json<{ questionId?: number }>().catch(() => null);
  if (!body?.questionId) return c.json({ error: 'invalid_body' }, 400);

  const attempt = await c.env.DB.prepare(
    'SELECT id, exercise_set_id, learning_mode, status FROM attempts WHERE id = ? AND child_id = ?',
  )
    .bind(attemptId, activeChildId)
    .first<{ id: number; exercise_set_id: number; learning_mode: LearningMode; status: string }>();
  if (!attempt) return c.json({ error: 'attempt_not_found' }, 404);
  if (attempt.status !== 'completed') return c.json({ error: 'attempt_not_completed' }, 409);
  if (attempt.learning_mode !== 'exam') return c.json({ error: 'mode_requires_exam' }, 409);

  const answer = await c.env.DB.prepare(
    `SELECT aa.id AS attempt_answer_id, aa.given_answer_json, aa.reasoning_text, aa.ai_feedback_json,
            q.id AS question_id, q.question_type, q.prompt, q.content_json, q.answer_json,
            q.reasoning_prompt, q.reasoning_rubric_json
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
     WHERE aa.attempt_id = ? AND aa.question_id = ? AND q.exercise_set_id = ?`,
  )
    .bind(attemptId, body.questionId, attempt.exercise_set_id)
    .first<{
      attempt_answer_id: number;
      given_answer_json: string;
      reasoning_text: string | null;
      ai_feedback_json: string | null;
      question_id: number;
      question_type: QuestionType;
      prompt: string;
      content_json: string;
      answer_json: string;
      reasoning_prompt: string | null;
      reasoning_rubric_json: string | null;
    }>();
  if (!answer) return c.json({ error: 'answer_not_found' }, 404);
  if (answer.question_type !== 'multiple_choice' || !answer.reasoning_prompt) {
    return c.json({ error: 'reasoning_not_available' }, 409);
  }
  const reasoningText = answer.reasoning_text?.trim() ?? '';
  if (!reasoningText) return c.json({ error: 'reasoning_required' }, 409);
  if (answer.ai_feedback_json) {
    return c.json(JSON.parse(answer.ai_feedback_json) as ReasoningFeedback);
  }

  const feedback = await createReasoningFeedback(
    c,
    answer.attempt_answer_id,
    {
      prompt: answer.prompt,
      content_json: answer.content_json,
      answer_json: answer.answer_json,
      reasoning_prompt: answer.reasoning_prompt,
      reasoning_rubric_json: answer.reasoning_rubric_json,
    },
    JSON.parse(answer.given_answer_json),
    reasoningText,
  );
  await c.env.DB.prepare(
    'UPDATE attempt_answers SET ai_feedback_json = ?, ai_feedback_status = ? WHERE id = ?',
  )
    .bind(JSON.stringify(feedback), feedback.status, answer.attempt_answer_id)
    .run();
  return c.json(feedback);
});
