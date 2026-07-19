# Child Learning Experience Design

Date: 2026-07-16
Status: Approved for implementation planning
Branch: `codex/calm-family-phase3`

## 1. Purpose

Phase 3 redesigns the child's daily learning flow while preserving the existing family and parent workspace architecture. The experience should help a child quickly resume work, understand what remains, answer one question at a time, and know what to do next.

The product supports two parent-selected learning modes per exercise:

- `guided`: immediate deterministic feedback and teaching after each submitted answer.
- `exam`: editable saved answers with no correctness or explanation revealed before final submission.

All existing and newly imported exercises default to `guided`.

## 2. Approved Product Decisions

- Parents configure learning mode on the exercise review page.
- Exercise management shows the current mode as a neutral badge.
- Existing exercises and attempts migrate as `guided`.
- The dashboard prioritizes an unfinished attempt with a `Continue where I stopped` action.
- Younger and older children share one structure with age-adaptive density and labels.
- Completion and remaining work are more prominent than scores.
- Exam answers may be reviewed and changed before final submission.
- Guided incorrect answers are locked, followed by the correct answer and teaching feedback.
- Results prioritize score, subject progress, and the next recommended action.

## 3. Goals

- Make the next learning action obvious within a few seconds.
- Preserve unfinished work across navigation, reloads, and devices.
- Prevent Exam mode from leaking correctness before final submission.
- Keep Guided mode supportive without allowing answer changes after feedback.
- Give parents a clear per-exercise mode control without adding list-level editing complexity.
- Provide one coherent responsive system across dashboard, progress, player, and results.
- Keep AI reasoning feedback optional, parent-funded, and non-blocking.

## 4. Non-Goals

- Timed exams, proctoring, rankings, leaderboards, or competitive rewards.
- Separate codebases or route trees for younger and older children.
- Offline-first synchronization.
- Native Ollama APIs, AI model discovery, or custom provider diagnostics.
- Rebuilding parent upload/import or exercise authoring beyond the learning-mode control and badge.
- Automatically generating AI feedback for every Exam answer at submission time.

## 5. Information Architecture

Existing routes remain stable:

- `/play/exercises`: child dashboard and assigned exercise list.
- `/play/progress`: detailed subject progress.
- `/play/exercises/:id`: one-question player and completed result state.
- `/parent/exercises/:id`: parent review and learning-mode configuration.

The dashboard links to progress and the player. The player returns to the dashboard without losing an in-progress attempt. Completed attempts expose a result view and answer review.

## 6. Data Model

Add a shared type:

```ts
export type LearningMode = 'guided' | 'exam';
```

Add a migration after `0013_parent_ai_custom_provider.sql`:

```sql
ALTER TABLE exercise_sets
ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (learning_mode IN ('guided', 'exam'));

ALTER TABLE attempts
ADD COLUMN learning_mode TEXT NOT NULL DEFAULT 'guided'
CHECK (learning_mode IN ('guided', 'exam'));
```

Rules:

- Existing rows become `guided` through the default.
- New imported and manually created exercise sets use `guided` unless explicitly changed by a parent.
- Creating an attempt copies `exercise_sets.learning_mode` into `attempts.learning_mode`.
- Changing an exercise later never changes an existing attempt's mode.
- `attempt_answers` remains the canonical answer store for both modes.
- Exam saves upsert `given_answer_json`, `is_correct`, `time_spent_ms`, and `reasoning_text`. Correctness is computed internally on every save but is never returned before completion.

No separate draft-answer table is required.

## 7. Parent Configuration

The exercise review page includes a labelled two-option segmented control:

- Guided learning
- Exam

Supporting copy explains the consequence of each mode. Saving uses the existing exercise-set patch flow. The setting remains editable after publishing, but only affects future attempts.

The exercise management list displays a neutral mode badge. The badge is informational and not an inline editor. Bulk actions do not change learning mode.

API and shared-type changes:

- `ExerciseSetSummary` and `ExerciseSetDetail` include `learningMode`.
- Exercise-set patch accepts an optional validated `learningMode`.
- All exercise-set list/detail queries select `learning_mode`.

## 8. Play API Contracts

### 8.1 Assigned Exercise List

`GET /api/play/exercises` extends each `PlayExercise` with:

```ts
learningMode: LearningMode;
hasInProgress: boolean;
inProgressAnsweredCount: number;
assignedAt: string;
```

The API sorts unfinished exercises first, followed by oldest uncompleted assignments, then completed exercises. The UI may apply subject filtering without changing that relative order.

### 8.2 Start Or Resume Attempt

`POST /api/play/attempts` continues to create or resume an attempt and returns:

```ts
{
  attemptId: number;
  learningMode: LearningMode;
  existingAnswers: Array<{
    questionId: number;
    givenAnswer: unknown;
    timeSpentMs: number | null;
    reasoningText: string | null;
    isCorrect?: boolean;
    correctAnswer?: unknown;
    explanation?: string | null;
    reasoningFeedback?: ReasoningFeedback | null;
  }>;
}
```

For Guided attempts, locked feedback fields are returned. For Exam attempts, only the child's editable answer fields are returned until completion.

### 8.3 Guided Answer Submission

`POST /api/play/attempts/:id/answers` is valid only for Guided attempts.

- The first submission inserts and locks the answer.
- Repeated requests return the original result without changing the answer.
- The response includes correctness, correct answer, explanation, and optional reasoning feedback.
- Calling this endpoint for an Exam attempt returns `409 mode_requires_exam_save`.

### 8.4 Exam Answer Save

Add `PUT /api/play/attempts/:id/answers/:questionId` for Exam attempts.

Request:

```ts
{
  answer: unknown;
  timeSpentMs?: number;
  reasoningText?: string;
}
```

Behavior:

- Validate child ownership, assignment, attempt status, question membership, and answer payload.
- Insert or update the answer.
- Update the internal `is_correct` value on every save.
- Never return correctness, correct answer, explanation, or AI feedback.
- Return `{ saved: true, answeredCount: number }`.
- Calling this endpoint for a Guided attempt returns `409 mode_requires_guided_submit`.

### 8.5 Completion

`POST /api/play/attempts/:id/complete` applies to both modes.

- Reject with `409 incomplete_attempt` unless every current exercise question has an answer.
- Derive the score from stored answers and mark the attempt completed in one D1 batch or transaction boundary.
- Return score, correct count, total count, learning mode, and subject-progress summary.
- Once completed, neither answer endpoint may modify the attempt.

### 8.6 Completed Results And Review

Add `GET /api/play/attempts/:id/result` for a completed attempt owned by the active child.

It returns the summary plus per-question given answer, correctness, correct answer, explanation, and available reasoning feedback. This endpoint is the only Exam API that reveals correctness.

For Exam reasoning questions, AI feedback is generated lazily after completion when the child opens that answer in review. Add `POST /api/play/attempts/:id/result/questions/:questionId/reasoning-feedback`. It accepts only a completed Exam attempt owned by the active child, returns an existing feedback result idempotently, and otherwise generates feedback for that one stored reasoning answer. It uses existing parent consent and limits, never changes the deterministic score, and returns a clear unavailable/limit/failure state. Guided feedback continues to run at answer submission.

## 9. Child Dashboard

### 9.1 Header

The dashboard header contains:

- child avatar and name;
- completed sets versus assigned sets;
- an accessible overall progress meter;
- compact actions for progress, switching member, and parent access.

Actions use semantic links or buttons without nested interactive elements.

### 9.2 Resume Panel

When one or more unfinished attempts exist, the most recently active attempt appears in a prominent light-surface panel before subject navigation. It shows:

- exercise title and subject;
- Guided or Exam badge;
- answered questions versus total;
- one `Continue where I stopped` action.

Other unfinished exercises retain an `In progress` status in the list.

### 9.3 Subject Navigation

- Small screens use horizontally scrollable subject tabs.
- Larger screens use the same tabs plus compact subject summaries.
- Tabs display subject name and completed/assigned counts.
- The selected state uses a pale surface, dark text, border, and indicator rather than a dark green fill.

### 9.4 Exercise Rows

Each row includes:

- title;
- subject and question count;
- neutral Guided or Exam badge;
- Not started, In progress, or Completed status;
- best score as secondary metadata;
- one Start, Continue, or Try again action.

Rows remain light and readable. Required meaning never depends on color alone.

### 9.5 Age Adaptation

The component structure and data flow are shared.

- Younger children receive 48px primary targets, shorter labels, larger icons, and reduced metadata.
- Older children receive slightly denser rows and more visible progress metadata.
- Typography does not scale directly with viewport width.

## 10. Detailed Progress

`/play/progress` adopts the Phase 3 child styles and reuses shared progress primitives. It emphasizes completed and remaining sets by subject. Best score remains secondary. Average score is not introduced.

The page preserves subject filtering and links back to the dashboard. Progress fills use a contrasting information color on a neutral track, never green on green.

## 11. Player Experience

### 11.1 Shared Shell

- Stable top bar: exercise title, mode badge, question position, progress, and Exit.
- One primary question stage with optional image or diagram.
- Type-specific answer controls retain stable dimensions.
- Desktop uses a compact question navigator beside the stage.
- Mobile uses a progress bar and expandable question list.
- Navigator states include icon/shape and text labels for current, answered, and unanswered.

### 11.2 Guided State Machine

1. `answering`: answer controls and optional reasoning input are editable.
2. `submitting`: controls retain dimensions and become disabled.
3. `feedback`: answer is locked; correctness, correct answer, explanation, and optional AI reasoning feedback appear.
4. `next`: the primary action advances to the next unanswered question or completes the attempt.

An incorrect answer cannot be retried inside the same Guided attempt. The child may retry the full exercise after completion.

### 11.3 Exam State Machine

1. `editing`: answer and optional reasoning are editable.
2. `saving`: the current answer is persisted; navigation waits for the save.
3. `saved`: navigator marks the question answered without revealing correctness.
4. `review`: child can visit and edit any question; unanswered questions are explicit.
5. `confirming`: final dialog states that answers will be locked.
6. `submitting`: pending saves finish, then the attempt completes.
7. `result`: deterministic score and next actions appear.

Exam mode never calls the Guided submission endpoint and never renders feedback before completion.

## 12. Result And Recommendation

The result view leads with completion, score, and subject progress without oversized celebration UI. It provides:

- Continue to recommended exercise;
- Review answers;
- Return to dashboard;
- Try again when appropriate.

Recommendation order:

1. another unfinished attempt;
2. an uncompleted exercise in the same subject, oldest assignment first;
3. another uncompleted assigned exercise, oldest assignment first;
4. retry the current exercise when all assigned work is complete.

The recommendation is derived server-side or through a shared pure helper so dashboard and result behavior cannot diverge.

## 13. Save And Error Handling

- Exam displays `Saving`, `Saved`, or `Save failed` near the current question.
- A failed save keeps the local answer and exposes Retry.
- Navigation is blocked only while the current answer is actively saving.
- Final submission is disabled while any save is pending or failed.
- Reloading resumes both modes from server state.
- Attempt start failure preserves the route and provides retry or dashboard actions.
- AI failure never blocks answer storage, deterministic grading, completion, or result display.
- Errors use actionable copy and are announced with an alert live region.

## 14. Component Boundaries

New or extracted components should have narrow ownership:

- `ChildLearningShell`: child header, constrained content, age-density class.
- `ChildProgressMeter`: accessible neutral-track progress.
- `ResumeExercisePanel`: primary unfinished-attempt action.
- `SubjectSwitcher`: responsive subject selection.
- `ChildExerciseList` and `ChildExerciseRow`: assigned work presentation.
- `LearningModeBadge`: neutral mode label shared with parent management.
- `PlayerHeader`: mode, progress, exit.
- `QuestionNavigator`: desktop rail and mobile disclosure.
- `AnswerFeedback`: Guided or completed-review feedback only.
- `ExamSaveStatus`: saving state and retry.
- `ExerciseResult`: score, progress, recommendation, actions.

Question-type components remain focused on collecting and displaying answer values. They do not call APIs or decide whether feedback is visible.

Phase 3 styles live in a new canonical `src/styles/child-learning.css` layer. Legacy child rules in `src/styles.css` remain temporarily for untouched routes and are removed only when their consumers migrate.

## 15. Accessibility And Responsive Requirements

- WCAG AA contrast for text and interactive states.
- Visible `:focus-visible` treatment.
- 48px minimum primary child targets and at least 44px secondary controls on mobile.
- Semantic headings, lists, progress elements, dialogs, and form labels.
- No nested links and buttons.
- Current, answered, correct, and incorrect states use more than color.
- Feedback and save errors use appropriate live regions without announcing every autosave success.
- Thai and English labels wrap or truncate without overlapping controls.
- No horizontal page overflow at 390, 768, 1024, or 1440px.
- Motion is short and functional, with `prefers-reduced-motion` support.

## 16. Testing Strategy

### Backend and data

- Migration defaults existing exercise sets and attempts to Guided.
- Parent patch validates and persists learning mode.
- Attempt snapshots the exercise mode.
- Guided answers lock and reveal feedback.
- Exam answers upsert and never expose feedback before completion.
- Wrong-mode endpoints return the documented conflicts.
- Completion rejects unanswered questions.
- Exam completion calculates the correct score after edited answers.
- Completed result ownership and pre-completion access are enforced.
- AI reasoning failure and limits do not affect deterministic results.

### Frontend

- Resume panel selects the correct attempt.
- Subject filtering preserves relative exercise order.
- Age adaptation changes density without changing behavior.
- Guided state transitions and locked answers.
- Exam save, retry, review, confirmation, and resume states.
- Result recommendation order.
- Shared loading, empty, and error states.

### Design contracts and manual QA

- Reject dark child navigation rows and green-on-green progress.
- Require child touch-target and fixed breakpoint rules.
- Require semantic mode/status labels and progress values.
- Run viewport checks at 390, 768, 1024, and 1440px.
- Verify keyboard flow, browser zoom, long labels, and reduced motion.
- Run full tests, typecheck, production build, production smoke, and authenticated smoke after deployment.

## 17. Delivery Sequence

### Phase 3A: Dashboard Foundation

- Shared child styles and components.
- Extended play exercise query.
- Dashboard, resume panel, subject navigation, exercise rows, and progress refresh.

### Phase 3B: Learning Mode

- Migration and shared types.
- Parent review control and management badge.
- Attempt mode snapshot and API validation.

### Phase 3C: Player Modes

- Shared player shell and navigator.
- Guided migration to shared components.
- Exam answer save, review, confirmation, completion, and resume.

### Phase 3D: Results And QA

- Completed result endpoint and view.
- Recommendation helper.
- Lazy post-completion Exam reasoning feedback.
- Accessibility, responsive, regression, build, and smoke verification.

Each phase is independently committed and must leave the test suite green.

## 18. Definition Of Done

- Parents can set Guided or Exam mode per exercise and see the mode in management lists.
- Existing content behaves as Guided without manual migration work.
- Children can identify and resume unfinished work from the dashboard.
- Guided mode reveals immediate locked feedback.
- Exam mode supports editable, resumable answers and reveals nothing before final submission.
- Results show score, subject progress, answer review, and a deterministic next recommendation.
- AI reasoning remains optional, cost-controlled, and non-blocking.
- Dashboard, progress, player, and result views pass responsive and accessibility checks.
- Unit, route, UI contract, typecheck, build, and post-deployment smoke checks pass.
