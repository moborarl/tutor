import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, SessionInfo } from '../env';
import { randomId, signValue, verifySignedValue } from './crypto';

const COOKIE_NAME = 'kt_session';
const SESSION_DAYS = 30;

export async function createSession(c: Context<AppEnv>, parentId: number): Promise<void> {
  const sessionId = randomId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO parent_sessions (id, parent_id, expires_at) VALUES (?, ?, ?)',
  )
    .bind(sessionId, parentId, expiresAt)
    .run();
  const signed = await signValue(sessionId, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, signed, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function loadSession(c: Context<AppEnv>): Promise<SessionInfo | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;
  const sessionId = await verifySignedValue(raw, c.env.SESSION_SECRET);
  if (!sessionId) return null;
  const row = await c.env.DB.prepare(
    `SELECT id, parent_id, active_child_id, pin_fail_count FROM parent_sessions
     WHERE id = ? AND expires_at > datetime('now')`,
  )
    .bind(sessionId)
    .first<{ id: string; parent_id: number; active_child_id: number | null; pin_fail_count: number }>();
  if (!row) return null;
  return {
    sessionId: row.id,
    parentId: row.parent_id,
    activeChildId: row.active_child_id,
    pinFailCount: row.pin_fail_count,
  };
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const raw = getCookie(c, COOKIE_NAME);
  if (raw) {
    const sessionId = await verifySignedValue(raw, c.env.SESSION_SECRET);
    if (sessionId) {
      await c.env.DB.prepare('DELETE FROM parent_sessions WHERE id = ?').bind(sessionId).run();
    }
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
