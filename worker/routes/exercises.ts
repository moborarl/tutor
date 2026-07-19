import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { runCloudExtraction } from '../lib/ai-providers';
import { parseImportedJson } from '../lib/json-import';
import { insertDraftQuestions } from '../lib/exercise-sets';
import { randomId } from '../lib/crypto';

export const exerciseRoutes = new Hono<AppEnv>();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

// Create a worksheet set from parent-provided JSON (extracted by the parent using a
// free external AI chat, e.g. ChatGPT/Claude/Gemini web) -> R2 photo kept for reference,
// questions inserted directly as drafts ready for review.
exerciseRoutes.post('/', async (c) => {
  try {
    const { parentId } = c.get('session');
    const form = await c.req.formData().catch(() => null);
    if (!form) return c.json({ error: 'multipart_required' }, 400);

    // workers-types FormData.getAll is typed as string[], but binary parts arrive as File at runtime
    const files = (form.getAll('images') as unknown[]).filter((f): f is File => f instanceof File);
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) return c.json({ error: 'unsupported_image_type' }, 400);
      if (f.size > MAX_UPLOAD_BYTES) return c.json({ error: 'image_too_large' }, 400);
    }

    const questionsJsonRaw = form.get('questionsJson');
    if (typeof questionsJsonRaw !== 'string' || !questionsJsonRaw.trim()) {
      return c.json({ error: 'questions_json_required' }, 400);
    }
    const imported = parseImportedJson(questionsJsonRaw);
    if (!imported.ok) {
      return c.json({ error: 'invalid_questions_json', message: imported.error }, 400);
    }

    const ageBand = form.get('ageBand') === 'young' ? 'young' : 'older';
    const titleRaw = typeof form.get('title') === 'string' ? (form.get('title') as string).trim() : '';
    const title = titleRaw || imported.title;
    const subjectIdRaw = form.get('subjectId');
    const subjectId = subjectIdRaw && !isNaN(Number(subjectIdRaw)) ? Number(subjectIdRaw) : null;

    const uploaded: { r2Key: string; contentType: string }[] = [];
    for (const f of files) {
      const r2Key = `worksheets/${parentId}/${randomId(12)}`;
      await c.env.WORKSHEETS.put(r2Key, await f.arrayBuffer(), {
        httpMetadata: { contentType: f.type },
      });
      uploaded.push({ r2Key, contentType: f.type });
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO exercise_sets (parent_id, subject_id, title, age_band, source_image_r2_key, source_image_content_type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_review')`,
    )
      .bind(parentId, subjectId, title, ageBand, uploaded[0]?.r2Key ?? '', uploaded[0]?.contentType ?? 'image/jpeg')
      .run();
    const setId = result.meta.last_row_id as number;

    if (uploaded.length > 0) {
      await c.env.DB.batch(
        uploaded.map((u, i) =>
          c.env.DB.prepare(
            `INSERT INTO exercise_images (exercise_set_id, r2_key, content_type, order_index) VALUES (?, ?, ?, ?)`,
          ).bind(setId, u.r2Key, u.contentType, i),
        ),
      );
    }

    // Map each question's 1-indexed "imagePage" (upload order) to the row id we
    // just inserted, so questions.image_id can point at the right photo.
    const insertedImages = await c.env.DB.prepare(
      'SELECT id, order_index FROM exercise_images WHERE exercise_set_id = ? ORDER BY order_index',
    )
      .bind(setId)
      .all<{ id: number; order_index: number }>();
    const pageToImageId = new Map(insertedImages.results.map((img) => [img.order_index + 1, img.id]));

    await insertDraftQuestions(c.env.DB, setId, imported.questions, pageToImageId);

    return c.json({ id: setId, status: 'pending_review' }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('Upload error:', message, stack);
    return c.json({ error: 'upload_failed', message }, 500);
  }
});

// Merge two or more of this parent's exercise sets into one. The set with the
// smallest id is kept as the target; the rest are folded into it (questions and
// worksheet pages re-parented, assignments unioned) and then removed. The
// merged set goes back to 'pending_review' since its contents changed.
exerciseRoutes.post('/merge', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{ setIds?: number[]; title?: string }>().catch(() => null);
  if (!body || !Array.isArray(body.setIds) || body.setIds.length < 2) {
    return c.json({ error: 'need_at_least_two_sets' }, 400);
  }

  const ids = [...new Set(body.setIds.map(Number))];
  const placeholders = ids.map(() => '?').join(',');
  const owned = await c.env.DB.prepare(
    `SELECT id FROM exercise_sets WHERE parent_id = ? AND id IN (${placeholders})`,
  )
    .bind(parentId, ...ids)
    .all<{ id: number }>();
  if (owned.results.length !== ids.length) return c.json({ error: 'not_found' }, 404);

  const targetId = Math.min(...ids);
  const sourceIds = ids.filter((sid) => sid !== targetId);

  for (const sourceId of sourceIds) {
    const [maxQ, maxImg] = await Promise.all([
      c.env.DB.prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM questions WHERE exercise_set_id = ?')
        .bind(targetId)
        .first<{ m: number }>(),
      c.env.DB.prepare('SELECT COALESCE(MAX(order_index), -1) AS m FROM exercise_images WHERE exercise_set_id = ?')
        .bind(targetId)
        .first<{ m: number }>(),
    ]);
    const qOffset = (maxQ?.m ?? -1) + 1;
    const imgOffset = (maxImg?.m ?? -1) + 1;

    await c.env.DB.prepare(
      `UPDATE exercise_images SET exercise_set_id = ?, order_index = order_index + ? WHERE exercise_set_id = ?`,
    )
      .bind(targetId, imgOffset, sourceId)
      .run();
    await c.env.DB.prepare(
      `UPDATE questions SET exercise_set_id = ?, order_index = order_index + ? WHERE exercise_set_id = ?`,
    )
      .bind(targetId, qOffset, sourceId)
      .run();
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO assignments (child_id, exercise_set_id)
       SELECT child_id, ? FROM assignments WHERE exercise_set_id = ?`,
    )
      .bind(targetId, sourceId)
      .run();
    await c.env.DB.prepare('DELETE FROM assignments WHERE exercise_set_id = ?').bind(sourceId).run();
    await c.env.DB.prepare('DELETE FROM exercise_sets WHERE id = ?').bind(sourceId).run();
  }

  const updates: string[] = [`status = 'pending_review'`, `extraction_error = NULL`, `updated_at = datetime('now')`];
  const values: unknown[] = [];
  if (typeof body.title === 'string' && body.title.trim()) {
    updates.push('title = ?');
    values.push(body.title.trim());
  }
  await c.env.DB.prepare(`UPDATE exercise_sets SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values, targetId)
    .run();

  return c.json({ id: targetId, status: 'pending_review' });
});

exerciseRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const rows = await c.env.DB.prepare(
    `SELECT es.id, es.title, es.subject_id, s.name AS subject_name, es.age_band, es.status, es.learning_mode,
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
      learningMode: r.learning_mode,
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
    `SELECT es.id, es.title, es.subject_id, s.name AS subject_name, es.age_band, es.status, es.learning_mode,
            es.extraction_provider, es.extraction_error, es.created_at
     FROM exercise_sets es LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE es.id = ? AND es.parent_id = ?`,
  )
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

  const questions = await c.env.DB.prepare(
    `SELECT id, order_index, question_type, prompt, content_json, answer_json, status, explanation, image_id, diagram_json,
            difficulty, learning_objective, reasoning_prompt, reasoning_rubric_json
     FROM questions WHERE exercise_set_id = ? ORDER BY order_index, id`,
  )
    .bind(id)
    .all();
  const assigned = await c.env.DB.prepare(
    'SELECT child_id FROM assignments WHERE exercise_set_id = ?',
  )
    .bind(id)
    .all<{ child_id: number }>();
  const images = await c.env.DB.prepare(
    'SELECT id, order_index FROM exercise_images WHERE exercise_set_id = ? ORDER BY order_index, id',
  )
    .bind(id)
    .all<{ id: number; order_index: number }>();

  return c.json({
    id: set.id,
    title: set.title,
    subjectId: set.subject_id,
    subjectName: set.subject_name,
    ageBand: set.age_band,
    status: set.status,
    learningMode: set.learning_mode,
    extractionProvider: set.extraction_provider,
    extractionError: set.extraction_error,
    createdAt: set.created_at,
    questionCount: questions.results.length,
    assignedChildIds: assigned.results.map((a) => a.child_id),
    images: images.results.map((img) => ({ id: img.id, orderIndex: img.order_index })),
    questions: questions.results.map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      questionType: q.question_type,
      prompt: q.prompt,
      content: JSON.parse(q.content_json as string),
      answer: JSON.parse(q.answer_json as string),
      status: q.status,
      explanation: q.explanation ?? null,
      imageId: q.image_id ?? null,
      diagram: q.diagram_json ? JSON.parse(q.diagram_json as string) : null,
      difficulty: q.difficulty ?? null,
      learningObjective: q.learning_objective ?? null,
      reasoningPrompt: q.reasoning_prompt ?? null,
      reasoningRubric: q.reasoning_rubric_json ? JSON.parse(q.reasoning_rubric_json as string) : null,
    })),
  });
});

// Upload a new photo (e.g. a crop the parent made from an existing page) as an
// additional worksheet page, so it can be assigned to a question via imageId.
exerciseRoutes.post('/:id/images', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare('SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ?')
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'multipart_required' }, 400);
  const file = form.get('image') as unknown;
  if (!(file instanceof File)) return c.json({ error: 'image_required' }, 400);
  if (!IMAGE_TYPES.includes(file.type)) return c.json({ error: 'unsupported_image_type' }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'image_too_large' }, 400);

  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(order_index), -1) AS m FROM exercise_images WHERE exercise_set_id = ?',
  )
    .bind(id)
    .first<{ m: number }>();

  const r2Key = `worksheets/${parentId}/${randomId(12)}`;
  await c.env.WORKSHEETS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  const result = await c.env.DB.prepare(
    'INSERT INTO exercise_images (exercise_set_id, r2_key, content_type, order_index) VALUES (?, ?, ?, ?)',
  )
    .bind(id, r2Key, file.type, (maxOrder?.m ?? -1) + 1)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Serve one page of the original uploaded worksheet photos to the parent (review screen).
exerciseRoutes.get('/:id/images/:imageId', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const imageId = Number(c.req.param('imageId'));
  const set = await c.env.DB.prepare('SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ?')
    .bind(id, parentId)
    .first();
  if (!set) return c.json({ error: 'not_found' }, 404);

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
    .json<{ title?: string; subjectId?: number | null; ageBand?: string; learningMode?: string }>()
    .catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  if (body.learningMode !== undefined && body.learningMode !== 'guided' && body.learningMode !== 'exam') {
    return c.json({ error: 'invalid_learning_mode' }, 400);
  }

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
  if (body.learningMode) {
    updates.push('learning_mode = ?');
    values.push(body.learningMode);
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

  const result = await c.env.DB.prepare(
    `UPDATE exercise_sets
     SET status = 'archived', share_token = NULL, updated_at = datetime('now')
     WHERE id = ? AND parent_id = ? AND status != 'archived'`,
  )
    .bind(id, parentId)
    .run();
  if (!result.meta.changes) return c.json({ error: 'not_found' }, 404);

  return c.json({ ok: true, archived: true });
});

// Turn on link-sharing for a set: generate (or reuse) a random token another
// parent can use to copy the set into their own library.
exerciseRoutes.post('/:id/share', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare(
    'SELECT share_token FROM exercise_sets WHERE id = ? AND parent_id = ?',
  )
    .bind(id, parentId)
    .first<{ share_token: string | null }>();
  if (!set) return c.json({ error: 'not_found' }, 404);

  let token = set.share_token;
  if (!token) {
    token = randomId(20);
    await c.env.DB.prepare('UPDATE exercise_sets SET share_token = ? WHERE id = ?')
      .bind(token, id)
      .run();
  }
  return c.json({ token });
});

// Stop sharing (revokes the link).
exerciseRoutes.delete('/:id/share', async (c) => {
  const { parentId } = c.get('session');
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('UPDATE exercise_sets SET share_token = NULL WHERE id = ? AND parent_id = ?')
    .bind(id, parentId)
    .run();
  return c.json({ ok: true });
});
