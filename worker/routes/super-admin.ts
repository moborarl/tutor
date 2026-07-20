import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const superAdminRoutes = new Hono<AppEnv>();

async function auditSuperAdminAction(
  env: AppEnv['Bindings'],
  action: string,
  targetType: string,
  targetId: string | number | null,
  detail: Record<string, unknown> = {},
) {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (actor_type, actor_parent_id, action, target_type, target_id, detail_json)
       VALUES ('super_admin', NULL, ?, ?, ?, ?)`,
    )
      .bind(action, targetType, targetId == null ? null : String(targetId), JSON.stringify(detail))
      .run();
  } catch (err) {
    console.warn('super-admin audit log failed', err);
  }
}

superAdminRoutes.use('*', async (c, next) => {
  const expected = c.env.SUPER_ADMIN_TOKEN;
  const provided = c.req.header('x-super-admin-token') ?? '';
  if (!expected || provided !== expected) return c.json({ error: 'unauthorized' }, 401);
  await next();
});

async function listAllR2(env: AppEnv['Bindings']) {
  let cursor: string | undefined;
  let objectCount = 0;
  let totalBytes = 0;
  do {
    const page = await env.WORKSHEETS.list({ cursor });
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

async function deleteParentData(env: AppEnv['Bindings'], parentId: number) {
  const prefix = `worksheets/${parentId}/`;
  let cursor: string | undefined;
  do {
    const page = await env.WORKSHEETS.list({ prefix, cursor });
    await Promise.all(page.objects.map((obj) => env.WORKSHEETS.delete(obj.key)));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  await env.DB.prepare(`
    DELETE FROM attempt_answers
    WHERE attempt_id IN (
      SELECT a.id FROM attempts a JOIN children ch ON ch.id = a.child_id WHERE ch.parent_id = ?
    )
  `).bind(parentId).run();
  await env.DB.prepare('DELETE FROM attempts WHERE child_id IN (SELECT id FROM children WHERE parent_id = ?)').bind(parentId).run();
  await env.DB.prepare('DELETE FROM assignments WHERE child_id IN (SELECT id FROM children WHERE parent_id = ?)').bind(parentId).run();
  await env.DB.prepare('DELETE FROM children WHERE parent_id = ?').bind(parentId).run();
  await env.DB.prepare('DELETE FROM questions WHERE exercise_set_id IN (SELECT id FROM exercise_sets WHERE parent_id = ?)').bind(parentId).run();
  await env.DB.prepare('DELETE FROM exercise_images WHERE exercise_set_id IN (SELECT id FROM exercise_sets WHERE parent_id = ?)').bind(parentId).run();
  await env.DB.prepare('DELETE FROM exercise_sets WHERE parent_id = ?').bind(parentId).run();
  await env.DB.prepare('DELETE FROM subjects WHERE parent_id = ?').bind(parentId).run();
  await env.DB.prepare('DELETE FROM parent_sessions WHERE parent_id = ?').bind(parentId).run();
  await env.DB.prepare('DELETE FROM parents WHERE id = ?').bind(parentId).run();
}

superAdminRoutes.get('/summary', async (c) => {
  const parents = await c.env.DB.prepare(
    `SELECT p.id, p.email, p.created_at,
            (SELECT COUNT(*) FROM children ch WHERE ch.parent_id = p.id) AS child_count,
            (SELECT COUNT(*) FROM exercise_sets es WHERE es.parent_id = p.id) AS set_count,
            (SELECT COUNT(*) FROM questions q JOIN exercise_sets es ON es.id = q.exercise_set_id WHERE es.parent_id = p.id) AS question_count,
            (SELECT COUNT(*) FROM attempts a JOIN children ch ON ch.id = a.child_id WHERE ch.parent_id = p.id) AS attempt_count
     FROM parents p
     ORDER BY p.created_at DESC`,
  ).all();
  const r2 = await listAllR2(c.env);
  return c.json({
    totals: {
      parents: parents.results.length,
      children: parents.results.reduce((sum, p) => sum + Number(p.child_count ?? 0), 0),
      exerciseSets: parents.results.reduce((sum, p) => sum + Number(p.set_count ?? 0), 0),
      questions: parents.results.reduce((sum, p) => sum + Number(p.question_count ?? 0), 0),
      attempts: parents.results.reduce((sum, p) => sum + Number(p.attempt_count ?? 0), 0),
      r2Objects: r2.objectCount,
      r2Bytes: r2.totalBytes,
    },
    parents: parents.results.map((p) => ({
      id: Number(p.id),
      email: String(p.email ?? ''),
      createdAt: String(p.created_at ?? ''),
      childCount: Number(p.child_count ?? 0),
      exerciseSetCount: Number(p.set_count ?? 0),
      questionCount: Number(p.question_count ?? 0),
      attemptCount: Number(p.attempt_count ?? 0),
    })),
  });
});

superAdminRoutes.get('/telemetry', async (c) => {
  const summary = await c.env.DB.prepare(
    `SELECT event_type, COUNT(*) AS event_count, AVG(value) AS average_value, MAX(created_at) AS last_seen
     FROM telemetry_events
     WHERE created_at >= datetime('now', '-7 days')
     GROUP BY event_type ORDER BY event_type`,
  ).all();
  const recent = await c.env.DB.prepare(
    `SELECT event_type, route, value, detail, created_at
     FROM telemetry_events ORDER BY id DESC LIMIT 20`,
  ).all();
  return c.json({
    summary: summary.results.map((row) => ({
      type: String(row.event_type), count: Number(row.event_count ?? 0),
      averageValue: row.average_value == null ? null : Math.round(Number(row.average_value)),
      lastSeen: row.last_seen == null ? null : String(row.last_seen),
    })),
    recent: recent.results.map((row) => ({
      type: String(row.event_type), route: String(row.route), value: row.value == null ? null : Number(row.value),
      detail: row.detail == null ? null : String(row.detail), createdAt: String(row.created_at),
    })),
  });
});

superAdminRoutes.get('/r2-files', async (c) => {
  const cursor = c.req.query('cursor') || undefined;
  const prefix = c.req.query('prefix') || undefined;
  const page = await c.env.WORKSHEETS.list({ prefix, cursor, limit: 100 });
  return c.json({
    files: page.objects.map(r2FileRow),
    cursor: page.truncated ? page.cursor : null,
  });
});

superAdminRoutes.delete('/r2-files', async (c) => {
  const body = await c.req.json<{ key?: string; confirmKey?: string }>().catch(() => null);
  const key = body?.key ?? '';
  if (!key || body?.confirmKey !== key) return c.json({ error: 'confirmation_required' }, 400);
  await c.env.WORKSHEETS.delete(key);
  await auditSuperAdminAction(c.env, 'delete_r2_file', 'r2_file', key);
  return c.json({ ok: true });
});

superAdminRoutes.delete('/parents/:id', async (c) => {
  const parentId = Number(c.req.param('id'));
  const body = await c.req.json<{ confirmEmail?: string }>().catch(() => null);
  const parent = await c.env.DB.prepare('SELECT email FROM parents WHERE id = ?')
    .bind(parentId)
    .first<{ email: string }>();
  if (!parent) return c.json({ error: 'not_found' }, 404);
  if (!body || body.confirmEmail !== parent.email) {
    return c.json({ error: 'confirmation_required' }, 400);
  }
  await deleteParentData(c.env, parentId);
  await auditSuperAdminAction(c.env, 'delete_parent', 'parent', parentId, { email: parent.email });
  return c.json({ ok: true });
});
