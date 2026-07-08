import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hashSecret, verifySecret } from '../lib/crypto';

export const profileRoutes = new Hono<AppEnv>();

function fallbackFamilyName(email: string) {
  const local = email.split('@')[0] || 'Family';
  return `${local} family`;
}

profileRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const parent = await c.env.DB.prepare(
    `SELECT id, email, family_name, created_at FROM parents WHERE id = ?`,
  )
    .bind(parentId)
    .first<{ id: number; email: string; family_name: string | null; created_at: string }>();
  if (!parent) return c.json({ error: 'not_found' }, 404);

  const counts = await c.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM children WHERE parent_id = ?) AS child_count,
      (SELECT COUNT(*) FROM subjects WHERE parent_id = ?) AS subject_count,
      (SELECT COUNT(*) FROM exercise_sets WHERE parent_id = ? AND status != 'archived') AS active_set_count,
      (SELECT COUNT(*) FROM exercise_sets WHERE parent_id = ? AND status = 'published') AS published_set_count,
      (SELECT COUNT(*) FROM exercise_sets WHERE parent_id = ? AND status = 'pending_review') AS review_set_count,
      (SELECT COUNT(*) FROM attempts a JOIN children ch ON ch.id = a.child_id WHERE ch.parent_id = ? AND a.status = 'completed') AS completed_attempt_count`,
  )
    .bind(parentId, parentId, parentId, parentId, parentId, parentId)
    .first();

  const children = await c.env.DB.prepare(
    `SELECT ch.id, ch.name, ch.avatar, ch.age_band,
            (SELECT COUNT(*) FROM assignments a WHERE a.child_id = ch.id) AS assigned_count,
            (SELECT COUNT(*) FROM attempts a WHERE a.child_id = ch.id AND a.status = 'completed') AS completed_count
     FROM children ch
     WHERE ch.parent_id = ?
     ORDER BY ch.id
     LIMIT 8`,
  )
    .bind(parentId)
    .all();

  return c.json({
    id: parent.id,
    email: parent.email,
    familyName: parent.family_name || fallbackFamilyName(parent.email),
    createdAt: parent.created_at,
    counts: {
      children: Number(counts?.child_count ?? 0),
      subjects: Number(counts?.subject_count ?? 0),
      activeExerciseSets: Number(counts?.active_set_count ?? 0),
      publishedExerciseSets: Number(counts?.published_set_count ?? 0),
      pendingReviewSets: Number(counts?.review_set_count ?? 0),
      completedAttempts: Number(counts?.completed_attempt_count ?? 0),
    },
    children: children.results.map((ch) => ({
      id: Number(ch.id),
      name: String(ch.name ?? ''),
      avatar: String(ch.avatar ?? ''),
      ageBand: String(ch.age_band ?? ''),
      assignedCount: Number(ch.assigned_count ?? 0),
      completedCount: Number(ch.completed_count ?? 0),
    })),
  });
});

profileRoutes.patch('/', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{ familyName?: string }>().catch(() => null);
  const familyName = body?.familyName?.trim() ?? '';
  if (familyName.length < 2) return c.json({ error: 'family_name_required' }, 400);
  if (familyName.length > 80) return c.json({ error: 'family_name_too_long' }, 400);

  await c.env.DB.prepare('UPDATE parents SET family_name = ? WHERE id = ?')
    .bind(familyName, parentId)
    .run();
  return c.json({ ok: true, familyName });
});

profileRoutes.post('/password', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>().catch(() => null);
  const currentPassword = body?.currentPassword ?? '';
  const newPassword = body?.newPassword ?? '';
  if (!currentPassword || !newPassword) return c.json({ error: 'missing_fields' }, 400);
  if (newPassword.length < 8) return c.json({ error: 'password_too_short' }, 400);
  if (currentPassword === newPassword) return c.json({ error: 'password_unchanged' }, 400);

  const parent = await c.env.DB.prepare('SELECT password_hash FROM parents WHERE id = ?')
    .bind(parentId)
    .first<{ password_hash: string }>();
  if (!parent || !(await verifySecret(currentPassword, parent.password_hash))) {
    return c.json({ error: 'invalid_current_password' }, 401);
  }

  const nextHash = await hashSecret(newPassword);
  await c.env.DB.prepare('UPDATE parents SET password_hash = ? WHERE id = ?')
    .bind(nextHash, parentId)
    .run();
  return c.json({ ok: true });
});
