import { Hono } from 'hono';
import { buildContractMarkdown } from '@shared/contract';
import type { AppEnv } from './env';
import { requireParentSession, requirePiToken } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { childrenRoutes } from './routes/children';
import { exerciseRoutes } from './routes/exercises';
import { questionRoutes } from './routes/questions';
import { subjectRoutes } from './routes/subjects';
import { sharedRoutes } from './routes/shared';
import { playRoutes } from './routes/play';
import { progressRoutes } from './routes/progress';
import { internalRoutes } from './routes/internal';
import { ingestRoutes } from './routes/ingest';
import { ingestTokenRoutes } from './routes/ingest-token';
import { adminRoutes } from './routes/admin';
import { superAdminRoutes } from './routes/super-admin';
import { profileRoutes } from './routes/profile';
import { aiSettingsRoutes } from './routes/ai-settings';

const app = new Hono<AppEnv>();

app.get('/api/health', (c) => c.json({ ok: true }));

// Public AI contract: the canonical rules for producing importable exercise
// JSON. Served as markdown so any AI/agent in the pipeline can fetch the
// latest version directly (no auth — it contains no user data, and being
// fetchable is the point). Static text only: zero API-token cost.
app.get('/contract', (c) =>
  c.text(buildContractMarkdown(), 200, { 'content-type': 'text/markdown; charset=utf-8' }),
);

app.route('/api/auth', authRoutes);

// Parent-guarded resources
const parent = new Hono<AppEnv>();
parent.use('*', requireParentSession);
parent.route('/children', childrenRoutes);
parent.route('/children', progressRoutes); // GET /children/:id/progress
parent.route('/exercise-sets', exerciseRoutes);
parent.route('/questions', questionRoutes);
parent.route('/subjects', subjectRoutes);
parent.route('/shared', sharedRoutes); // GET /shared/:token, POST /shared/:token/import
parent.route('/ingest-token', ingestTokenRoutes); // GET/POST/DELETE the parent's AI ingest token
parent.route('/admin', adminRoutes);
parent.route('/profile', profileRoutes);
parent.route('/ai-settings', aiSettingsRoutes);
app.route('/api/parent', parent);

app.route('/api/super-admin', superAdminRoutes);

// Kid play flow (mixed guards inside)
app.route('/api/play', playRoutes);

// Public AI push channel: POST /api/ingest/:token — an external AI/agent submits
// exercise JSON straight into a parent's library (lands in pending_review). Auth
// is the per-parent token in the path, so this is intentionally outside the
// parent-session guard.
app.route('/api/ingest', ingestRoutes);

// Pi extraction service
const internal = new Hono<AppEnv>();
internal.use('*', requirePiToken);
internal.route('/', internalRoutes);
app.route('/api/internal', internal);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'not_found' }, 404);
  // Non-API paths fall through to static assets (SPA) via the assets binding.
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
