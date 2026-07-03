import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../env';
import type { ExtractedQuestion } from '@shared/types';
import { runCloudExtraction } from '../lib/ai-providers';
import { randomId } from '../lib/crypto';

export const exerciseRoutes = new Hono<AppEnv>();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function insertDraftQuestions(
  db: D1Database,
  exerciseSetId: number,
  questions: ExtractedQuestion[],
): Promise<void> {
  const stmts = questions.map((q, i) =>
    db
      .prepare(
        `INSERT INTO questions (exercise_set_id, order_index, question_type, prompt, content_json, answer_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        exerciseSetId,
        i,
        q.questionType,
        q.prompt,
        JSON.stringify(q.content ?? {}),
        JSON.stringify(q.answer ?? {}),
      ),
  );
  await db.batch(stmts);
}

// Runs cloud extraction for a set and updates its row. Used by upload + retry.
async function extractForSet(
  c: Context<AppEnv>,
  setId: number,
  r2Key: string,
  contentType: string,
  ageBand: 'young' | 'older',
): Promise<void> {
  const obj = await c.env.WORKSHEETS.get(r2Key);
  if (!obj) {
    await c.env.DB.prepare(
      `UPDATE exercise_sets SET status = 'extraction_failed', extraction_error = 'image missing from storage', updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(setId)
      .run();
    return;
  }
  const imageBytes = await obj.arrayBuffer();
  const result = await runCloudExtraction(c.env, { imageBytes, contentType, ageBand });

  if (result.status === 'done') {
    await insertDraftQuestions(c.env.DB, setId, result.questions);
    await c.env.DB.prepare(
      `UPDATE exercise_sets SET status = 'pending_review', extraction_provider = ?, extraction_error = NULL,
       title = CASE WHEN title = '' THEN ? ELSE title END, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(result.provider, result.title, setId)
      .run();
  } else if (result.status === 'queue_for_pi') {
    // Leave/put the row in 'processing' so the Pi picks it up on its next poll.
    await c.env.DB.prepare(
      `UPDATE exercise_sets SET status = 'processing', extraction_error = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(`cloud unavailable, queued for pi: ${result.lastError}`, setId)
      .run();
  } else {
    await c.env.DB.prepare(
      `UPDATE exercise_sets SET status = 'extraction_failed', extraction_error = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(result.error, setId)
      .run();
  }
}

// Upload a worksheet photo -> R2 -> extraction (Claude sync; Pi queue on quota exhaustion).
exerciseRoutes.post('/', async (c) => {
  const { parentId } = c.get('session');
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'multipart_required' }, 400);

  // workers-types FormData.get is typed as string|null, but binary parts arrive as File at runtime
  const file = form.get('image') as unknown;
  if (!(file instanceof File)) return c.json({ error: 'image_required' }, 400);
  if (!IMAGE_TYPES.includes(file.type)) return c.json({ error: 'unsupported_image_type' }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'image_too_large' }, 400);

  const ageBand = form.get('ageBand') === 'young' ? 'young' : 'older';
  const title = typeof form.get('title') === 'string' ? (form.get('title') as string).trim() : '';
  const subjectIdRaw = form.get('subjectId');
  const subjectId = subjectIdRaw && !isNaN(Number(subjectIdRaw)) ? Number(subjectIdRaw) : null;
  const provider = form.get('provider') === 'pi' ? 'pi' : 'cloud';

  const r2Key = `worksheets/${parentId}/${randomId(12)}`;
  await c.env.WORKSHEETS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const initialStatus = provider === 'pi' ? 'processing' : 'extracting';
  const result = await c.env.DB.prepare(
    `INSERT INTO exercise_sets (parent_id, subject_id, title, age_band, source_image_r2_key, source_image_content_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(parentId, subjectId, title, ageBand, r2Key, file.type, initialStatus)
    .run();
  const setId = result.meta.last_row_id as number;

  if (provider === 'cloud') {
    await extractForSet(c, setId, r2Key, file.type, ageBand);
  }

  const row = await c.env.DB.prepare('SELECT status FROM exercise_sets WHERE id = ?')
    .bind(setId)
    .first<{ status: string }>();
  return c.json({ id: setId, status: row?.status }, 201);
});

exerciseRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const rows = await c.env.DB.prepare(
    `SELECT es.id, es.title, es.subject_id, s.name AS subject_name, es.age_band, es.status,
            es.extraction_provider, es.extraction_error, es.created_at,
            (SELECT COUNT(*) FROM questions q WHERE q.exercise_set_id = es.id) AS question_count
     FROM exercise_sets es LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE es.parent_id = ? AND es.status != 'archived'
     ORDER BY es.created_at DESC`,
  )
    .bind(parentId)
    .all();
  return c.json(
    rows.results.map((r) => ({
      id: r.id,
      title: r.title,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      ageBand: r.age_band,
      status: r.status,
      extractionProvider: r.extraction_provider,
      extractionError: r.extraction_error,
      questionCount: r.question_count,
      createdAt: r.created_at,
    })),
  );
});

exerciseRoutes.get('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare(
    `SELECT es.id, es.title, es.subject_id, s.name AS subject_name, es.age_band, es.status,
            es.extraction_provider, es.extraction_error, es.created_at
     FROM exercise_sets es LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE es.id = ? AND es.parent_id = ?`,
  )
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

  const questions = await c.env.DB.prepare(
    `SELECT id, order_index, question_type, prompt, content_json, answer_json, status
     FROM questions WHERE exercise_set_id = ? ORDER BY order_index, id`,
  )
    .bind(id)
    .all();
  const assigned = await c.env.DB.prepare(
    'SELECT child_id FROM assignments WHERE exercise_set_id = ?',
  )
    .bind(id)
    .all<{ child_id: number }>();

  return c.json({
    id: set.id,
    title: set.title,
    subjectId: set.subject_id,
    subjectName: set.subject_name,
    ageBand: set.age_band,
    status: set.status,
    extractionProvider: set.extraction_provider,
    extractionError: set.extraction_error,
    createdAt: set.created_at,
    questionCount: questions.results.length,
    assignedChildIds: assigned.results.map((a) => a.child_id),
    questions: questions.results.map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      questionType: q.question_type,
      prompt: q.prompt,
      content: JSON.parse(q.content_json as string),
      answer: JSON.parse(q.answer_json as string),
      status: q.status,
    })),
  });
});

// Serve the original uploaded photo to the parent (for the review screen).
exerciseRoutes.get('/:id/image', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare(
    'SELECT source_image_r2_key, source_image_content_type FROM exercise_sets WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first<{ source_image_r2_key: string; source_image_content_type: string }>();
  if (!set) return c.json({ error: 'not_found' }, 404);
  const obj = await c.env.WORKSHEETS.get(set.source_image_r2_key);
  if (!obj) return c.json({ error: 'image_missing' }, 404);
  return new Response(obj.body, {
    headers: { 'content-type': set.source_image_content_type, 'cache-control': 'private, max-age=3600' },
  });
});

exerciseRoutes.post('/:id/retry-extraction', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare(
    `SELECT source_image_r2_key, source_image_content_type, age_band FROM exercise_sets
     WHERE id = ? AND parent_id = ? AND status IN ('extraction_failed','processing','pending_review')`,
  )
    .bind(id, parentId)
    .first<{ source_image_r2_key: string; source_image_content_type: string; age_band: string }>();
  if (!set) return c.json({ error: 'not_found' }, 404);

  // Clear previous draft questions before re-extracting.
  await c.env.DB.prepare('DELETE FROM questions WHERE exercise_set_id = ?').bind(id).run();
  await c.env.DB.prepare(
    `UPDATE exercise_sets SET status = 'extracting', extraction_error = NULL, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(id)
    .run();

  await extractForSet(
    c,
    id,
    set.source_image_r2_key,
    set.source_image_content_type,
    set.age_band as 'young' | 'older',
  );
  const row = await c.env.DB.prepare('SELECT status FROM exercise_sets WHERE id = ?')
    .bind(id)
    .first<{ status: string }>();
  return c.json({ ok: true, status: row?.status });
});

exerciseRoutes.patch('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const body = await c.req
    .json<{ title?: string; subjectId?: number | null; ageBand?: string }>()
    .catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);

  const set = await c.env.DB.prepare(
    'SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (typeof body.title === 'string') {
    updates.push('title = ?');
    values.push(body.title.trim());
  }
  if (body.subjectId !== undefined) {
    updates.push('subject_id = ?');
    values.push(body.subjectId);
  }
  if (body.ageBand === 'young' || body.ageBand === 'older') {
    updates.push('age_band = ?');
    values.push(body.ageBand);
  }
  if (updates.length > 0) {
    updates.push(`updated_at = datetime('now')`);
    await c.env.DB.prepare(`UPDATE exercise_sets SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values, id)
      .run();
  }
  return c.json({ ok: true });
});

exerciseRoutes.post('/:id/publish', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare(
    `SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ? AND status = 'pending_review'`,
  )
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found_or_not_reviewable' }, 404);

  const counts = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
     FROM questions WHERE exercise_set_id = ?`,
  )
    .bind(id)
    .first<{ total: number; approved: number }>();
  if (!counts || counts.total === 0) return c.json({ error: 'no_questions' }, 400);
  if (counts.approved < counts.total) {
    return c.json({ error: 'all_questions_must_be_approved', approved: counts.approved, total: counts.total }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE exercise_sets SET status = 'published', updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(id)
    .run();
  return c.json({ ok: true });
});

exerciseRoutes.post('/:id/assign', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ childIds?: number[] }>().catch(() => null);
  if (!body || !Array.isArray(body.childIds)) return c.json({ error: 'child_ids_required' }, 400);

  const set = await c.env.DB.prepare(
    'SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

  // Only allow assigning to this parent's own children.
  const children = await c.env.DB.prepare(
    'SELECT id FROM children WHERE parent_id = ?',
  )
    .bind(parentId)
    .all<{ id: number }>();
  const ownIds = new Set(children.results.map((r) => r.id));
  const targetIds = body.childIds.filter((cid) => ownIds.has(cid));

  await c.env.DB.prepare('DELETE FROM assignments WHERE exercise_set_id = ?').bind(id).run();
  if (targetIds.length > 0) {
    await c.env.DB.batch(
      targetIds.map((cid) =>
        c.env.DB.prepare(
          'INSERT INTO assignments (child_id, exercise_set_id) VALUES (?, ?)',
        ).bind(cid, id),
      ),
    );
  }
  return c.json({ ok: true, assignedCount: targetIds.length });
});

exerciseRoutes.delete('/:id', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));

  // Get the R2 key before deleting
  const set = await c.env.DB.prepare(
    'SELECT source_image_r2_key FROM exercise_sets WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first<{ source_image_r2_key: string }>();
  if (!set) return c.json({ error: 'not_found' }, 404);

  // Delete the image from R2
  await c.env.WORKSHEETS.delete(set.source_image_r2_key);

  // Hard delete: remove all questions first (cascade not guaranteed), then the set
  await c.env.DB.prepare('DELETE FROM questions WHERE exercise_set_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM assignments WHERE exercise_set_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM exercise_sets WHERE id = ?').bind(id).run();

  return c.json({ ok: true });
});
