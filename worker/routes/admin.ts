import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const adminRoutes = new Hono<AppEnv>();

async function auditAdminAction(
  env: AppEnv['Bindings'],
  parentId: number,
  action: string,
  targetType: string,
  targetId: string | number | null,
  detail: Record<string, unknown> = {},
) {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (actor_type, actor_parent_id, action, target_type, target_id, detail_json)
       VALUES ('parent', ?, ?, ?, ?, ?)`,
    )
      .bind(parentId, action, targetType, targetId == null ? null : String(targetId), JSON.stringify(detail))
      .run();
  } catch (err) {
    console.warn('admin audit log failed', err);
  }
}

async function listParentR2(env: AppEnv['Bindings'], parentId: number) {
  const prefix = `worksheets/${parentId}/`;
  let cursor: string | undefined;
  let objectCount = 0;
  let totalBytes = 0;
  do {
    const page = await env.WORKSHEETS.list({ prefix, cursor });
    for (const obj of page.objects) {
      objectCount += 1;
      totalBytes += obj.size;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { objectCount, totalBytes };
}

function r2FileRow(obj: R2Object) {
  return {
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  };
}

async function deleteSet(db: D1Database, bucket: R2Bucket, parentId: number, setId: number) {
  const set = await db.prepare('SELECT source_image_r2_key FROM exercise_sets WHERE id = ? AND parent_id = ?')
    .bind(setId, parentId)
    .first<{ source_image_r2_key: string }>();
  if (!set) return false;

  const images = await db.prepare('SELECT r2_key FROM exercise_images WHERE exercise_set_id = ?')
    .bind(setId)
    .all<{ r2_key: string }>();
  const r2Keys = new Set([set.source_image_r2_key, ...images.results.map((img) => img.r2_key)].filter(Boolean));
  await Promise.all([...r2Keys].map((key) => bucket.delete(key)));

  const attempts = await db.prepare('SELECT id FROM attempts WHERE exercise_set_id = ?')
    .bind(setId)
    .all<{ id: number }>();
  for (const row of attempts.results) {
    await db.prepare('DELETE FROM attempt_answers WHERE attempt_id = ?').bind(row.id).run();
  }
  await db.prepare('DELETE FROM attempts WHERE exercise_set_id = ?').bind(setId).run();
  await db.prepare('DELETE FROM assignments WHERE exercise_set_id = ?').bind(setId).run();
  await db.prepare('DELETE FROM questions WHERE exercise_set_id = ?').bind(setId).run();
  await db.prepare('DELETE FROM exercise_images WHERE exercise_set_id = ?').bind(setId).run();
  await db.prepare('DELETE FROM exercise_sets WHERE id = ?').bind(setId).run();
  return true;
}

async function deleteChild(db: D1Database, parentId: number, childId: number) {
  const child = await db.prepare('SELECT id FROM children WHERE id = ? AND parent_id = ?')
    .bind(childId, parentId)
    .first();
  if (!child) return false;

  await db.prepare(`
    DELETE FROM attempt_answers
    WHERE attempt_id IN (SELECT id FROM attempts WHERE child_id = ?)
  `)
    .bind(childId)
    .run();
  await db.prepare('DELETE FROM attempts WHERE child_id = ?').bind(childId).run();
  await db.prepare('DELETE FROM assignments WHERE child_id = ?').bind(childId).run();
  await db.prepare('DELETE FROM children WHERE id = ?').bind(childId).run();
  return true;
}

adminRoutes.get('/summary', async (c) => {
  const { parentId } = c.get('session');
  const counts = await c.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM children WHERE parent_id = ?) AS child_count,
      (SELECT COUNT(*) FROM subjects WHERE parent_id = ?) AS subject_count,
      (SELECT COUNT(*) FROM exercise_sets WHERE parent_id = ?) AS set_count,
      (SELECT COUNT(*) FROM exercise_sets WHERE parent_id = ? AND status = 'archived') AS archived_set_count,
      (SELECT COUNT(*) FROM questions q JOIN exercise_sets es ON es.id = q.exercise_set_id WHERE es.parent_id = ?) AS question_count,
      (SELECT COUNT(*) FROM attempts a JOIN children ch ON ch.id = a.child_id WHERE ch.parent_id = ?) AS attempt_count,
      (SELECT COUNT(*) FROM attempt_answers aa JOIN attempts a ON a.id = aa.attempt_id JOIN children ch ON ch.id = a.child_id WHERE ch.parent_id = ?) AS answer_count,
      (SELECT COUNT(*) FROM exercise_images ei JOIN exercise_sets es ON es.id = ei.exercise_set_id WHERE es.parent_id = ?) AS image_count`,
  )
    .bind(parentId, parentId, parentId, parentId, parentId, parentId, parentId, parentId)
    .first();

  const sets = await c.env.DB.prepare(
    `SELECT es.id, es.title, es.status, es.age_band, s.name AS subject_name,
            (SELECT COUNT(*) FROM questions q WHERE q.exercise_set_id = es.id) AS question_count,
            (SELECT COUNT(*) FROM assignments a WHERE a.exercise_set_id = es.id) AS assigned_count
     FROM exercise_sets es LEFT JOIN subjects s ON s.id = es.subject_id
     WHERE es.parent_id = ?
     ORDER BY es.created_at DESC`,
  )
    .bind(parentId)
    .all();

  const children = await c.env.DB.prepare(
    `SELECT ch.id, ch.name, ch.avatar, ch.age_band,
            (SELECT COUNT(*) FROM assignments a WHERE a.child_id = ch.id) AS assigned_count,
            (SELECT COUNT(*) FROM attempts a WHERE a.child_id = ch.id) AS attempt_count,
            (SELECT AVG(score) FROM attempts a WHERE a.child_id = ch.id AND a.status = 'completed') AS avg_score
     FROM children ch WHERE ch.parent_id = ? ORDER BY ch.id`,
  )
    .bind(parentId)
    .all();

  const r2 = await listParentR2(c.env, parentId);
  return c.json({
    counts: {
      children: Number(counts?.child_count ?? 0),
      subjects: Number(counts?.subject_count ?? 0),
      exerciseSets: Number(counts?.set_count ?? 0),
      archivedSets: Number(counts?.archived_set_count ?? 0),
      questions: Number(counts?.question_count ?? 0),
      attempts: Number(counts?.attempt_count ?? 0),
      answers: Number(counts?.answer_count ?? 0),
      images: Number(counts?.image_count ?? 0),
      r2Objects: r2.objectCount,
      r2Bytes: r2.totalBytes,
    },
    sets: sets.results.map((s) => ({
      id: Number(s.id),
      title: String(s.title ?? ''),
      status: String(s.status ?? ''),
      ageBand: String(s.age_band ?? ''),
      subjectName: s.subject_name == null ? null : String(s.subject_name),
      questionCount: Number(s.question_count ?? 0),
      assignedCount: Number(s.assigned_count ?? 0),
    })),
    children: children.results.map((ch) => ({
      id: Number(ch.id),
      name: String(ch.name ?? ''),
      avatar: String(ch.avatar ?? ''),
      ageBand: String(ch.age_band ?? ''),
      assignedCount: Number(ch.assigned_count ?? 0),
      attemptCount: Number(ch.attempt_count ?? 0),
      averageScore: ch.avg_score == null ? null : Number(ch.avg_score),
    })),
  });
});

adminRoutes.get('/r2-files', async (c) => {
  const { parentId } = c.get('session');
  const cursor = c.req.query('cursor') || undefined;
  const page = await c.env.WORKSHEETS.list({
    prefix: `worksheets/${parentId}/`,
    cursor,
    limit: 50,
  });
  return c.json({
    files: page.objects.map(r2FileRow),
    cursor: page.truncated ? page.cursor : null,
  });
});

adminRoutes.delete('/r2-files', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{ key?: string; keys?: unknown }>().catch(() => null);
  const rawKeys = Array.isArray(body?.keys) ? body.keys : body?.key ? [body.key] : [];
  const keys = [...new Set(rawKeys.filter((key): key is string => typeof key === 'string' && key.length > 0))];
  if (keys.length === 0) return c.json({ error: 'invalid_keys' }, 400);
  if (keys.length > 100) return c.json({ error: 'too_many_keys' }, 400);
  if (keys.some((key) => !key.startsWith(`worksheets/${parentId}/`))) return c.json({ error: 'not_allowed' }, 403);
  await Promise.all(keys.map((key) => c.env.WORKSHEETS.delete(key)));
  await auditAdminAction(c.env, parentId, 'delete_r2_files', 'r2_file', null, { count: keys.length, keys });
  return c.json({ ok: true, deleted: keys.length });
});

adminRoutes.delete('/attempts', async (c) => {
  const { parentId } = c.get('session');
  await c.env.DB.prepare(`
    DELETE FROM attempt_answers
    WHERE attempt_id IN (
      SELECT a.id FROM attempts a JOIN children ch ON ch.id = a.child_id WHERE ch.parent_id = ?
    )
  `)
    .bind(parentId)
    .run();
  await c.env.DB.prepare(`
    DELETE FROM attempts
    WHERE child_id IN (SELECT id FROM children WHERE parent_id = ?)
  `)
    .bind(parentId)
    .run();
  await auditAdminAction(c.env, parentId, 'delete_attempts', 'attempts', null);
  return c.json({ ok: true });
});

adminRoutes.delete('/exercise-sets', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{ ids?: unknown }>().catch(() => null);
  if (!Array.isArray(body?.ids)) return c.json({ error: 'invalid_ids' }, 400);

  const ids = [...new Set(body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return c.json({ error: 'invalid_ids' }, 400);
  if (ids.length > 100) return c.json({ error: 'too_many_ids' }, 400);

  let deleted = 0;
  for (const id of ids) {
    if (await deleteSet(c.env.DB, c.env.WORKSHEETS, parentId, id)) deleted += 1;
  }
  await auditAdminAction(c.env, parentId, 'delete_exercise_sets', 'exercise_set', null, { requested: ids.length, deleted, ids });
  return c.json({ ok: true, deleted });
});

adminRoutes.delete('/exercise-sets/:id', async (c) => {
  const { parentId } = c.get('session');
  const ok = await deleteSet(c.env.DB, c.env.WORKSHEETS, parentId, Number(c.req.param('id')));
  if (!ok) return c.json({ error: 'not_found' }, 404);
  await auditAdminAction(c.env, parentId, 'delete_exercise_set', 'exercise_set', c.req.param('id'));
  return c.json({ ok: true });
});

adminRoutes.delete('/children/:id', async (c) => {
  const { parentId } = c.get('session');
  const ok = await deleteChild(c.env.DB, parentId, Number(c.req.param('id')));
  if (!ok) return c.json({ error: 'not_found' }, 404);
  await auditAdminAction(c.env, parentId, 'delete_child', 'child', c.req.param('id'));
  return c.json({ ok: true });
});
