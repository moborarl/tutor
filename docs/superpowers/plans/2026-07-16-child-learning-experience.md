# Child Learning Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resumable child learning workspace with parent-selected Guided and Exam modes, deterministic grading, completed results, and a responsive accessible UI.

**Architecture:** Keep the existing React routes and Hono route groups, add `learning_mode` snapshots to exercise sets and attempts, and centralize attempt policy in small pure helpers. Migrate the child dashboard and player onto focused components and one new CSS layer while retaining the existing question-type input components.

**Tech Stack:** React 18, React Router 6, TypeScript 5.7, Hono, Cloudflare Workers, D1 SQLite, Radix Themes, Lucide React, Node test runner, Vite.

## Global Constraints

- Learning mode is exactly `'guided' | 'exam'`; existing and new content defaults to `guided`.
- An attempt snapshots its exercise's mode and never changes when the exercise is edited later.
- Guided answers lock after first submission and reveal deterministic feedback immediately.
- Exam answers remain editable and reveal no correctness, correct answer, explanation, or AI feedback before completion.
- Completion requires an answer for every current exercise question and performs score persistence atomically.
- AI reasoning is optional, parent-funded, lazy for completed Exam answers, and never changes deterministic grading.
- Existing routes remain `/play/exercises`, `/play/progress`, `/play/exercises/:id`, and `/parent/exercises/:id`.
- Reuse existing question-type components; they collect values but do not call APIs or decide feedback visibility.
- Do not add a React test framework; test pure frontend state with Node tests and source/design rules with `tests/ui-design-contracts.mjs`.
- Child primary targets are at least 48px; mobile secondary controls are at least 44px.
- Text and controls meet WCAG AA contrast, use visible `:focus-visible`, and do not depend on color alone.
- The page must not overflow horizontally at 390, 768, 1024, or 1440px.
- Never use green text or a green progress fill on a green surface.
- Do not modify unrelated dirty files in the main checkout, especially `HANDOFF.md` and `src/routes/parent/Upload.tsx`.

---

## File Map

**Data and API**

- `db/migrations/0014_learning_modes.sql`: add validated mode columns and defaults.
- `shared/types.ts`: shared mode, dashboard, attempt, and result contracts.
- `worker/lib/attempt-mode.ts`: pure answer visibility, completion, and mode policy.
- `worker/lib/exercise-recommendation.ts`: one deterministic recommendation order for dashboard and results.
- `worker/routes/exercises.ts`: parent mode persistence and list/detail projection.
- `worker/routes/play.ts`: dashboard metadata, attempt snapshot/resume, mode-specific answer routes, completion, result, and lazy AI feedback.

**Parent UI**

- `src/components/LearningModeBadge.tsx`: neutral reusable Guided/Exam label.
- `src/routes/parent/ReviewExercise.tsx`: labelled segmented mode editor.
- `src/routes/parent/ExerciseList.tsx`: informational mode badge.

**Child UI**

- `src/routes/play/child-learning-state.ts`: pure sorting, resume selection, and player save-state transitions.
- `src/routes/play/components/ChildLearningShell.tsx`: shared child header and age-density container.
- `src/routes/play/components/ChildProgressMeter.tsx`: accessible neutral-track progress.
- `src/routes/play/components/ResumeExercisePanel.tsx`: primary resume action.
- `src/routes/play/components/SubjectSwitcher.tsx`: responsive subject navigation.
- `src/routes/play/components/ChildExerciseList.tsx`: light exercise rows and statuses.
- `src/routes/play/components/PlayerHeader.tsx`: exercise title, mode, progress, and exit.
- `src/routes/play/components/QuestionNavigator.tsx`: desktop rail and mobile disclosure.
- `src/routes/play/components/AnswerFeedback.tsx`: Guided/completed-review feedback.
- `src/routes/play/components/ExamSaveStatus.tsx`: save, failure, and retry state.
- `src/routes/play/components/ExerciseResult.tsx`: completed summary and next action.
- `src/routes/play/PlayExerciseList.tsx`: compose the dashboard.
- `src/routes/play/PlayProgress.tsx`: reuse child shell and progress primitives.
- `src/routes/play/Player.tsx`: orchestrate Guided, Exam, review, and result states.
- `src/styles/child-learning.css`: canonical child workspace styles.
- `src/main.tsx`: import the new style layer.

**Tests and operations**

- `tests/run-tests.mjs`: pure helper and route behavior tests.
- `tests/ui-design-contracts.mjs`: child component, contrast, target, and breakpoint contracts.
- `scripts/smoke-auth.mjs`: authenticated Guided/Exam production checks using disposable records.
- `HANDOFF.md`: Phase 3 behavior, migration, and verification notes; update only after reconciling the user's dirty main-copy changes.

---

### Task 1: Learning Mode Schema And Shared Contracts

**Files:**
- Create: `db/migrations/0014_learning_modes.sql`
- Create: `worker/lib/attempt-mode.ts`
- Modify: `shared/types.ts`
- Modify: `tests/run-tests.mjs`

**Interfaces:**
- Consumes: existing `Question`, `ReasoningFeedback`, and D1 schema.
- Produces: `LearningMode`, `AttemptAnswerView`, `AttemptStartResponse`, `AttemptCompletionResponse`, `AttemptResult`, `canUseAnswerEndpoint(mode, endpoint)`, and `sanitizeAttemptAnswer(mode, completed, row)`.

- [ ] **Step 1: Add failing policy and migration contract tests**

Add tests that import `canUseAnswerEndpoint` and `sanitizeAttemptAnswer`, read the migration, and assert:

```js
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
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test`

Expected: FAIL because `worker/lib/attempt-mode.ts` and `0014_learning_modes.sql` do not exist.

- [ ] **Step 3: Add the migration and shared types**

Create the migration exactly as:

```sql
ALTER TABLE exercise_sets
ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (learning_mode IN ('guided', 'exam'));

ALTER TABLE attempts
ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (learning_mode IN ('guided', 'exam'));
```

Add these contracts to `shared/types.ts` and extend `ExerciseSetSummary` and `PlayExercise` with the specified fields:

```ts
export type LearningMode = 'guided' | 'exam';

export interface AttemptAnswerView {
  questionId: number;
  givenAnswer: unknown;
  timeSpentMs: number | null;
  reasoningText: string | null;
  isCorrect?: boolean;
  correctAnswer?: unknown;
  explanation?: string | null;
  reasoningFeedback?: ReasoningFeedback | null;
}

export interface AttemptStartResponse {
  attemptId: number;
  learningMode: LearningMode;
  existingAnswers: AttemptAnswerView[];
}

export interface AttemptCompletionResponse {
  score: number;
  correct: number;
  total: number;
  learningMode: LearningMode;
  subjectProgress: {
    subjectName: string | null;
    completed: number;
    assigned: number;
  };
}

export interface AttemptResultQuestion extends Required<Pick<AttemptAnswerView, 'questionId' | 'givenAnswer'>> {
  prompt: string;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
  reasoningText: string | null;
  reasoningFeedback: ReasoningFeedback | null;
}

export interface AttemptResult {
  attemptId: number;
  exerciseSetId: number;
  exerciseTitle: string;
  subjectName: string | null;
  learningMode: LearningMode;
  score: number;
  correct: number;
  total: number;
  subjectCompleted: number;
  subjectAssigned: number;
  questions: AttemptResultQuestion[];
  recommendation: PlayExercise | null;
}
```

Add to `ExerciseSetSummary`: `learningMode: LearningMode`. Add to `PlayExercise`: `learningMode`, `hasInProgress`, `inProgressAnsweredCount`, and `assignedAt`.

In the test harness setup, compile and import the new pure mode helper before its tests:

```js
compile('worker/lib/attempt-mode.ts', 'worker/lib/attempt-mode.js');
const { canUseAnswerEndpoint, sanitizeAttemptAnswer } = await import(
  pathToFileURL(join(outDir, 'worker/lib/attempt-mode.js')),
);
```

- [ ] **Step 4: Implement the pure mode policy**

Create `worker/lib/attempt-mode.ts`:

```ts
import type { AttemptAnswerView, LearningMode } from '../../shared/types';

export type AnswerEndpoint = 'guided-submit' | 'exam-save';

export function canUseAnswerEndpoint(mode: LearningMode, endpoint: AnswerEndpoint): boolean {
  return (mode === 'guided' && endpoint === 'guided-submit') ||
    (mode === 'exam' && endpoint === 'exam-save');
}

export function sanitizeAttemptAnswer(
  mode: LearningMode,
  completed: boolean,
  row: AttemptAnswerView,
): AttemptAnswerView {
  if (mode === 'guided' || completed) return row;
  return {
    questionId: row.questionId,
    givenAnswer: row.givenAnswer,
    timeSpentMs: row.timeSpentMs,
    reasoningText: row.reasoningText,
  };
}
```

- [ ] **Step 5: Run verification and commit**

Run: `npm test && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

```powershell
git add db/migrations/0014_learning_modes.sql shared/types.ts worker/lib/attempt-mode.ts tests/run-tests.mjs
git commit -m "Add guided and exam learning mode contracts"
```

---

### Task 2: Parent Learning Mode Configuration

**Files:**
- Create: `src/components/LearningModeBadge.tsx`
- Modify: `worker/routes/exercises.ts`
- Modify: `src/routes/parent/ReviewExercise.tsx`
- Modify: `src/routes/parent/ExerciseList.tsx`
- Modify: `src/styles/shared-components.css`
- Modify: `tests/run-tests.mjs`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consumes: `LearningMode`, `ExerciseSetSummary.learningMode`, existing `PATCH /api/exercise-sets/:id`.
- Produces: validated optional patch field `learningMode` and `LearningModeBadge({ mode })`.

- [ ] **Step 1: Add failing route and UI contract tests**

Add route tests asserting `exam` persists, `guided` persists, and `practice` returns 400 `invalid_learning_mode`. Add UI source contracts:

```js
test('parent review exposes a labelled learning mode control', () => {
  const source = readFileSync('src/routes/parent/ReviewExercise.tsx', 'utf8');
  assert.match(source, /โหมดการเรียนรู้/);
  assert.match(source, /Guided learning/);
  assert.match(source, /Exam/);
  assert.match(source, /learningMode/);
});

test('learning mode badge is informational', () => {
  const source = readFileSync('src/components/LearningModeBadge.tsx', 'utf8');
  assert.match(source, /LearningModeBadge/);
  assert.doesNotMatch(source, /<(button|select)/);
});
```

Compile and mount `worker/routes/exercises.ts` in the test harness with the same authenticated parent session used by the existing question-route tests, so these assertions exercise the real PATCH handler rather than a copied validator.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL on missing learning-mode validation and badge source.

- [ ] **Step 3: Extend parent API projections and patch validation**

Select `es.learning_mode` in every parent exercise list/detail query, map it to `learningMode`, and parse the patch body as:

```ts
const body = await c.req.json<{
  title?: string;
  subjectId?: number | null;
  ageBand?: string;
  learningMode?: string;
}>().catch(() => null);

if (body?.learningMode !== undefined &&
    body.learningMode !== 'guided' && body.learningMode !== 'exam') {
  return c.json({ error: 'invalid_learning_mode' }, 400);
}
if (body.learningMode) {
  updates.push('learning_mode = ?');
  values.push(body.learningMode);
}
```

- [ ] **Step 4: Add the badge and review control**

Create the badge:

```tsx
import type { LearningMode } from '../../shared/types';

export function LearningModeBadge({ mode }: { mode: LearningMode }) {
  return (
    <span className="learning-mode-badge" data-mode={mode}>
      {mode === 'guided' ? 'Guided' : 'Exam'}
    </span>
  );
}
```

In `ReviewExercise.tsx`, render a labelled two-button segmented control with `aria-pressed`, explanatory copy, and save through the existing patch request. Disable it while saving and show an alert on failure. In `ExerciseList.tsx`, render `LearningModeBadge` beside status metadata without making it an inline editor.

Add `.learning-mode-badge` to `src/styles/shared-components.css` with a pale neutral surface, dark ink, border, and fixed line height. `[data-mode='exam']` may use an information-color border, but both variants must retain dark text.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

```powershell
git add src/components/LearningModeBadge.tsx src/routes/parent/ReviewExercise.tsx src/routes/parent/ExerciseList.tsx src/styles/shared-components.css worker/routes/exercises.ts tests/run-tests.mjs tests/ui-design-contracts.mjs
git commit -m "Add parent learning mode controls"
```

---

### Task 3: Dashboard Metadata And Recommendation Policy

**Files:**
- Create: `worker/lib/exercise-recommendation.ts`
- Modify: `worker/routes/play.ts`
- Modify: `tests/run-tests.mjs`

**Interfaces:**
- Consumes: extended `PlayExercise` and active child id.
- Produces: `recommendNextExercise(exercises, currentExerciseId?)` and enriched ordered `GET /api/play/exercises`.

- [ ] **Step 1: Write failing recommendation and route tests**

Cover this exact order: another in-progress attempt; oldest incomplete in same subject; oldest incomplete in another subject; current exercise retry. Assert the list route returns `learningMode`, `hasInProgress`, `inProgressAnsweredCount`, and `assignedAt`, and places unfinished work first.

```js
test('recommendation prefers unfinished work then same subject', () => {
  const rows = [
    exercise({ id: 1, subjectName: 'คณิตศาสตร์', completedCount: 1, assignedAt: '2026-01-01' }),
    exercise({ id: 2, subjectName: 'คณิตศาสตร์', completedCount: 0, assignedAt: '2026-01-03' }),
    exercise({ id: 3, subjectName: 'วิทยาศาสตร์', completedCount: 0, hasInProgress: true, assignedAt: '2026-01-04' }),
  ];
  assert.equal(recommendNextExercise(rows, 1)?.id, 3);
  assert.equal(recommendNextExercise(rows.filter((row) => row.id !== 3), 1)?.id, 2);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because the recommendation helper and new response fields are absent.

- [ ] **Step 3: Implement the pure recommendation helper**

Create `worker/lib/exercise-recommendation.ts` with stable copies sorted by `assignedAt`:

```ts
import type { PlayExercise } from '../../shared/types';

export function recommendNextExercise(
  exercises: PlayExercise[],
  currentExerciseId?: number,
): PlayExercise | null {
  const current = exercises.find((row) => row.id === currentExerciseId);
  const oldest = (rows: PlayExercise[]) =>
    [...rows].sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))[0] ?? null;
  return oldest(exercises.filter((row) => row.id !== currentExerciseId && row.hasInProgress)) ??
    oldest(exercises.filter((row) => row.id !== currentExerciseId && row.completedCount === 0 && row.subjectName === current?.subjectName)) ??
    oldest(exercises.filter((row) => row.id !== currentExerciseId && row.completedCount === 0)) ??
    current ?? null;
}
```

- [ ] **Step 4: Enrich and order the play exercise query**

Join or correlate the latest in-progress attempt and answer count, select assignment creation time and learning mode, then order with:

```sql
ORDER BY
  CASE WHEN in_progress_attempt_id IS NOT NULL THEN 0
       WHEN completed_count = 0 THEN 1 ELSE 2 END,
  asg.assigned_at ASC,
  es.id ASC
```

Map SQLite values to booleans and camel-case response fields. Preserve this route order when filtering on the client.

Use `asg.assigned_at` for `assignedAt`; the assignments table does not have a `created_at` column. Compile and import the recommendation helper in the test harness:

```js
compile('worker/lib/exercise-recommendation.ts', 'worker/lib/exercise-recommendation.js');
const { recommendNextExercise } = await import(
  pathToFileURL(join(outDir, 'worker/lib/exercise-recommendation.js')),
);
```

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck`

Expected: all tests pass and TypeScript exits 0.

```powershell
git add worker/lib/exercise-recommendation.ts worker/routes/play.ts tests/run-tests.mjs
git commit -m "Add resumable exercise ordering"
```

---

### Task 4: Child Dashboard And Progress Foundation

**Files:**
- Create: `src/routes/play/child-learning-state.ts`
- Create: `src/routes/play/components/ChildLearningShell.tsx`
- Create: `src/routes/play/components/ChildProgressMeter.tsx`
- Create: `src/routes/play/components/ResumeExercisePanel.tsx`
- Create: `src/routes/play/components/SubjectSwitcher.tsx`
- Create: `src/routes/play/components/ChildExerciseList.tsx`
- Create: `src/styles/child-learning.css`
- Modify: `src/routes/play/PlayExerciseList.tsx`
- Modify: `src/routes/play/PlayProgress.tsx`
- Modify: `src/main.tsx`
- Modify: `tests/run-tests.mjs`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consumes: ordered `PlayExercise[]`, active `Child`, existing progress API.
- Produces: `selectResumeExercise`, `filterExercisesBySubject`, and reusable child dashboard/progress components.

- [ ] **Step 1: Add failing pure-state and design tests**

Test that resume selection returns the first in-progress row and subject filtering preserves source order. Add design contracts requiring `child-learning.css`, 390/768/1024 breakpoints, 48px primary targets, `:focus-visible`, `prefers-reduced-motion`, neutral progress tracks, no nested interactive controls, and no dark selected subject fill.

```js
test('subject filtering preserves API order', () => {
  const rows = [exercise({ id: 4, subjectName: 'วิทยาศาสตร์' }), exercise({ id: 2, subjectName: 'คณิตศาสตร์' })];
  assert.deepEqual(filterExercisesBySubject(rows, 'ทั้งหมด').map((row) => row.id), [4, 2]);
  assert.deepEqual(filterExercisesBySubject(rows, 'คณิตศาสตร์').map((row) => row.id), [2]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL on missing state helper, components, and CSS layer.

- [ ] **Step 3: Implement pure dashboard state**

Create:

```ts
import type { PlayExercise } from '../../../shared/types';

export function selectResumeExercise(rows: PlayExercise[]): PlayExercise | null {
  return rows.find((row) => row.hasInProgress) ?? null;
}

export function filterExercisesBySubject(rows: PlayExercise[], subject: string): PlayExercise[] {
  return subject === 'ทั้งหมด' ? rows : rows.filter((row) => row.subjectName === subject);
}
```

- [ ] **Step 4: Build the focused components**

`ChildProgressMeter` renders a labelled native progress element plus visible percentage. `ResumeExercisePanel` renders title, subject, mode badge, answered/total, and one Link. `SubjectSwitcher` uses a semantic labelled tab list with horizontally scrollable small-screen overflow. `ChildExerciseList` uses a semantic list and one row-level action labelled Start, Continue, or Try again. `ChildLearningShell` applies `child-learning--young` or `child-learning--older` from `child.ageBand`.

Use Lucide icons already in the project; do not add dependencies or emoji action icons.

- [ ] **Step 5: Compose dashboard and progress routes**

Replace legacy dashboard markup with the new shell, overall progress, optional resume panel, subject switcher, and filtered exercise list. Keep progress and parent/member actions as separate semantic links. Migrate `/play/progress` to the same shell and meter, emphasizing completed/remaining set counts while keeping best score secondary.

Use the existing shared loading, empty, and error components. The dashboard empty state links back to member selection; a load failure exposes Retry and parent access. Progress load failure exposes Retry and dashboard navigation.

- [ ] **Step 6: Add responsive child styles**

Define light surfaces, dark ink text, neutral gray-green tracks, and an information-blue fill. Use stable row grids and these constraints:

```css
.child-primary-action { min-height: 48px; }
.child-secondary-action { min-height: 44px; }
.child-progress-meter progress { accent-color: #3f6f8f; }
.child-subject-switcher [aria-selected='true'] {
  color: var(--ink-strong);
  background: var(--surface-selected);
  border-color: var(--border-strong);
}
@media (max-width: 1024px) { .child-player-layout { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .child-subject-switcher { overflow-x: auto; } }
@media (max-width: 390px) { .child-dashboard-header { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .child-learning * { scroll-behavior: auto; transition-duration: 0.01ms; } }
```

Import `child-learning.css` after the shared layout layers in `src/main.tsx` so it becomes canonical for migrated child routes.

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests pass; TypeScript and Vite exit 0.

```powershell
git add src/routes/play/child-learning-state.ts src/routes/play/components/ChildLearningShell.tsx src/routes/play/components/ChildProgressMeter.tsx src/routes/play/components/ResumeExercisePanel.tsx src/routes/play/components/SubjectSwitcher.tsx src/routes/play/components/ChildExerciseList.tsx src/routes/play/PlayExerciseList.tsx src/routes/play/PlayProgress.tsx src/styles/child-learning.css src/main.tsx tests/run-tests.mjs tests/ui-design-contracts.mjs
git commit -m "Build the child learning dashboard"
```

---

### Task 5: Mode-Specific Attempt APIs

**Files:**
- Modify: `worker/routes/play.ts`
- Modify: `tests/run-tests.mjs`

**Interfaces:**
- Consumes: `canUseAnswerEndpoint`, `sanitizeAttemptAnswer`, `LearningMode`, and existing `gradeAnswer`.
- Produces: mode-aware `POST /attempts`, Guided POST answer, Exam PUT answer, and complete endpoint.

- [ ] **Step 1: Add failing route tests**

Add isolated cases for:

```text
attempt creation copies exercise mode
attempt resume returns given answer and snapshot mode
Guided POST locks first answer and reveals feedback
Exam POST returns 409 mode_requires_exam_save
Exam PUT inserts then updates the same answer
Exam PUT returns only saved and answeredCount
Guided PUT returns 409 mode_requires_guided_submit
both answer routes reject completed attempts
completion returns 409 incomplete_attempt until every question is answered
edited Exam answer controls the completed score
```

For the secrecy assertion, compare exact keys:

```js
assert.deepEqual(Object.keys(response.body).sort(), ['answeredCount', 'saved']);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because attempt mode is not snapshotted and Exam PUT does not exist.

- [ ] **Step 3: Snapshot mode and return safe resume data**

Change assignment lookup to select `es.learning_mode`. Insert attempts with `(child_id, exercise_set_id, learning_mode)`. Resume queries select `given_answer_json`, timing, reasoning, grading fields, and attempt mode. Parse rows into `AttemptAnswerView` and pass each through `sanitizeAttemptAnswer(mode, false, row)`.

- [ ] **Step 4: Guard Guided submission and implement Exam upsert**

Guided POST must select `learning_mode`, return `409 { error: 'mode_requires_exam_save' }` for Exam, and retain first-answer locking.

Add Exam PUT. Validate a 500-character reasoning limit, question ownership, attempt status, and mode. Grade internally and use:

```sql
INSERT INTO attempt_answers
  (attempt_id, question_id, given_answer_json, is_correct, time_spent_ms, reasoning_text)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(attempt_id, question_id) DO UPDATE SET
  given_answer_json = excluded.given_answer_json,
  is_correct = excluded.is_correct,
  time_spent_ms = excluded.time_spent_ms,
  reasoning_text = excluded.reasoning_text,
  ai_feedback_json = NULL,
  ai_feedback_status = NULL
```

Return only `{ saved: true, answeredCount }`.

- [ ] **Step 5: Make completion complete and atomic**

Count current questions, stored answers, and correct answers. Return `409 { error: 'incomplete_attempt', answered, total }` when counts differ. Use `DB.batch` to update the attempt and read subject progress in one awaited operation group; protect the update with `WHERE status = 'in_progress'`. Return `{ score, correct, total, learningMode, subjectProgress }`.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck`

Expected: route tests pass with no Exam grading fields before completion.

```powershell
git add worker/routes/play.ts tests/run-tests.mjs
git commit -m "Add resumable guided and exam attempts"
```

---

### Task 6: Shared Player Shell And State

**Files:**
- Modify: `src/routes/play/child-learning-state.ts`
- Create: `src/routes/play/components/PlayerHeader.tsx`
- Create: `src/routes/play/components/QuestionNavigator.tsx`
- Create: `src/routes/play/components/AnswerFeedback.tsx`
- Create: `src/routes/play/components/ExamSaveStatus.tsx`
- Modify: `src/styles/child-learning.css`
- Modify: `tests/run-tests.mjs`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consumes: `LearningMode`, `AnswerResult`, question count, current index, and saved answer ids.
- Produces: `ExamSaveState`, `examSaveReducer`, shared player header/navigation/feedback components.

- [ ] **Step 1: Add failing state and design tests**

Test transitions `editing -> saving -> saved`, `saving -> failed -> saving`, and that submit is blocked for pending/failed saves. Add source contracts ensuring `AnswerFeedback` accepts a `visible` prop, the navigator includes text labels in addition to icons, and save failures use `role="alert"`.

```js
test('exam save reducer preserves local answer on failure', () => {
  const saving = examSaveReducer(initialExamSaveState, { type: 'save-started', questionId: 9 });
  const failed = examSaveReducer(saving, { type: 'save-failed', questionId: 9, message: 'บันทึกไม่สำเร็จ' });
  assert.equal(failed.questions[9].status, 'failed');
  assert.equal(canSubmitExam(failed), false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because the reducer and shared player components are absent.

- [ ] **Step 3: Implement Exam save state**

Define:

```ts
export type ExamQuestionSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
export interface ExamSaveState {
  questions: Record<number, { status: ExamQuestionSaveStatus; message: string | null }>;
}
export type ExamSaveAction =
  | { type: 'save-started'; questionId: number }
  | { type: 'save-succeeded'; questionId: number }
  | { type: 'save-failed'; questionId: number; message: string };

export function canSubmitExam(state: ExamSaveState): boolean {
  return Object.values(state.questions).every((row) => row.status !== 'saving' && row.status !== 'failed');
}
```

Implement `examSaveReducer` immutably, changing only the addressed question.

- [ ] **Step 4: Build the shell components**

`PlayerHeader` renders title, neutral mode badge, `ข้อ X จาก Y`, a progress element, and an Exit link. `QuestionNavigator` renders a labelled list with current/answered/unanswered text and shape indicators; below 1024px it becomes a details disclosure. `AnswerFeedback` returns `null` unless `visible` and then renders correctness, answer, explanation, and optional AI state with `aria-live="polite"`. `ExamSaveStatus` announces only failure with `role="alert"`, shows silent Saving/Saved text, and exposes a Retry button on failure.

- [ ] **Step 5: Style stable player geometry**

Give answer stages stable min sizes, navigator buttons at least 44px, and primary actions 48px. Use a light current state with a dark border; do not use dark green navigation surfaces. Ensure long Thai labels wrap before controls and the mobile question list cannot force page overflow.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck`

Expected: all state and UI contract tests pass.

```powershell
git add src/routes/play/child-learning-state.ts src/routes/play/components/PlayerHeader.tsx src/routes/play/components/QuestionNavigator.tsx src/routes/play/components/AnswerFeedback.tsx src/routes/play/components/ExamSaveStatus.tsx src/styles/child-learning.css tests/run-tests.mjs tests/ui-design-contracts.mjs
git commit -m "Add shared child player components"
```

---

### Task 7: Guided And Exam Player Flows

**Files:**
- Modify: `src/routes/play/Player.tsx`
- Modify: `src/styles/child-learning.css`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consumes: `AttemptStartResponse`, mode-specific answer APIs, Exam save reducer, existing question-type components.
- Produces: Guided lock/feedback flow and editable resumable Exam review/confirmation flow.

- [ ] **Step 1: Add failing Player source contracts**

Require the Player to branch on `learningMode`, call PUT only in Exam mode, call Guided POST only in Guided mode, render `ExamSaveStatus`, and show a semantic confirmation dialog before Exam completion. Assert that correctness rendering is gated by Guided feedback or completed result.

- [ ] **Step 2: Run UI contracts and verify RED**

Run: `npm run test:ui`

Expected: FAIL because the existing Player has only immediate Guided behavior.

- [ ] **Step 3: Normalize start/resume state**

Load `AttemptStartResponse`, restore `givenAnswer` for both modes, restore locked `AnswerResult` only for Guided, and initialize Exam save entries as `saved` for server answers. Keep local values keyed by `questionId` so navigation never loses edits.

If attempt start or resume fails, keep the player route mounted and render an actionable error with Retry and Dashboard links. Do not redirect automatically or discard locally entered values after a save failure.

- [ ] **Step 4: Implement Guided transitions**

Submit through POST, disable controls without changing stage dimensions, store returned `AnswerResult`, render `AnswerFeedback visible={true}`, and advance only when the child presses Next. Existing answers remain locked after reload. Complete only after every question has locked feedback.

- [ ] **Step 5: Implement Exam save and review transitions**

Save through PUT when the child presses Save and continue or navigates away from a changed answered question. Await the current save before navigation. On failure retain the local value and show Retry. Render no correctness or explanation. The Review screen lists answered/unanswered state and disables final submission while any question is unanswered, saving, or failed.

- [ ] **Step 6: Add final confirmation and completion**

Use a semantic `<dialog>` or Radix alert dialog already available through Themes. Copy states that answers will be locked. On confirm, await pending saves, call completion once, and transition to result loading. Keep Exit available and route back to `/play/exercises` without deleting the attempt.

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`

Expected: all tests pass, TypeScript exits 0, and production bundle builds.

```powershell
git add src/routes/play/Player.tsx src/styles/child-learning.css tests/ui-design-contracts.mjs
git commit -m "Build guided and exam player flows"
```

---

### Task 8: Completed Results And Lazy Exam Reasoning

**Files:**
- Create: `src/routes/play/components/ExerciseResult.tsx`
- Modify: `worker/routes/play.ts`
- Modify: `src/routes/play/Player.tsx`
- Modify: `src/styles/child-learning.css`
- Modify: `tests/run-tests.mjs`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consumes: completed attempt, `recommendNextExercise`, existing parent AI settings, credential crypto, and reasoning provider.
- Produces: completed result GET, idempotent reasoning-feedback POST, and `ExerciseResult`.

- [ ] **Step 1: Add failing result and AI route tests**

Cover owner-only access, 409 before completion, full grading visibility after completion, recommendation order, existing AI feedback idempotency, non-Exam rejection, missing reasoning rejection, limit/unavailable/failure states, and unchanged deterministic score after AI failure.

```js
assert.equal(beforeCompletion.status, 409);
assert.equal(beforeCompletion.body.error, 'attempt_not_completed');
assert.equal(completed.body.questions[0].isCorrect, true);
assert.deepEqual(completed.body.questions[0].correctAnswer, { correctIndex: 1 });
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because completed result and lazy Exam AI routes do not exist.

- [ ] **Step 3: Implement completed result GET**

Verify active-child ownership and completed status. Join exercise, subject, questions, and stored answers. Parse JSON fields, compute subject completed/assigned counts, load assigned exercises, and call `recommendNextExercise`. Return `AttemptResult`. This is the only Exam route that includes grading fields.

- [ ] **Step 4: Implement lazy reasoning feedback POST**

Require completed Exam mode, owned attempt, multiple-choice reasoning question, and non-empty stored `reasoning_text`. Return stored `ai_feedback_json` immediately when present. Otherwise reuse the existing consent, encryption-key, daily/monthly limits, usage insertion, provider call, failure handling, and answer-row persistence from Guided feedback. Never update `attempts.score` or `attempt_answers.is_correct`.

- [ ] **Step 5: Build and integrate result UI**

`ExerciseResult` leads with completion, score, subject completed/assigned, and actions for recommended exercise, review answers, dashboard, and retry. Answer review uses `AnswerFeedback visible={true}`. For an Exam reasoning answer without feedback, request feedback only when that answer is expanded; show an unavailable or failure message without blocking review.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`

Expected: result ownership, secrecy, recommendation, AI fallback, UI contracts, and build all pass.

```powershell
git add src/routes/play/components/ExerciseResult.tsx src/routes/play/Player.tsx src/styles/child-learning.css worker/routes/play.ts tests/run-tests.mjs tests/ui-design-contracts.mjs
git commit -m "Add child results and exam review"
```

---

### Task 9: Production Smoke Coverage And Final QA

**Files:**
- Modify: `scripts/smoke-auth.mjs`
- Modify: `tests/ui-design-contracts.mjs`
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: deployed migration and authenticated parent/child production APIs.
- Produces: disposable end-to-end Guided/Exam smoke coverage and operating notes.

- [ ] **Step 1: Extend authenticated smoke setup and cleanup**

Create disposable subject, two one-question exercises, one Guided and one Exam, assign them to the smoke child, and track every created id. Wrap execution in `try/finally`; archive exercise sets and delete the temporary subject in `finally` even when an assertion fails.

- [ ] **Step 2: Add Guided and Exam smoke assertions**

Assert parent patch/list mode, child exercise metadata, Guided feedback visibility, Exam PUT secrecy, Exam edit persistence, completion, completed result visibility, and result recommendation. Log one PASS/FAIL line per behavior without printing credentials or answer payloads.

- [ ] **Step 3: Run the complete local gate**

Run:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: zero failed tests, TypeScript exit 0, Vite production build exit 0.

- [ ] **Step 4: Apply migration and deploy through the existing workflow**

Run locally only after the branch is approved for deployment:

```powershell
npx wrangler d1 migrations apply DB --remote
```

Expected: `0014_learning_modes.sql` applies successfully or Wrangler reports no migrations to apply. Push the branch and use the repository deployment workflow; do not deploy a dirty worktree.

- [ ] **Step 5: Run production smoke tests**

Run:

```powershell
npm run smoke:prod
$env:SMOKE_EMAIL="<configured smoke parent email>"
$env:SMOKE_PASSWORD="<configured smoke parent password>"
npm run smoke:auth
```

Expected: every production and authenticated smoke check prints PASS and both scripts exit 0. Keep real values in shell environment variables, never in Git.

- [ ] **Step 6: Perform viewport and accessibility QA**

Using the signed-in browser, check 390, 768, 1024, and 1440px on dashboard, progress, Guided player, Exam review, and result. Verify keyboard order, visible focus, 200% zoom, long Thai/English labels, reduced motion, save failure retry, no nested controls, no horizontal overflow, and no green-on-green text/progress.

- [ ] **Step 7: Reconcile and update handoff notes**

Before editing `HANDOFF.md`, compare the Phase 3 worktree copy with the user's dirty main-checkout copy. Preserve all user text, then record migration `0014`, learning-mode semantics, new endpoints, smoke commands, and deployment order.

- [ ] **Step 8: Commit final QA artifacts**

```powershell
git add scripts/smoke-auth.mjs tests/ui-design-contracts.mjs HANDOFF.md
git commit -m "Document and verify child learning modes"
```

Run `git status --short` and expect no Phase 3 files left unstaged or uncommitted.

---

## Final Acceptance Gate

- [ ] Parent can set Guided or Exam on review and see a neutral badge in management.
- [ ] Existing records behave as Guided; new attempts snapshot the current exercise mode.
- [ ] Dashboard selects the correct unfinished attempt and preserves server order under subject filtering.
- [ ] Guided answers lock and reveal deterministic feedback immediately.
- [ ] Exam answers save, edit, resume, and reveal no grading data before completion.
- [ ] Completion rejects unanswered questions and persists score atomically.
- [ ] Completed result includes review, subject progress, and deterministic recommendation.
- [ ] Lazy Exam AI feedback is idempotent, cost-controlled, and cannot alter score.
- [ ] Dashboard, progress, player, and result pass contrast, keyboard, touch-target, long-label, reduced-motion, and responsive checks.
- [ ] `npm test`, `npm run typecheck`, `npm run build`, `npm run smoke:prod`, and `npm run smoke:auth` pass.
