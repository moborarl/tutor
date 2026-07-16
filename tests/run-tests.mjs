import assert from 'node:assert/strict';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.tmp-tests');

function compile(sourcePath, outputPath) {
  const source = readFileSync(join(root, sourcePath), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      strict: true,
    },
    fileName: sourcePath,
  });
  const outputText = result.outputText.replace(
    /from\s+(['"])(\.\.?\/[^'"]+)\1/g,
    (match, quote, specifier) => specifier.endsWith('.js') ? match : `from ${quote}${specifier}.js${quote}`,
  );
  const fullOutput = join(outDir, outputPath);
  mkdirSync(dirname(fullOutput), { recursive: true });
  writeFileSync(fullOutput, outputText);
}

function writeSharedPackage(name) {
  const dir = join(outDir, 'node_modules', '@shared', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module', exports: './index.js' }));
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

compile('shared/diagram.ts', 'node_modules/@shared/diagram/index.js');
compile('shared/json-repair.ts', 'node_modules/@shared/json-repair/index.js');
compile('shared/types.ts', 'shared/types.js');
compile('shared/diagram.ts', 'shared/diagram.js');
compile('shared/json-repair.ts', 'shared/json-repair.js');
compile('shared/import-preflight.ts', 'shared/import-preflight.js');
compile('worker/lib/grading.ts', 'worker/lib/grading.js');
compile('worker/lib/json-import.ts', 'worker/lib/json-import.js');
compile('worker/lib/crypto.ts', 'worker/lib/crypto.js');
compile('worker/lib/credential-crypto.ts', 'worker/lib/credential-crypto.js');
compile('worker/lib/custom-ai.ts', 'worker/lib/custom-ai.js');
compile('worker/lib/reasoning-ai.ts', 'worker/lib/reasoning-ai.js');
compile('worker/lib/attempt-mode.ts', 'worker/lib/attempt-mode.js');
compile('worker/lib/ai-providers/types.ts', 'worker/lib/ai-providers/types.js');
compile('worker/lib/ai-providers/google-gemini.ts', 'worker/lib/google-gemini.js');
compile('worker/lib/ai-providers/claude.ts', 'worker/lib/claude.js');
compile('worker/lib/ai-providers/index.ts', 'worker/lib/ai-providers.js');
compile('worker/lib/exercise-sets.ts', 'worker/lib/exercise-sets.js');
compile('worker/lib/sessions.ts', 'worker/lib/sessions.js');
compile('worker/lib/progress.ts', 'worker/lib/progress.js');
compile('worker/lib/exercise-recommendation.ts', 'worker/lib/exercise-recommendation.js');
compile('worker/middleware/auth.ts', 'worker/middleware/auth.js');
compile('worker/routes/children.ts', 'worker/routes/children.js');
compile('worker/routes/play.ts', 'worker/routes/play.js');
compile('worker/routes/questions.ts', 'worker/routes/questions.js');
compile('worker/routes/exercises.ts', 'worker/routes/exercises.js');
compile('worker/routes/subjects.ts', 'worker/routes/subjects.js');
compile('worker/routes/super-admin.ts', 'worker/routes/super-admin.js');
compile('worker/routes/admin.ts', 'worker/routes/admin.js');
compile('worker/routes/ai-settings.ts', 'worker/routes/ai-settings.js');
writeSharedPackage('diagram');
writeSharedPackage('json-repair');

const { gradeAnswer } = await import(pathToFileURL(join(outDir, 'worker/lib/grading.js')));
const { recommendNextExercise } = await import(
  pathToFileURL(join(outDir, 'worker/lib/exercise-recommendation.js')),
);
const { parseImportedJson, preflightImportedJson, validateQuestionPayload } = await import(
  pathToFileURL(join(outDir, 'worker/lib/json-import.js'))
);
const { Hono } = await import('hono');
const { signValue } = await import(pathToFileURL(join(outDir, 'worker/lib/crypto.js')));
const { encryptCredential, decryptCredential } = await import(pathToFileURL(join(outDir, 'worker/lib/credential-crypto.js')));
const { canUseAnswerEndpoint, sanitizeAttemptAnswer } = await import(
  pathToFileURL(join(outDir, 'worker/lib/attempt-mode.js')),
);
const { childrenRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/children.js')));
const { playRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/play.js')));
const { questionRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/questions.js')));
const { exerciseRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/exercises.js')));
const { subjectRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/subjects.js')));
const { superAdminRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/super-admin.js')));
const { adminRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/admin.js')));
const { aiSettingsRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/ai-settings.js')));

function makeQuestionsApp(questionOverrides = {}) {
  const question = {
    id: 10,
    exercise_set_id: 20,
    question_type: 'multiple_choice',
    content_json: JSON.stringify({ options: ['A', 'B'] }),
    answer_json: JSON.stringify({ correctIndex: 0 }),
    status: 'approved',
    image_id: 5,
    diagram_json: JSON.stringify({ type: 'force-arrows', items: [{ direction: 'right', magnitude: 10 }] }),
    ...questionOverrides,
  };
  const db = {
    question,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM questions q') && Number(args[0]) === question.id && Number(args[1]) === 1) {
                return question;
              }
              if (sql.includes('FROM exercise_images')) {
                return Number(args[0]) === 5 && Number(args[1]) === question.exercise_set_id ? { id: 5 } : null;
              }
              return null;
            },
            async run() {
              if (sql.includes("UPDATE questions SET status = 'draft'")) {
                question.status = 'draft';
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE questions SET status = 'approved'")) {
                question.status = 'approved';
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('UPDATE questions SET')) {
                const id = args.at(-1);
                if (Number(id) !== question.id) return { meta: { changes: 0 } };
                let valueIndex = 0;
                if (sql.includes('question_type = ?')) question.question_type = args[valueIndex++];
                if (sql.includes('content_json = ?')) question.content_json = args[valueIndex++];
                if (sql.includes('answer_json = ?')) question.answer_json = args[valueIndex++];
                if (sql.includes('image_id = ?')) question.image_id = args[valueIndex++];
                if (sql.includes('diagram_json = ?')) question.diagram_json = args[valueIndex++];
                if (sql.includes("status = 'draft'")) question.status = 'draft';
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('session', { parentId: 1 });
    await next();
  });
  app.route('/questions', questionRoutes);
  return { app, db };
}

function makeExercisesApp() {
  const state = { set: { id: 20, parent_id: 1, learning_mode: 'guided' } };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT id FROM exercise_sets WHERE id = ? AND parent_id = ?')) {
                return Number(args[0]) === state.set.id && Number(args[1]) === state.set.parent_id
                  ? { id: state.set.id }
                  : null;
              }
              return null;
            },
            async run() {
              if (sql.startsWith('UPDATE exercise_sets SET') && sql.includes('learning_mode = ?')) {
                state.set.learning_mode = String(args[0]);
              }
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('session', { parentId: 1 });
    await next();
  });
  app.route('/exercise-sets', exerciseRoutes);
  return { app, db, state };
}

function makeSuperAdminApp() {
  const state = { deletedParent: false };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT email FROM parents WHERE id = ?') && Number(args[0]) === 1) {
                return { email: 'parent@example.com' };
              }
              return null;
            },
            async run() {
              if (sql.includes('DELETE FROM parents WHERE id = ?')) state.deletedParent = true;
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const app = new Hono();
  app.route('/super-admin', superAdminRoutes);
  const env = {
    SUPER_ADMIN_TOKEN: 'secret-token',
    DB: db,
    WORKSHEETS: {
      async list() {
        return { objects: [], truncated: false };
      },
      async delete() {},
    },
  };
  return { app, env, state };
}

function makeAdminR2App() {
  const state = { deleted: [] };
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('session', { parentId: 1 });
    await next();
  });
  app.route('/admin', adminRoutes);
  const env = {
    WORKSHEETS: {
      async list() {
        return {
          objects: [
            { key: 'worksheets/1/a.jpg', size: 100, uploaded: new Date('2026-01-01T00:00:00Z') },
            { key: 'worksheets/1/b.jpg', size: 200, uploaded: new Date('2026-01-02T00:00:00Z') },
          ],
          truncated: false,
        };
      },
      async delete(key) {
        state.deleted.push(key);
      },
    },
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() { return {}; },
              async all() { return { results: [] }; },
              async run() { return { meta: { changes: 1 } }; },
            };
          },
        };
      },
    },
  };
  return { app, env, state };
}

function makeSubjectsApp() {
  const state = {
    subjects: [{ id: 1, parent_id: 1, name: 'คณิตศาสตร์' }],
    exerciseSets: [
      { id: 10, parent_id: 1, subject_id: 1 },
      { id: 11, parent_id: 1, subject_id: null },
    ],
    nextId: 2,
  };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT id, name FROM subjects WHERE parent_id = ? AND name = ?')) {
                const row = state.subjects.find((subject) => subject.parent_id === Number(args[0]) && subject.name === args[1]);
                return row ? { id: row.id, name: row.name } : null;
              }
              if (sql.includes('SELECT id FROM subjects WHERE id = ? AND parent_id = ?')) {
                const row = state.subjects.find((subject) => subject.id === Number(args[0]) && subject.parent_id === Number(args[1]));
                return row ? { id: row.id } : null;
              }
              return null;
            },
            async run() {
              if (sql.includes('UPDATE exercise_sets SET subject_id = NULL')) {
                for (const set of state.exerciseSets) {
                  if (set.parent_id === Number(args[0]) && set.subject_id === Number(args[1])) set.subject_id = null;
                }
                return { meta: { changes: 1 } };
              }
              if (sql.includes('DELETE FROM subjects WHERE id = ? AND parent_id = ?')) {
                const before = state.subjects.length;
                state.subjects = state.subjects.filter((subject) => !(subject.id === Number(args[0]) && subject.parent_id === Number(args[1])));
                return { meta: { changes: before - state.subjects.length } };
              }
              if (sql.includes('INSERT INTO subjects')) {
                state.subjects.push({ id: state.nextId, parent_id: Number(args[0]), name: String(args[1]) });
                return { meta: { last_row_id: state.nextId++ } };
              }
              return { meta: {} };
            },
            async all() {
              if (sql.includes('SELECT id, name FROM subjects WHERE parent_id = ? ORDER BY name')) {
                return {
                  results: state.subjects
                    .filter((subject) => subject.parent_id === Number(args[0]))
                    .map((subject) => ({ id: subject.id, name: subject.name }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'th')),
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('session', { parentId: 1 });
    await next();
  });
  app.route('/subjects', subjectRoutes);
  return { app, db, state };
}

function makeAiSettingsApp() {
  const state = {
    row: null,
  };
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('session', { parentId: 1 }); await next(); });
  app.route('/ai-settings', aiSettingsRoutes);
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes('FROM parent_ai_settings WHERE parent_id = ?')) return state.row;
                if (sql.includes('FROM ai_feedback_usage WHERE parent_id = ?')) return { daily_count: 0, monthly_count: 0 };
                return null;
              },
              async all() { return { results: [] }; },
              async run() {
                if (sql.includes('INSERT INTO parent_ai_settings')) {
                  state.row = {
                    provider: args[1],
                    model: args[2],
                    encrypted_api_key: args[3],
                    key_last4: args[4],
                    base_url: args[5],
                    api_format: args[6],
                    enabled: args[7],
                    daily_limit: args[8],
                    monthly_limit: args[9],
                    consent_at: '2026-07-13T00:00:00Z',
                  };
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
    AI_CREDENTIAL_ENCRYPTION_KEY: 'worker-encryption-secret',
  };
  return { app, env, state };
}

function makeChildrenApp() {
  const state = {
    children: [],
    nextId: 1,
  };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('SELECT id FROM children WHERE id = ? AND parent_id = ?')) {
                return state.children.find((child) => child.id === Number(args[0]) && child.parent_id === Number(args[1])) ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO children')) {
                state.children.push({
                  id: state.nextId,
                  parent_id: Number(args[0]),
                  name: String(args[1]),
                  avatar: String(args[2]),
                  age_band: String(args[3]),
                  pin_hash: String(args[4]),
                });
                return { meta: { last_row_id: state.nextId++ } };
              }
              return { meta: { changes: 1 } };
            },
            async all() {
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('session', { parentId: 1 });
    await next();
  });
  app.route('/children', childrenRoutes);
  return { app, db, state };
}

async function makePlayApp() {
  const sessionId = 'session-1';
  const state = {
    activeChildId: null,
    exerciseListSql: null,
    children: [{ id: 2, parent_id: 1, name: 'Dawin', avatar: 'panda', age_band: 'young' }],
    exerciseRows: [
      {
        id: 10,
        title: 'Completed maths',
        subject_name: 'Maths',
        question_count: 4,
        best_score: 1,
        completed_count: 1,
        learning_mode: 'guided',
        in_progress_attempt_id: null,
        in_progress_answered_count: 0,
        assigned_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 20,
        title: 'Later maths',
        subject_name: 'Maths',
        question_count: 3,
        best_score: null,
        completed_count: 0,
        learning_mode: 'exam',
        in_progress_attempt_id: null,
        in_progress_answered_count: 0,
        assigned_at: '2026-01-03T00:00:00.000Z',
      },
      {
        id: 30,
        title: 'Resume science',
        subject_name: 'Science',
        question_count: 5,
        best_score: null,
        completed_count: 0,
        learning_mode: 'guided',
        in_progress_attempt_id: 300,
        in_progress_answered_count: 2,
        assigned_at: '2026-01-04T00:00:00.000Z',
      },
      {
        id: 40,
        title: 'Earlier history',
        subject_name: 'History',
        question_count: 2,
        best_score: null,
        completed_count: 0,
        learning_mode: 'guided',
        in_progress_attempt_id: null,
        in_progress_answered_count: 0,
        assigned_at: '2026-01-02T00:00:00.000Z',
      },
    ],
  };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM parent_sessions')) {
                return { id: sessionId, parent_id: 1, active_child_id: state.activeChildId, pin_fail_count: 0 };
              }
              if (sql.includes('SELECT id, name, avatar, age_band FROM children WHERE id = ? AND parent_id = ?')) {
                return state.children.find((child) => child.id === Number(args[0]) && child.parent_id === Number(args[1])) ?? null;
              }
              return null;
            },
            async run() {
              if (sql.includes('UPDATE parent_sessions SET active_child_id = ?')) {
                state.activeChildId = Number(args[0]);
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
            async all() {
              if (sql.includes('FROM assignments asg')) {
                state.exerciseListSql = sql;
                return {
                  results: [
                    state.exerciseRows[2],
                    state.exerciseRows[3],
                    state.exerciseRows[1],
                    state.exerciseRows[0],
                  ],
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
  const app = new Hono();
  app.route('/play', playRoutes);
  const secret = 'test-session-secret';
  const cookie = `kt_session=${await signValue(sessionId, secret)}`;
  return { app, env: { DB: db, SESSION_SECRET: secret }, state, cookie };
}

test('gradeAnswer accepts equivalent reduced fractions', () => {
  assert.equal(
    gradeAnswer('fraction', JSON.stringify({ numerator: 1, denominator: 2 }), {
      numerator: 2,
      denominator: 4,
    }),
    true,
  );
});

test('learning mode migration defaults both tables to guided', () => {
  const sql = readFileSync('db/migrations/0014_learning_modes.sql', 'utf8');
  assert.match(sql, /ALTER TABLE exercise_sets[\s\S]*learning_mode[\s\S]*DEFAULT 'guided'/);
  assert.match(sql, /ALTER TABLE attempts[\s\S]*learning_mode[\s\S]*DEFAULT 'guided'/);
  assert.match(sql, /CHECK \(learning_mode IN \('guided', 'exam'\)\)/);
});

test('exam in-progress answers hide grading fields', () => {
  assert.deepEqual(
    sanitizeAttemptAnswer('exam', false, {
      questionId: 7,
      givenAnswer: { selectedIndex: 1 },
      timeSpentMs: 800,
      reasoningText: 'เพราะตัวเลือกนี้ตรงกับโจทย์',
      isCorrect: true,
      correctAnswer: { correctIndex: 1 },
      explanation: 'คำอธิบาย',
      reasoningFeedback: { status: 'completed', message: 'เข้าใจแล้ว' },
    }),
    {
      questionId: 7,
      givenAnswer: { selectedIndex: 1 },
      timeSpentMs: 800,
      reasoningText: 'เพราะตัวเลือกนี้ตรงกับโจทย์',
    },
  );
});

test('answer endpoints are mode-specific', () => {
  assert.equal(canUseAnswerEndpoint('guided', 'guided-submit'), true);
  assert.equal(canUseAnswerEndpoint('guided', 'exam-save'), false);
  assert.equal(canUseAnswerEndpoint('exam', 'guided-submit'), false);
  assert.equal(canUseAnswerEndpoint('exam', 'exam-save'), true);
});

test('exercise set patch persists exam learning mode', async () => {
  const { app, db, state } = makeExercisesApp();
  const response = await app.request(
    '/exercise-sets/20',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ learningMode: 'exam' }),
    },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.equal(state.set.learning_mode, 'exam');
});

test('exercise set patch persists guided learning mode', async () => {
  const { app, db, state } = makeExercisesApp();
  state.set.learning_mode = 'exam';
  const response = await app.request(
    '/exercise-sets/20',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ learningMode: 'guided' }),
    },
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.equal(state.set.learning_mode, 'guided');
});

test('exercise set patch rejects unsupported learning modes', async () => {
  const { app, db } = makeExercisesApp();
  const response = await app.request(
    '/exercise-sets/20',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ learningMode: 'practice' }),
    },
    { DB: db },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_learning_mode' });
});

test('parent AI credentials encrypt without exposing plaintext and decrypt with the same secret', async () => {
  const encrypted = await encryptCredential('sk-parent-secret', 'worker-encryption-secret');
  assert.match(encrypted, /^v1:/);
  assert.equal(encrypted.includes('sk-parent-secret'), false);
  assert.equal(await decryptCredential(encrypted, 'worker-encryption-secret'), 'sk-parent-secret');
  await assert.rejects(() => decryptCredential(encrypted, 'different-secret'));
});

test('parent AI settings require explicit cost consent and configured encryption', async () => {
  const { app, env } = makeAiSettingsApp();
  const withoutConsent = await app.request('/ai-settings', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret' }),
  }, env);
  assert.equal(withoutConsent.status, 400);
  assert.equal((await withoutConsent.json()).error, 'consent_required');

  delete env.AI_CREDENTIAL_ENCRYPTION_KEY;
  const withoutEncryption = await app.request('/ai-settings', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'secret', consentAccepted: true }),
  }, env);
  assert.equal(withoutEncryption.status, 503);
  assert.equal((await withoutEncryption.json()).error, 'encryption_not_configured');
});

test('parent AI settings accept custom public HTTPS endpoints and reject localhost', async () => {
  const { app, env, state } = makeAiSettingsApp();

  const rejected = await app.request('/ai-settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'custom',
      model: 'local-model',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiFormat: 'chat_completions',
      consentAccepted: true,
    }),
  }, env);
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error, 'custom_base_url_https_only');

  const accepted = await app.request('/ai-settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: 'custom',
      model: 'local-model',
      baseUrl: 'https://ai.family.example/v1/',
      apiFormat: 'chat_completions',
      consentAccepted: true,
    }),
  }, env);
  assert.equal(accepted.status, 200);
  assert.equal(state.row.provider, 'custom');
  assert.equal(state.row.base_url, 'https://ai.family.example/v1');
  assert.equal(state.row.api_format, 'chat_completions');
  assert.equal(typeof state.row.encrypted_api_key, 'string');
});

test('gradeAnswer rejects invalid fractions and wrong ordering', () => {
  assert.equal(
    gradeAnswer('fraction', JSON.stringify({ numerator: 1, denominator: 2 }), {
      numerator: 2,
      denominator: 0,
    }),
    false,
  );
  assert.equal(
    gradeAnswer('ordering', JSON.stringify({ indices: [2, 0, 1] }), { indices: [0, 2, 1] }),
    false,
  );
});

test('gradeAnswer handles ordering and fill blank happy paths', () => {
  assert.equal(
    gradeAnswer('ordering', JSON.stringify({ indices: [2, 0, 1] }), { indices: [2, 0, 1] }),
    true,
  );
  assert.equal(
    gradeAnswer('fill_blank', JSON.stringify({ answers: ['Bangkok'] }), { text: '  bangkok  ' }),
    true,
  );
});

test('validateQuestionPayload rejects out-of-range multiple choice answers', () => {
  assert.deepEqual(
    validateQuestionPayload('multiple_choice', { options: ['A', 'B'] }, { correctIndex: 2 }),
    { ok: false, error: 'multiple_choice.answer.correctIndex ต้องเป็นเลข index ของตัวเลือกที่มีอยู่' },
  );
});

test('validateQuestionPayload validates ordering indices', () => {
  assert.equal(
    validateQuestionPayload('ordering', { items: ['1/2', '1/4', '3/4'] }, { indices: [1, 0, 2] }).ok,
    true,
  );
  assert.equal(
    validateQuestionPayload('ordering', { items: ['1/2', '1/4', '3/4'] }, { indices: [1, 1, 2] }).ok,
    false,
  );
  assert.equal(
    validateQuestionPayload('ordering', { items: ['1/2', '1/4', '3/4'] }, { indices: [1, 0, 3] }).ok,
    false,
  );
});

test('validateQuestionPayload validates matching pairs', () => {
  assert.equal(
    validateQuestionPayload(
      'matching',
      { left: ['A', 'B'], right: ['one', 'two'] },
      { pairs: [0, 1] },
    ).ok,
    true,
  );
  assert.equal(
    validateQuestionPayload(
      'matching',
      { left: ['A', 'B'], right: ['one', 'two'] },
      { pairs: [0, 0] },
    ).ok,
    false,
  );
});

test('parseImportedJson rejects invalid payloads with useful messages', () => {
  const result = parseImportedJson(
    JSON.stringify({
      questions: [
        {
          questionType: 'ordering',
          prompt: 'เรียงลำดับ',
          content: { items: ['a', 'b', 'c'] },
          answer: { indices: [0, 0, 2] },
        },
      ],
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /ordering\.answer\.indices/);
});

test('parseImportedJson accepts valid wrapped content and strips worksheet numbering', () => {
  const result = parseImportedJson(
    JSON.stringify({
      title: 'ชุดทดสอบ',
      questions: [
        {
          questionType: 'multiple_choice',
          prompt: '58. เลือกคำตอบ',
          content: { multiple_choice: { options: ['ก', 'ข'] } },
          answer: { multiple_choice: { correctIndex: 1 } },
        },
      ],
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.questions[0].prompt, 'เลือกคำตอบ');
  assert.deepEqual(result.questions[0].content, { options: ['ก', 'ข'] });
});

test('preflightImportedJson reports question-level errors and image warnings', () => {
  const report = preflightImportedJson(JSON.stringify({
    title: 'ตรวจก่อนสร้าง',
    questions: [
      {
        questionType: 'ordering',
        prompt: 'เรียงลำดับ',
        content: { items: ['1/3', '1/2', '1/4'] },
        answer: { indices: [0, 0, 2] },
      },
      {
        questionType: 'multiple_choice',
        prompt: 'เลือกคำตอบ',
        content: { options: ['A', 'B'] },
        answer: { correctIndex: 1 },
        imagePage: 3,
      },
    ],
  }), { uploadedImageCount: 1 });

  assert.equal(report.ok, false);
  assert.equal(report.questionCount, 2);
  assert.equal(report.validQuestionCount, 1);
  assert.equal(report.questionTypeCounts.multiple_choice, 1);
  assert.ok(report.issues.some((issue) => issue.level === 'error' && issue.questionNumber === 1 && issue.message.includes('ordering.answer.indices')));
  assert.ok(report.issues.some((issue) => issue.level === 'warning' && issue.questionNumber === 2 && issue.message.includes('imagePage 3')));
});

test('question route unapproves an approved question', async () => {
  const { app, db } = makeQuestionsApp();
  const res = await app.request('/questions/10/unapprove', { method: 'POST' }, { DB: db });
  assert.equal(res.status, 200);
  assert.equal(db.question.status, 'draft');
});

test('question route detaches image and diagram through patch', async () => {
  const { app, db } = makeQuestionsApp();
  const res = await app.request(
    '/questions/10',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageId: null, diagram: null }),
    },
    { DB: db },
  );
  assert.equal(res.status, 200);
  assert.equal(db.question.image_id, null);
  assert.equal(db.question.diagram_json, null);
  assert.equal(db.question.status, 'draft');
});

test('question route rejects invalid question payload patches', async () => {
  const { app, db } = makeQuestionsApp({
    question_type: 'ordering',
    content_json: JSON.stringify({ items: ['a', 'b', 'c'] }),
    answer_json: JSON.stringify({ indices: [0, 1, 2] }),
  });
  const res = await app.request(
    '/questions/10',
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: { indices: [0, 0, 2] } }),
    },
    { DB: db },
  );
  assert.equal(res.status, 400);
  assert.equal(db.question.answer_json, JSON.stringify({ indices: [0, 1, 2] }));
});

test('super admin delete requires token and matching email confirmation', async () => {
  const { app, env, state } = makeSuperAdminApp();

  const unauthorized = await app.request('/super-admin/parents/1', { method: 'DELETE' }, env);
  assert.equal(unauthorized.status, 401);

  const missingConfirmation = await app.request(
    '/super-admin/parents/1',
    {
      method: 'DELETE',
      headers: { 'x-super-admin-token': 'secret-token', 'content-type': 'application/json' },
      body: JSON.stringify({ confirmEmail: 'wrong@example.com' }),
    },
    env,
  );
  assert.equal(missingConfirmation.status, 400);
  assert.equal(state.deletedParent, false);

  const deleted = await app.request(
    '/super-admin/parents/1',
    {
      method: 'DELETE',
      headers: { 'x-super-admin-token': 'secret-token', 'content-type': 'application/json' },
      body: JSON.stringify({ confirmEmail: 'parent@example.com' }),
    },
    env,
  );
  assert.equal(deleted.status, 200);
  assert.equal(state.deletedParent, true);
});

test('subject route reuses existing subject names per parent', async () => {
  const { app, db, state } = makeSubjectsApp();

  const existing = await app.request(
    '/subjects',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'คณิตศาสตร์' }),
    },
    { DB: db },
  );
  assert.equal(existing.status, 200);
  assert.deepEqual(await existing.json(), { id: 1, name: 'คณิตศาสตร์' });
  assert.equal(state.subjects.length, 1);

  const created = await app.request(
    '/subjects',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'วิทยาศาสตร์' }),
    },
    { DB: db },
  );
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { id: 2, name: 'วิทยาศาสตร์' });
  assert.equal(state.subjects.length, 2);
});

test('subject route deletes a subject without deleting exercise sets', async () => {
  const { app, db, state } = makeSubjectsApp();

  const deleted = await app.request('/subjects/1', { method: 'DELETE' }, { DB: db });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { ok: true });
  assert.equal(state.subjects.length, 0);
  assert.deepEqual(state.exerciseSets, [
    { id: 10, parent_id: 1, subject_id: null },
    { id: 11, parent_id: 1, subject_id: null },
  ]);

  const missing = await app.request('/subjects/999', { method: 'DELETE' }, { DB: db });
  assert.equal(missing.status, 404);
});

test('child route creates profiles without requiring a PIN', async () => {
  const { app, db, state } = makeChildrenApp();
  const created = await app.request(
    '/children',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Lalin', avatar: 'panda', ageBand: 'young' }),
    },
    { DB: db },
  );

  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { id: 1 });
  assert.equal(state.children.length, 1);
  assert.equal(state.children[0].name, 'Lalin');
  assert.equal(typeof state.children[0].pin_hash, 'string');
  assert.ok(state.children[0].pin_hash.length > 0);
});

test('play route selects a child without a PIN', async () => {
  const { app, env, state, cookie } = await makePlayApp();
  const selected = await app.request(
    '/play/select-child',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ childId: 2 }),
    },
    env,
  );

  assert.equal(selected.status, 200);
  assert.deepEqual(await selected.json(), {
    child: { id: 2, name: 'Dawin', avatar: 'panda', ageBand: 'young' },
  });
  assert.equal(state.activeChildId, 2);
});

function exercise(overrides = {}) {
  return {
    id: 1,
    title: 'Exercise',
    subjectName: 'Maths',
    questionCount: 3,
    bestScore: null,
    completedCount: 0,
    learningMode: 'guided',
    hasInProgress: false,
    inProgressAnsweredCount: 0,
    assignedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function importChildLearningState() {
  const sourcePath = join(root, 'src/routes/play/child-learning-state.ts');
  assert.equal(existsSync(sourcePath), true, 'child learning state helper should exist');
  compile('src/routes/play/child-learning-state.ts', 'src/routes/play/child-learning-state.js');
  return import(pathToFileURL(join(outDir, 'src/routes/play/child-learning-state.js')));
}

test('resume selection returns the first in-progress exercise', async () => {
  const { selectResumeExercise } = await importChildLearningState();
  const rows = [
    exercise({ id: 4, hasInProgress: false }),
    exercise({ id: 2, hasInProgress: true }),
    exercise({ id: 8, hasInProgress: true }),
  ];

  assert.equal(selectResumeExercise(rows)?.id, 2);
  assert.equal(selectResumeExercise(rows.map((row) => ({ ...row, hasInProgress: false }))), null);
});

test('subject filtering preserves API order', async () => {
  const { filterExercisesBySubject } = await importChildLearningState();
  const rows = [
    exercise({ id: 4, subjectName: 'วิทยาศาสตร์' }),
    exercise({ id: 2, subjectName: 'คณิตศาสตร์' }),
  ];

  assert.deepEqual(filterExercisesBySubject(rows, 'ทั้งหมด').map((row) => row.id), [4, 2]);
  assert.deepEqual(filterExercisesBySubject(rows, 'คณิตศาสตร์').map((row) => row.id), [2]);
});

test('uncategorized subject filtering includes rows with a null subject name', async () => {
  const { filterExercisesBySubject } = await importChildLearningState();
  const rows = [
    exercise({ id: 4, subjectName: 'วิทยาศาสตร์' }),
    exercise({ id: 7, subjectName: null }),
    exercise({ id: 2, subjectName: 'คณิตศาสตร์' }),
  ];

  assert.deepEqual(filterExercisesBySubject(rows, 'ไม่ระบุวิชา').map((row) => row.id), [7]);
});

test('subject summaries count uncategorized rows without changing source order', async () => {
  const { summarizeExercisesBySubject } = await importChildLearningState();
  assert.equal(typeof summarizeExercisesBySubject, 'function');
  const rows = [
    exercise({ id: 4, subjectName: 'วิทยาศาสตร์' }),
    exercise({ id: 7, subjectName: null, completedCount: 1, bestScore: 0.75 }),
    exercise({ id: 2, subjectName: 'คณิตศาสตร์' }),
  ];

  const summaries = summarizeExercisesBySubject(rows);
  assert.deepEqual(summaries, [
    { subjectName: 'วิทยาศาสตร์', completed: 0, total: 1 },
    { subjectName: 'ไม่ระบุวิชา', completed: 1, total: 1 },
    { subjectName: 'คณิตศาสตร์', completed: 0, total: 1 },
  ]);
  assert.equal(summaries.reduce((sum, subject) => sum + subject.total, 0), rows.length);
});

test('recommendation prioritizes resumable, related, incomplete, then retry work', () => {
  const current = exercise({ id: 1, completedCount: 1, assignedAt: '2026-01-01T00:00:00.000Z' });
  const sameSubject = exercise({ id: 2, assignedAt: '2026-01-03T00:00:00.000Z' });
  const inProgress = exercise({
    id: 3,
    subjectName: 'Science',
    hasInProgress: true,
    assignedAt: '2026-01-04T00:00:00.000Z',
  });
  const anotherSubject = exercise({
    id: 4,
    subjectName: 'History',
    assignedAt: '2026-01-02T00:00:00.000Z',
  });
  const exercises = [current, sameSubject, inProgress, anotherSubject];

  assert.equal(recommendNextExercise(exercises, current.id)?.id, inProgress.id);
  assert.equal(recommendNextExercise(exercises.filter((row) => row.id !== inProgress.id), current.id)?.id, sameSubject.id);
  assert.equal(
    recommendNextExercise(exercises.filter((row) => row.id !== inProgress.id && row.id !== sameSubject.id), current.id)?.id,
    anotherSubject.id,
  );
  assert.equal(recommendNextExercise([current], current.id)?.id, current.id);
});

test('play exercise list returns resumable metadata before incomplete and completed work', async () => {
  const { app, env, state, cookie } = await makePlayApp();
  const selected = await app.request(
    '/play/select-child',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ childId: 2 }),
    },
    env,
  );
  assert.equal(selected.status, 200);

  const response = await app.request('/play/exercises', { headers: { cookie } }, env);
  assert.equal(response.status, 200);
  assert.match(
    state.exerciseListSql,
    /ORDER BY\s+CASE WHEN in_progress_attempt_id IS NOT NULL THEN 0\s+WHEN completed_count = 0 THEN 1 ELSE 2 END,\s+asg\.assigned_at ASC,\s+es\.id ASC/,
  );
  assert.deepEqual(await response.json(), [
    {
      id: 30,
      title: 'Resume science',
      subjectName: 'Science',
      questionCount: 5,
      bestScore: null,
      completedCount: 0,
      learningMode: 'guided',
      hasInProgress: true,
      inProgressAnsweredCount: 2,
      assignedAt: '2026-01-04T00:00:00.000Z',
    },
    {
      id: 40,
      title: 'Earlier history',
      subjectName: 'History',
      questionCount: 2,
      bestScore: null,
      completedCount: 0,
      learningMode: 'guided',
      hasInProgress: false,
      inProgressAnsweredCount: 0,
      assignedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 20,
      title: 'Later maths',
      subjectName: 'Maths',
      questionCount: 3,
      bestScore: null,
      completedCount: 0,
      learningMode: 'exam',
      hasInProgress: false,
      inProgressAnsweredCount: 0,
      assignedAt: '2026-01-03T00:00:00.000Z',
    },
    {
      id: 10,
      title: 'Completed maths',
      subjectName: 'Maths',
      questionCount: 4,
      bestScore: 1,
      completedCount: 1,
      learningMode: 'guided',
      hasInProgress: false,
      inProgressAnsweredCount: 0,
      assignedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
});

test('admin R2 route deletes multiple parent-owned files without key retyping', async () => {
  const { app, env, state } = makeAdminR2App();
  const res = await app.request(
    '/admin/r2-files',
    {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys: ['worksheets/1/a.jpg', 'worksheets/1/b.jpg'] }),
    },
    env,
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, deleted: 2 });
  assert.deepEqual(state.deleted, ['worksheets/1/a.jpg', 'worksheets/1/b.jpg']);
});

test('admin R2 route rejects files outside the parent prefix', async () => {
  const { app, env, state } = makeAdminR2App();
  const res = await app.request(
    '/admin/r2-files',
    {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys: ['worksheets/2/other.jpg'] }),
    },
    env,
  );

  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'not_allowed' });
  assert.deepEqual(state.deleted, []);
});
