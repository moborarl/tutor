import { Hono } from 'hono';
import type { AppEnv } from '../env';
import type { ExtractedQuestion } from '@shared/types';

// Endpoints for the Raspberry Pi extraction service (bearer-token auth).
export const internalRoutes = new Hono<AppEnv>();

// Claim pending extraction jobs. Rows are flipped to 'extracting' atomically
// as they're handed out so a second poll doesn't double-claim them.
internalRoutes.get('/pending-extractions', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, age_band, source_image_content_type FROM exercise_sets
     WHERE status = 'processing' ORDER BY created_at LIMIT 3`,
  ).all<{ id: number; age_band: string; source_image_content_type: string }>();

  if (rows.results.length > 0) {
    await c.env.DB.batch(
      rows.results.map((r) =>
        c.env.DB
          .prepare(
            `UPDATE exercise_sets SET status = 'extracting', updated_at = datetime('now') WHERE id = ? AND status = 'processing'`,
          )
          .bind(r.id),
      ),
    );
  }
  return c.json(
    rows.results.map((r) => ({
      exerciseSetId: r.id,
      ageBand: r.age_band,
      contentType: r.source_image_content_type,
    })),
  );
});

// Stale-job recovery: jobs stuck in 'extracting' for over an hour are
// re-queued (e.g. the Pi crashed mid-job). Called by the Pi at startup.
internalRoutes.post('/requeue-stale', async (c) => {
  const result = await c.env.DB.prepare(
    `UPDATE exercise_sets SET status = 'processing', updated_at = datetime('now')
     WHERE status = 'extracting' AND updated_at < datetime('now', '-1 hour')`,
  ).run();
  return c.json({ requeued: result.meta.changes });
});

internalRoutes.get('/exercise-sets/:id/image', async (c) => {
  const id = Number(c.req.param('id'));
  const set = await c.env.DB.prepare(
    'SELECT source_image_r2_key, source_image_content_type FROM exercise_sets WHERE id = ?',
  )
    .bind(id)
    .first<{ source_image_r2_key: string; source_image_content_type: string }>();
  if (!set) return c.json({ error: 'not_found' }, 404);
  const obj = await c.env.WORKSHEETS.get(set.source_image_r2_key);
  if (!obj) return c.json({ error: 'image_missing' }, 404);
  return new Response(obj.body, {
    headers: { 'content-type': set.source_image_content_type },
  });
});

internalRoutes.post('/extraction-result', async (c) => {
  const body = await c.req
    .json<{ exerciseSetId?: number; questions?: ExtractedQuestion[]; title?: string; error?: string }>()
    .catch(() => null);
  if (!body?.exerciseSetId) return c.json({ error: 'invalid_body' }, 400);

  const set = await c.env.DB.prepare(
    `SELECT id FROM exercise_sets WHERE id = ? AND status = 'extracting'`,
  )
    .bind(body.exerciseSetId)
    .first();
  if (!set) return c.json({ error: 'not_found_or_not_extracting' }, 404);

  if (body.error || !Array.isArray(body.questions) || body.questions.length === 0) {
    await c.env.DB.prepare(
      `UPDATE exercise_sets SET status = 'extraction_failed', extraction_error = ?, extraction_provider = 'pi', updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(body.error ?? 'pi returned no questions', body.exerciseSetId)
      .run();
    return c.json({ ok: true, recorded: 'failure' });
  }

  const valid = body.questions.filter(
    (q) =>
      q &&
      ['multiple_choice', 'fill_blank', 'matching', 'true_false'].includes(q.questionType) &&
      typeof q.prompt === 'string' &&
      q.prompt.trim(),
  );
  if (valid.length === 0) {
    await c.env.DB.prepare(
      `UPDATE exercise_sets SET status = 'extraction_failed', extraction_error = 'pi returned no valid questions', extraction_provider = 'pi', updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(body.exerciseSetId)
      .run();
    return c.json({ ok: true, recorded: 'failure' });
  }

  await c.env.DB.batch(
    valid.map((q, i) =>
      c.env.DB
        .prepare(
          `INSERT INTO questions (exercise_set_id, order_index, question_type, prompt, content_json, answer_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          body.exerciseSetId,
          i,
          q.questionType,
          q.prompt.trim(),
          JSON.stringify(q.content ?? {}),
          JSON.stringify(q.answer ?? {}),
        ),
    ),
  );
  await c.env.DB.prepare(
    `UPDATE exercise_sets SET status = 'pending_review', extraction_provider = 'pi', extraction_error = NULL,
     title = CASE WHEN title = '' THEN ? ELSE title END, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(body.title ?? '', body.exerciseSetId)
    .run();
  return c.json({ ok: true, recorded: 'success', questionCount: valid.length });
});
