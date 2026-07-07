import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { parseImportedJson } from '../lib/json-import';
import { insertDraftQuestions, resolveSubjectId } from '../lib/exercise-sets';

// Public "push" channel: any external AI/agent holding a parent's ingest token
// can POST exercise JSON here directly (no browser session). The set lands in
// 'pending_review' owned by that parent and is NEVER auto-published, so the
// human review + approve + assign + track flow is exactly the same as an upload.
// Auth is the unguessable token in the path — the endpoint holds no user data
// and exposes nothing without a valid token.
export const ingestRoutes = new Hono<AppEnv>();

const MAX_BODY_BYTES = 512 * 1024; // a worksheet's JSON is well under this
const MAX_QUESTIONS = 200;

ingestRoutes.post('/:token', async (c) => {
  const token = c.req.param('token');
  // Cheap reject before touching the DB; real tokens are 24-byte base64url (~32 chars).
  if (!token || token.length < 16) return c.json({ error: 'unauthorized' }, 401);

  const parent = await c.env.DB.prepare('SELECT id FROM parents WHERE ingest_token = ?')
    .bind(token)
    .first<{ id: number }>();
  if (!parent) return c.json({ error: 'unauthorized' }, 401);

  const raw = await c.req.text();
  if (!raw.trim()) return c.json({ error: 'empty_body' }, 400);
  if (raw.length > MAX_BODY_BYTES) return c.json({ error: 'payload_too_large', max: MAX_BODY_BYTES }, 413);

  // Same tolerant parser the paste flow uses: strips code fences / stray prose
  // and repairs light JSON damage before validating against our schema.
  const imported = parseImportedJson(raw);
  if (!imported.ok) return c.json({ error: 'invalid_questions_json', message: imported.error }, 400);
  if (imported.questions.length > MAX_QUESTIONS) {
    return c.json({ error: 'too_many_questions', max: MAX_QUESTIONS }, 400);
  }

  // Optional overrides via query string — the human composes the ingest URL, so
  // they carry the age band / subject the AI can't know (e.g. ?ageBand=young&subject=คณิตศาสตร์).
  const ageBand = c.req.query('ageBand') === 'young' ? 'young' : 'older';
  const title = imported.title || 'ชุดจาก AI (ยังไม่ตั้งชื่อ)';
  const subjectId = await resolveSubjectId(c.env.DB, parent.id, c.req.query('subject'));

  // No source photo in the push flow — source_image_r2_key is a legacy NOT NULL
  // column, so store an empty string (same convention as shared-set import).
  const result = await c.env.DB.prepare(
    `INSERT INTO exercise_sets (parent_id, subject_id, title, age_band, source_image_r2_key, source_image_content_type, status)
     VALUES (?, ?, ?, ?, '', 'image/jpeg', 'pending_review')`,
  )
    .bind(parent.id, subjectId, title, ageBand)
    .run();
  const setId = result.meta.last_row_id as number;

  await insertDraftQuestions(c.env.DB, setId, imported.questions);

  return c.json(
    { id: setId, status: 'pending_review', title, ageBand, questionCount: imported.questions.length },
    201,
  );
});
