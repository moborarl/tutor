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
compile('worker/routes/questions.ts', 'worker/routes/questions.js');
compile('worker/routes/super-admin.ts', 'worker/routes/super-admin.js');
writeSharedPackage('diagram');
writeSharedPackage('json-repair');

const { gradeAnswer } = await import(pathToFileURL(join(outDir, 'worker/lib/grading.js')));
const { parseImportedJson, validateQuestionPayload } = await import(
  pathToFileURL(join(outDir, 'worker/lib/json-import.js'))
);
const { Hono } = await import('hono');
const { questionRoutes } = await import(pathToFileURL(join(outDir, 'worker/routes/questions.js')));
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
