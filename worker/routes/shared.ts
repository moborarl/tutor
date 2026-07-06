import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { randomId } from '../lib/crypto';

export const sharedRoutes = new Hono<AppEnv>();

// Preview a shared set by its token (before the receiving parent commits to
// copying it). Requires a parent session but not ownership.
sharedRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');
  const set = await c.env.DB.prepare(
    `SELECT es.title, es.age_band, s.name AS subject_name,
            (SELECT COUNT(*) FROM questions q WHERE q.exercise_set_id = es.id) AS question_count
     FROM exercise_sets es LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE es.share_token = ?`,
  )
    .bind(token)
    .first<{ title: string; age_band: string; subject_name: string | null; question_count: number }>();
  if (!set) return c.json({ error: 'not_found' }, 404);
  return c.json({
    title: set.title,
    ageBand: set.age_band,
    subjectName: set.subject_name,
    questionCount: set.question_count,
  });
});

// Copy a shared set into the current parent's own library — a full independent
// copy (new set + questions + duplicated R2 images), so the receiver can edit,
// assign, and delete it without affecting the original owner.
sharedRoutes.post('/:token/import', async (c) => {
  const { parentId } = c.get('session');
  const token = c.req.param('token');

  const src = await c.env.DB.prepare(
    `SELECT es.id, es.title, es.age_band, es.source_image_content_type,
            s.name AS subject_name
     FROM exercise_sets es LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE es.share_token = ?`,
  )
    .bind(token)
    .first<{ id: number; title: string; age_band: string; source_image_content_type: string; subject_name: string | null }>();
  if (!src) return c.json({ error: 'not_found' }, 404);

  // Map the subject by name into the receiver's own subjects (reuse if they
  // already have one with that name, otherwise create it).
  let newSubjectId: number | null = null;
  if (src.subject_name) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM subjects WHERE parent_id = ? AND name = ?',
    )
      .bind(parentId, src.subject_name)
      .first<{ id: number }>();
    if (existing) {
      newSubjectId = existing.id;
    } else {
      const created = await c.env.DB.prepare(
        'INSERT INTO subjects (parent_id, name) VALUES (?, ?)',
      )
        .bind(parentId, src.subject_name)
        .run();
      newSubjectId = created.meta.last_row_id as number;
    }
  }

  // Duplicate the worksheet images into new R2 objects owned by the receiver,
  // building a map from old exercise_images.id -> new id so questions can be
  // re-pointed.
  const srcImages = await c.env.DB.prepare(
    'SELECT id, r2_key, content_type, order_index FROM exercise_images WHERE exercise_set_id = ? ORDER BY order_index',
  )
    .bind(src.id)
    .all<{ id: number; r2_key: string; content_type: string; order_index: number }>();

  const copiedImages: { oldId: number; r2Key: string; contentType: string; orderIndex: number }[] = [];
  for (const img of srcImages.results) {
    const obj = await c.env.WORKSHEETS.get(img.r2_key);
    if (!obj) continue; // skip a missing source image rather than failing the whole import
    const newKey = `worksheets/${parentId}/${randomId(12)}`;
    await c.env.WORKSHEETS.put(newKey, await obj.arrayBuffer(), {
      httpMetadata: { contentType: img.content_type },
    });
    copiedImages.push({ oldId: img.id, r2Key: newKey, contentType: img.content_type, orderIndex: img.order_index });
  }

  // Create the new set (owned by the receiver, published & ready to assign,
  // never itself shared). source_image_r2_key is a legacy column — point it at
  // the first copied image, or empty string when there are no images.
  const firstKey = copiedImages[0]?.r2Key ?? '';
  const setResult = await c.env.DB.prepare(
    `INSERT INTO exercise_sets (parent_id, subject_id, title, age_band, source_image_r2_key, source_image_content_type, status)
     VALUES (?, ?, ?, ?, ?, ?, 'published')`,
  )
    .bind(parentId, newSubjectId, src.title, src.age_band, firstKey, src.source_image_content_type)
    .run();
  const newSetId = setResult.meta.last_row_id as number;

  // Insert copied images and build old->new id map.
  const oldToNewImageId = new Map<number, number>();
  for (const img of copiedImages) {
    const r = await c.env.DB.prepare(
      'INSERT INTO exercise_images (exercise_set_id, r2_key, content_type, order_index) VALUES (?, ?, ?, ?)',
    )
      .bind(newSetId, img.r2Key, img.contentType, img.orderIndex)
      .run();
    oldToNewImageId.set(img.oldId, r.meta.last_row_id as number);
  }

  // Copy questions verbatim (keeping approved status so the set is publishable),
  // re-pointing image_id through the map.
  const srcQuestions = await c.env.DB.prepare(
    `SELECT order_index, question_type, prompt, content_json, answer_json, explanation, image_id, diagram_json
     FROM questions WHERE exercise_set_id = ? ORDER BY order_index, id`,
  )
    .bind(src.id)
    .all<{
      order_index: number;
      question_type: string;
      prompt: string;
      content_json: string;
      answer_json: string;
      explanation: string | null;
      image_id: number | null;
      diagram_json: string | null;
    }>();

  if (srcQuestions.results.length > 0) {
    await c.env.DB.batch(
      srcQuestions.results.map((q) =>
        c.env.DB.prepare(
          `INSERT INTO questions (exercise_set_id, order_index, question_type, prompt, content_json, answer_json, explanation, image_id, diagram_json, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
        ).bind(
          newSetId,
          q.order_index,
          q.question_type,
          q.prompt,
          q.content_json,
          q.answer_json,
          q.explanation,
          q.image_id != null ? oldToNewImageId.get(q.image_id) ?? null : null,
          q.diagram_json,
        ),
      ),
    );
  }

  return c.json({ id: newSetId }, 201);
});
