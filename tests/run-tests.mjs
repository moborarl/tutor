import assert from 'node:assert/strict';
import { rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
compile('worker/lib/grading.ts', 'worker/lib/grading.js');
compile('worker/lib/json-import.ts', 'worker/lib/json-import.js');
compile('worker/lib/crypto.ts', 'worker/lib/crypto.js');
compile('worker/lib/sessions.ts', 'worker/lib/sessions.js');
compile('worker/lib/progress.ts', 'worker/lib/progress.js');
compile('worker/middleware/auth.ts', 'worker/middleware/auth.js');
compile('worker/routes/children.ts', 'worker/routes/children.js');
compile('worker/routes/play.ts', 'worker/routes/play.js');
compile('worker/routes/questions.ts', 'worker/routes/questions.js');
compile('worker/routes/subjects.ts', 'worker/routes/subjects.js');
compile('worker/routes/super-admin.ts', 'worker/routes/super-admin.js');
writeSharedPackage('diagram');
writeSharedPackage('json-repair');

const { gradeAnswer } = await import(pathToFileURL(join(outDir, 'worker/lib/grading.js')));
const { parseImportedJson, validateQuestionPayload } = await import(
  pathToFileURL(join(outDir, 'worker/lib/json-import.js'))
);
const { Hono } = await import('hono');
const { signValue } = await import(pathToFileURL(join(outDir, 'worker/lib/crypto.js')));
const { childrenRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/children.js')));
const { playRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/play.js')));
const { questionRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/questions.js')));
const { subjectRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/subjects.js')));
const { superAdminRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/super-admin.js')));

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
    children: [{ id: 2, parent_id: 1, name: 'Dawin', avatar: 'panda', age_band: 'young' }],
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
