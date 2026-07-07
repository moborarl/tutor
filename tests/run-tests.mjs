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
  const fullOutput = join(outDir, outputPath);
  mkdirSync(dirname(fullOutput), { recursive: true });
  writeFileSync(fullOutput, result.outputText);
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
writeSharedPackage('diagram');
writeSharedPackage('json-repair');

const { gradeAnswer } = await import(pathToFileURL(join(outDir, 'worker/lib/grading.js')));
const { parseImportedJson, validateQuestionPayload } = await import(
  pathToFileURL(join(outDir, 'worker/lib/json-import.js'))
);

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
