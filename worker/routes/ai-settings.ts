import { Hono } from 'hono';
import type { AiProvider, CustomAiFormat } from '@shared/types';
import type { AppEnv } from '../env';
import { decryptCredential, encryptCredential } from '../lib/credential-crypto';
import { normalizeCustomAiConfig } from '../lib/custom-ai';
import { DEFAULT_AI_MODELS, runReasoningFeedback } from '../lib/reasoning-ai';

export const aiSettingsRoutes = new Hono<AppEnv>();
const PROVIDERS: AiProvider[] = ['openai', 'gemini', 'anthropic', 'custom'];

async function audit(db: D1Database, parentId: number, action: string, detail: Record<string, unknown> = {}) {
  try {
    await db.prepare(
      `INSERT INTO admin_audit_log (actor_type, actor_parent_id, action, target_type, target_id, detail_json)
       VALUES ('parent', ?, ?, 'ai_settings', ?, ?)`,
    ).bind(parentId, action, String(parentId), JSON.stringify(detail)).run();
  } catch {
    // Audit logging must never block credential removal or the learning flow.
  }
}

type SettingsRow = {
  provider: AiProvider;
  model: string;
  encrypted_api_key: string;
  key_last4: string;
  base_url: string | null;
  api_format: CustomAiFormat;
  enabled: number;
  daily_limit: number;
  monthly_limit: number;
  consent_at: string;
};

function publicSettings(row: SettingsRow | null) {
  return row ? {
    configured: true,
    provider: row.provider,
    model: row.model,
    keyLast4: row.key_last4,
    baseUrl: row.base_url,
    apiFormat: row.api_format,
    enabled: row.enabled === 1,
    dailyLimit: row.daily_limit,
    monthlyLimit: row.monthly_limit,
    consentAt: row.consent_at,
  } : { configured: false, enabled: false };
}

async function loadSettings(db: D1Database, parentId: number): Promise<SettingsRow | null> {
  return db.prepare(
    `SELECT provider, model, encrypted_api_key, key_last4, base_url, api_format,
            enabled, daily_limit, monthly_limit, consent_at
     FROM parent_ai_settings WHERE parent_id = ?`,
  ).bind(parentId).first<SettingsRow>();
}

aiSettingsRoutes.get('/', async (c) => {
  const { parentId } = c.get('session');
  const settings = publicSettings(await loadSettings(c.env.DB, parentId));
  const usage = await c.env.DB.prepare(
    `SELECT
       SUM(CASE WHEN created_at >= date('now') THEN 1 ELSE 0 END) AS daily_count,
       SUM(CASE WHEN created_at >= date('now','start of month') THEN 1 ELSE 0 END) AS monthly_count
     FROM ai_feedback_usage WHERE parent_id = ?`,
  ).bind(parentId).first<{ daily_count: number | null; monthly_count: number | null }>();
  return c.json({ ...settings, dailyUsage: usage?.daily_count ?? 0, monthlyUsage: usage?.monthly_count ?? 0 });
});

aiSettingsRoutes.get('/history', async (c) => {
  const { parentId } = c.get('session');
  const rows = await c.env.DB.prepare(
    `SELECT aa.id, aa.reasoning_text, aa.ai_feedback_json, aa.answered_at, q.prompt
     FROM attempt_answers aa
     JOIN attempts a ON a.id = aa.attempt_id
     JOIN children ch ON ch.id = a.child_id
     JOIN questions q ON q.id = aa.question_id
     WHERE ch.parent_id = ? AND aa.reasoning_text IS NOT NULL
     ORDER BY aa.answered_at DESC LIMIT 50`,
  ).bind(parentId).all<{ id: number; reasoning_text: string; ai_feedback_json: string | null; answered_at: string; prompt: string }>();
  return c.json(rows.results.map((row) => ({
    id: row.id,
    questionPrompt: row.prompt,
    reasoningText: row.reasoning_text,
    feedback: row.ai_feedback_json ? JSON.parse(row.ai_feedback_json) : null,
    answeredAt: row.answered_at,
  })));
});

aiSettingsRoutes.delete('/history', async (c) => {
  const { parentId } = c.get('session');
  await c.env.DB.prepare(
    `UPDATE attempt_answers SET reasoning_text = NULL, ai_feedback_json = NULL, ai_feedback_status = NULL
     WHERE id IN (
       SELECT aa.id FROM attempt_answers aa
       JOIN attempts a ON a.id = aa.attempt_id
       JOIN children ch ON ch.id = a.child_id
       WHERE ch.parent_id = ?
     )`,
  ).bind(parentId).run();
  await audit(c.env.DB, parentId, 'ai_reasoning_history_cleared');
  return c.json({ ok: true });
});

aiSettingsRoutes.put('/', async (c) => {
  const { parentId } = c.get('session');
  const body = await c.req.json<{
    provider?: AiProvider;
    model?: string;
    apiKey?: string;
    enabled?: boolean;
    dailyLimit?: number;
    monthlyLimit?: number;
    consentAccepted?: boolean;
    baseUrl?: string;
    apiFormat?: CustomAiFormat;
  }>().catch(() => null);
  if (!body?.provider || !PROVIDERS.includes(body.provider)) return c.json({ error: 'invalid_provider' }, 400);
  if (!body.consentAccepted) return c.json({ error: 'consent_required' }, 400);
  if (!c.env.AI_CREDENTIAL_ENCRYPTION_KEY) return c.json({ error: 'encryption_not_configured' }, 503);

  const existing = await loadSettings(c.env.DB, parentId);
  const apiKey = body.apiKey?.trim();
  if (apiKey && apiKey.length > 512) return c.json({ error: 'api_key_too_long' }, 400);
  if (!apiKey && !existing && body.provider !== 'custom') return c.json({ error: 'api_key_required' }, 400);
  if (!apiKey && existing && existing.provider !== body.provider && body.provider !== 'custom') {
    return c.json({ error: 'api_key_required_for_provider' }, 400);
  }

  let baseUrl: string | null = null;
  let apiFormat: CustomAiFormat = 'responses';
  if (body.provider === 'custom') {
    try {
      const customConfig = normalizeCustomAiConfig(body.baseUrl ?? existing?.base_url ?? '', body.apiFormat ?? existing?.api_format);
      baseUrl = customConfig.baseUrl;
      apiFormat = customConfig.apiFormat;
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'custom_base_url_invalid' }, 400);
    }
  }

  const model = body.model?.trim().slice(0, 100) || DEFAULT_AI_MODELS[body.provider];
  const dailyLimit = Math.min(500, Math.max(1, Math.floor(body.dailyLimit ?? 30)));
  const monthlyLimit = Math.min(10000, Math.max(dailyLimit, Math.floor(body.monthlyLimit ?? 300)));
  const canReuseExistingKey = existing && existing.provider === body.provider;
  const nextApiKey = apiKey
    ?? (canReuseExistingKey ? await decryptCredential(existing.encrypted_api_key, c.env.AI_CREDENTIAL_ENCRYPTION_KEY) : '')
    ?? '';
  const encrypted = await encryptCredential(nextApiKey, c.env.AI_CREDENTIAL_ENCRYPTION_KEY);
  const last4 = nextApiKey ? nextApiKey.slice(-4) : '';

  await c.env.DB.prepare(
    `INSERT INTO parent_ai_settings
       (parent_id, provider, model, encrypted_api_key, key_last4, base_url, api_format, enabled, daily_limit, monthly_limit, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(parent_id) DO UPDATE SET provider = excluded.provider, model = excluded.model,
       encrypted_api_key = excluded.encrypted_api_key, key_last4 = excluded.key_last4,
       base_url = excluded.base_url, api_format = excluded.api_format,
       enabled = excluded.enabled, daily_limit = excluded.daily_limit, monthly_limit = excluded.monthly_limit,
       consent_at = excluded.consent_at, updated_at = datetime('now')`,
  ).bind(
    parentId,
    body.provider,
    model,
    encrypted,
    last4,
    baseUrl,
    apiFormat,
    body.enabled === false ? 0 : 1,
    dailyLimit,
    monthlyLimit,
  ).run();
  await audit(c.env.DB, parentId, existing ? 'ai_settings_updated' : 'ai_settings_created', {
    provider: body.provider,
    model,
    baseUrl,
    apiFormat: body.provider === 'custom' ? apiFormat : null,
    enabled: body.enabled !== false,
    dailyLimit,
    monthlyLimit,
  });
  return c.json(publicSettings((await loadSettings(c.env.DB, parentId))!));
});

aiSettingsRoutes.post('/test', async (c) => {
  const { parentId } = c.get('session');
  const row = await loadSettings(c.env.DB, parentId);
  if (!row || !c.env.AI_CREDENTIAL_ENCRYPTION_KEY) return c.json({ error: 'not_configured' }, 400);
  try {
    const apiKey = await decryptCredential(row.encrypted_api_key, c.env.AI_CREDENTIAL_ENCRYPTION_KEY);
    await runReasoningFeedback({
      provider: row.provider,
      model: row.model,
      apiKey,
      baseUrl: row.base_url,
      apiFormat: row.api_format,
      question: 'น้ำแข็งละลายเมื่อได้รับความร้อน ข้อความนี้ถูกหรือไม่',
      options: ['ถูก', 'ผิด'],
      correctIndex: 0,
      selectedIndex: 0,
      reasoningText: 'เพราะความร้อนทำให้น้ำแข็งเปลี่ยนสถานะ',
      reasoningPrompt: 'อธิบายสั้นๆ',
      rubric: { keyIdeas: ['ความร้อน', 'เปลี่ยนสถานะ'] },
    });
    return c.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith('provider_http_') ? error.message : 'provider_failed';
    return c.json({ error: code }, 400);
  }
});

aiSettingsRoutes.delete('/', async (c) => {
  const { parentId } = c.get('session');
  await c.env.DB.prepare('DELETE FROM parent_ai_settings WHERE parent_id = ?').bind(parentId).run();
  await audit(c.env.DB, parentId, 'ai_settings_deleted');
  return c.json({ ok: true });
});
