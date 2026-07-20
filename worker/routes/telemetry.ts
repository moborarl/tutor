import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const telemetryRoutes = new Hono<AppEnv>();

const ALLOWED_TYPES = new Set(['page_performance', 'runtime_error', 'unhandled_rejection']);

telemetryRoutes.post('/', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0);
  if (contentLength > 4096) return c.json({ error: 'payload_too_large' }, 413);
  const body = await c.req.json<{ type?: string; route?: string; value?: number; detail?: string }>().catch(() => null);
  if (!body || !body.type || !ALLOWED_TYPES.has(body.type)) return c.json({ error: 'invalid_event' }, 400);
  if (typeof body.route !== 'string' || !body.route.startsWith('/') || body.route.length > 160) {
    return c.json({ error: 'invalid_route' }, 400);
  }
  const value = typeof body.value === 'number' && Number.isFinite(body.value) ? Math.round(body.value) : null;
  const detail = typeof body.detail === 'string' ? body.detail.slice(0, 240) : null;
  await c.env.DB.prepare(
    `INSERT INTO telemetry_events (event_type, route, value, detail) VALUES (?, ?, ?, ?)`,
  ).bind(body.type, body.route, value, detail).run();
  return c.json({ ok: true }, 202);
});
