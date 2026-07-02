import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hashSecret, verifySecret } from '../lib/crypto';
import { createSession, destroySession, loadSession } from '../lib/sessions';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/signup', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return c.json({ error: 'invalid_email' }, 400);
  if (password.length < 8) return c.json({ error: 'password_too_short' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM parents WHERE email = ?')
    .bind(email)
    .first();
  if (existing) return c.json({ error: 'email_taken' }, 409);

  const passwordHash = await hashSecret(password);
  const result = await c.env.DB.prepare(
    'INSERT INTO parents (email, password_hash) VALUES (?, ?)',
  )
    .bind(email, passwordHash)
    .run();
  const parentId = result.meta.last_row_id as number;
  await createSession(c, parentId);
  return c.json({ ok: true });
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? '';
  if (!email || !password) return c.json({ error: 'invalid_credentials' }, 401);

  const row = await c.env.DB.prepare(
    'SELECT id, password_hash FROM parents WHERE email = ?',
  )
    .bind(email)
    .first<{ id: number; password_hash: string }>();
  if (!row || !(await verifySecret(password, row.password_hash))) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  await createSession(c, row.id);
  return c.json({ ok: true });
});

authRoutes.post('/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

// Lightweight "who am I" for the SPA to restore state on load.
authRoutes.get('/me', async (c) => {
  const session = await loadSession(c);
  if (!session) return c.json({ loggedIn: false });
  let activeChild: { id: number; name: string; avatar: string; age_band: string } | null = null;
  if (session.activeChildId != null) {
    activeChild = await c.env.DB.prepare(
      'SELECT id, name, avatar, age_band FROM children WHERE id = ?',
    )
      .bind(session.activeChildId)
      .first();
  }
  return c.json({
    loggedIn: true,
    activeChild: activeChild
      ? {
          id: activeChild.id,
          name: activeChild.name,
          avatar: activeChild.avatar,
          ageBand: activeChild.age_band,
        }
      : null,
  });
});
