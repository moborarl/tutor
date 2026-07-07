import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { validateDiagram } from '@shared/diagram';
import type { QuestionType } from '@shared/types';
import { isValidQuestionType, validateQuestionPayload } from '../lib/json-import';

export const questionRoutes = new Hono<AppEnv>();

// Ownership check: the question's exercise set must belong to this parent.
async function ownedQuestion(
  db: D1Database,
  questionId: number,
  parentId: number,
): Promise<{ id: number; exercise_set_id: number; question_type: QuestionType; content_json: string; answer_json: string } | null> {
  return db
    .prepare(
      `SELECT q.id, q.exercise_set_id, q.question_type, q.content_json, q.answer_json FROM questions q
       JOIN exercise_sets es ON es.id = q.exercise_set_id
       WHERE q.id = ? AND es.parent_id = ?`,
    )
    .bind(questionId, parentId)
    .first();
}

questionRoutes.patch('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const q = await ownedQuestion(c.env.DB, id, parentId);
  if (!q) return c.json({ error: 'not_found' }, 404);

  const body = await c.req
    .json<{
      prompt?: string;
      questionType?: string;
      content?: unknown;
      answer?: unknown;
      orderIndex?: number;
      explanation?: string;
      imageId?: number | null;
      diagram?: unknown;
    }>()
    .catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  let nextType = q.question_type;
  let nextContent: unknown = JSON.parse(q.content_json);
  let nextAnswer: unknown = JSON.parse(q.answer_json);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (typeof body.prompt === 'string' && body.prompt.trim()) {
    updates.push('prompt = ?');
    values.push(body.prompt.trim());
  }
  if (typeof body.questionType === 'string') {
    if (!isValidQuestionType(body.questionType)) return c.json({ error: 'invalid_type' }, 400);
    nextType = body.questionType;
    updates.push('question_type = ?');
    values.push(body.questionType);
  }
  if (body.content !== undefined) {
    nextContent = body.content;
    updates.push('content_json = ?');
    values.push(JSON.stringify(body.content));
  }
  if (body.answer !== undefined) {
    nextAnswer = body.answer;
    updates.push('answer_json = ?');
    values.push(JSON.stringify(body.answer));
  }
  if (body.questionType !== undefined || body.content !== undefined || body.answer !== undefined) {
    const valid = validateQuestionPayload(nextType, nextContent, nextAnswer);
    if (!valid.ok) return c.json({ error: 'invalid_question_payload', message: valid.error }, 400);
  }
  if (typeof body.orderIndex === 'number') {
    updates.push('order_index = ?');
    values.push(body.orderIndex);
  }
  if (typeof body.explanation === 'string') {
    updates.push('explanation = ?');
    values.push(body.explanation.trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'imageId')) {
    const imageId = body.imageId;
    if (imageId !== null && typeof imageId !== 'number') {
      return c.json({ error: 'invalid_image_id' }, 400);
    }
    if (imageId !== null) {
      const img = await c.env.DB.prepare(
        'SELECT id FROM exercise_images WHERE id = ? AND exercise_set_id = ?',
      )
        .bind(imageId, q.exercise_set_id)
        .first();
      if (!img) return c.json({ error: 'image_not_found' }, 400);
    }
    updates.push('image_id = ?');
    values.push(imageId);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'diagram')) {
    if (body.diagram === null) {
      updates.push('diagram_json = ?');
      values.push(null);
    } else {
      const diagram = validateDiagram(body.diagram);
      if (!diagram) return c.json({ error: 'invalid_diagram' }, 400);
      updates.push('diagram_json = ?');
      values.push(JSON.stringify(diagram));
    }
  }
  // Any edit returns the question to draft so it must be re-approved.
  updates.push(`status = 'draft'`);
  await c.env.DB.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
  return c.json({ ok: true });
});

questionRoutes.post('/:id/approve', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const q = await ownedQuestion(c.env.DB, id, parentId);
  if (!q) return c.json({ error: 'not_found' }, 404);
  await c.env.DB.prepare(`UPDATE questions SET status = 'approved' WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

questionRoutes.delete('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const q = await ownedQuestion(c.env.DB, id, parentId);
  if (!q) return c.json({ error: 'not_found' }, 404);
  await c.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// Add a question manually (e.g. when AI extraction failed or missed one).
questionRoutes.post('/', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req
    .json<{
      exerciseSetId?: number;
      prompt?: string;
      questionType?: string;
      content?: unknown;
      answer?: unknown;
      explanation?: string;
    }>()
    .catch(() => null);
  if (!body?.exerciseSetId || !body.prompt?.trim() || !isValidQuestionType(body.questionType)) {
    return c.json({ error: 'invalid_body' }, 400);
  }
  const valid = validateQuestionPayload(body.questionType, body.content ?? {}, body.answer ?? {});
  if (!valid.ok) return c.json({ error: 'invalid_question_payload', message: valid.error }, 400);

  const set = await c.env.DB.prepare(
    'SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ?',
  )
    .bind(body.exerciseSetId, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(order_index), -1) AS m FROM questions WHERE exercise_set_id = ?',
  )
    .bind(body.exerciseSetId)
    .first<{ m: number }>();

  const result = await c.env.DB.prepare(
    `INSERT INTO questions (exercise_set_id, order_index, question_type, prompt, content_json, answer_json, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.exerciseSetId,
      (maxOrder?.m ?? -1) + 1,
      body.questionType,
      body.prompt.trim(),
      JSON.stringify(body.content ?? {}),
      JSON.stringify(body.answer ?? {}),
      body.explanation?.trim() || null,
    )
    .run();

  // If the set had failed extraction, adding a manual question makes it reviewable.
  await c.env.DB.prepare(
    `UPDATE exercise_sets SET status = 'pending_review', updated_at = datetime('now')
     WHERE id = ? AND status IN ('extraction_failed','processing')`,
  )
    .bind(body.exerciseSetId)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});
