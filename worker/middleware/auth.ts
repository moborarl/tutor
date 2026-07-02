import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { loadSession } from '../lib/sessions';

// Requires a logged-in parent session.
export const requireParentSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await loadSession(c);
  if (!session) return c.json({ error: 'unauthorized' }, 401);
  c.set('session', session);
  await next();
});

// Requires a parent session with a child profile selected (PIN verified).
export const requireChildSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await loadSession(c);
  if (!session) return c.json({ error: 'unauthorized' }, 401);
  if (session.activeChildId == null) return c.json({ error: 'no_child_selected' }, 403);
  c.set('session', session);
  await next();
});

// Requires the Pi extraction service bearer token.
export const requirePiToken = createMiddleware<AppEnv>(async (c, next) => {
  const token = c.env.PI_WORKER_TOKEN;
  const auth = c.req.header('Authorization') ?? '';
  if (!token || auth !== `Bearer ${token}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});
