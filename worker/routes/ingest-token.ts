import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { randomId } from '../lib/crypto';

// Parent-guarded management of the AI ingest token (see routes/ingest.ts for the
// public endpoint that consumes it). Mounted under /api/parent/ingest-token.
export const ingestTokenRoutes = new Hono<AppEnv>();

// Current token (null if the parent has never enabled ingest).
ingestTokenRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const row = await c.env.DB.prepare('SELECT ingest_token FROM parents WHERE id = ?')
    .bind(parentId)
    .first<{ ingest_token: string | null }>();
  return c.json({ token: row?.ingest_token ?? null });
});

// Generate a fresh token. Also serves as rotate: writing a new value silently
// invalidates any token an AI/agent was previously given.
ingestTokenRoutes.post('/', async (c) => {
  const { parentId } = c.get('session');
  const token = randomId(24);
  await c.env.DB.prepare('UPDATE parents SET ingest_token = ? WHERE id = ?')
    .bind(token, parentId)
    .run();
  return c.json({ token });
});

// Revoke: any AI holding the old token can no longer submit.
ingestTokenRoutes.delete('/', async (c) => {
  const { parentId } = c.get('session');
  await c.env.DB.prepare('UPDATE parents SET ingest_token = NULL WHERE id = ?')
    .bind(parentId)
    .run();
  return c.json({ ok: true });
});
