import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');

test('Calm Family Studio tokens expose required semantic roles', () => {
  const css = read('src/styles/tokens.css');
  for (const token of [
    '--cfs-bg', '--cfs-surface', '--cfs-surface-muted', '--cfs-ink',
    '--cfs-muted', '--cfs-border', '--cfs-accent', '--cfs-accent-soft',
    '--cfs-success', '--cfs-danger', '--cfs-warning', '--cfs-focus',
  ]) assert.match(css, new RegExp(`${token}:`));
});

test('new UI styles do not use viewport-scaled font sizes', () => {
  const css = ['tokens', 'foundation', 'shell', 'shared-components', 'auth-family']
    .map((name) => read(`src/styles/${name}.css`)).join('\n');
  assert.doesNotMatch(css, /font-size\s*:\s*(?:clamp|min|max)\(/);
});

test('PageHeader exposes one semantic page heading', () => {
  const source = read('src/components/PageHeader.tsx');
  assert.match(source, /<header className="page-header">/);
  assert.equal(source.match(/<h1>/g)?.length, 1);
});

test('AppState announces errors separately from normal status', () => {
  const source = read('src/components/AppState.tsx');
  assert.match(source, /tone === 'error' \? 'alert' : 'status'/);
  assert.match(source, /aria-live="polite"/);
});

test('AppShell provides desktop and mobile navigation landmarks', () => {
  const source = read('src/components/AppShell.tsx');
  assert.match(source, /<header className="app-shell-header">/);
  assert.match(source, /className="app-shell-desktop-nav"/);
  assert.match(source, /className="app-shell-mobile-nav"/);
  assert.match(source, /aria-label="Main navigation"/);
  assert.match(source, /aria-label="Mobile navigation"/);
});

test('parent authentication uses labelled, autofill-friendly forms', () => {
  const login = read('src/routes/parent/Login.tsx');
  const signup = read('src/routes/parent/Signup.tsx');

  for (const source of [login, signup]) {
    assert.match(source, /className="auth-shell"/);
    assert.match(source, /<label/);
    assert.match(source, /<AppState tone="error"/);
  }

  assert.match(login, /autoComplete="email"/);
  assert.match(login, /autoComplete="current-password"/);
  assert.match(signup, /autoComplete="new-password"/);
});

test('family homepage exposes semantic member choices and shared states', () => {
  const source = read('src/routes/play/ProfilePicker.tsx');
  assert.match(source, /<main className="family-home"/);
  assert.match(source, /<LockKeyhole/);
  assert.match(source, /<AppState tone="loading"/);
  assert.match(source, /<AppState tone="error"/);
  assert.doesNotMatch(source, /<Link[^>]*>\s*<button/);
});

test('explorer navigation closes after a mobile tree selection', () => {
  const layout = read('src/components/ExplorerLayout.tsx');
  const tree = read('src/components/TreePanel.tsx');
  assert.match(layout, /ExplorerTreeContext/);
  assert.match(layout, /aria-controls="explorer-tree-panel"/);
  assert.match(layout, /aria-expanded=/);
  assert.match(tree, /data-tree-node=/);
  assert.match(tree, /closeTree\(\)/);
});

test('data workspace primitives expose semantic list and status structure', () => {
  const list = read('src/components/EntityList.tsx');
  const badge = read('src/components/StatusBadge.tsx');
  assert.match(list, /role="list"/);
  assert.match(list, /role="listitem"/);
  assert.match(badge, /aria-hidden="true"/);
  assert.match(badge, /\{children\}/);
});

test('parent overview consumes shared workspace components', () => {
  const source = read('src/routes/parent/Admin.tsx');
  for (const name of ['PageHeader', 'ExplorerLayout', 'TreePanel', 'EntityList', 'StatusBadge']) {
    assert.match(source, new RegExp(name));
  }
  assert.doesNotMatch(source, /r2-file-row[\s\S]{0,900}<ConfirmR2Delete/);
});

test('exercise management keeps exercises out of the tree', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  for (const name of ['PageHeader', 'DataToolbar', 'EntityList', 'StatusBadge']) {
    assert.match(source, new RegExp(name));
  }
  const treeBlock = source.match(/const treeItems[\s\S]*?;\r?\n/)?.[0] ?? '';
  assert.doesNotMatch(treeBlock, /exercise\.title|ex\.title/);
});

test('exercise management exposes a multi-delete action for selected sets', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  assert.match(source, /deleteSelectedSets/);
  assert.match(source, /ลบที่เลือก/);
  assert.match(source, /selected\.size/);
});

test('exercise management exposes bulk assignment for selected sets', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  assert.match(source, /assignSelectedSets/);
  assert.match(source, /มอบหมายที่เลือก/);
  assert.match(source, /bulkAssignChildIds/);
  assert.match(source, /\/assign/);
});

test('exercise management exposes bulk publish and selected assignment visibility', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  assert.match(source, /publishSelectedSets/);
  assert.match(source, /selectedPublishableCount/);
  assert.match(source, /selectedAssignmentSummary/);
  assert.match(source, /selectedChildNames/);
  assert.match(source, /\/publish/);
});

test('exercise management exposes bulk hide for selected published sets', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  assert.match(source, /unpublishSelectedSets/);
  assert.match(source, /selectedUnpublishableCount/);
  assert.match(source, /ซ่อนที่เลือก/);
  assert.match(source, /\/unpublish/);
});

test('exercise management summarizes selected bulk actions before acting', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  assert.match(source, /selectedStatusSummary/);
  assert.match(source, /เผยแพร่ได้/);
  assert.match(source, /ซ่อนได้/);
});

test('parent admin dangerous actions require explicit confirmation and show selected R2 size', () => {
  const source = read('src/routes/parent/Admin.tsx');
  assert.match(source, /confirmValue/);
  assert.match(source, /confirmationInput/);
  assert.match(source, /selectedR2Bytes/);
  assert.match(source, /พื้นที่ที่เลือก/);
});

test('child tree uses names while detail workspace owns the avatar', () => {
  const source = read('src/routes/parent/ChildrenList.tsx');
  assert.match(source, /PageHeader/);
  assert.match(source, /EntityList/);
  const treeBlock = source.match(/const treeItems[\s\S]*?;\r?\n/)?.[0] ?? '';
  assert.doesNotMatch(treeBlock, /ChildAvatar/);
  assert.match(source, /<ChildAvatar/);
});

test('phase 2 explorer keeps tree rows light, aligned, and adaptive', () => {
  const css = read('src/styles/explorer.css');
  const rowRules = css.match(/\.folder-tree button\.tree-node(?:\.(?:active)|:hover)?\s*\{[^}]*\}/g)?.join('\n') ?? '';
  assert.doesNotMatch(rowRules, /background\s*:\s*var\(--cfs-accent\)\s*;/);
  assert.match(css, /width\s*:\s*calc\(100%\s*-\s*var\(--tree-indent/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)[\s\S]*tree-node[\s\S]*min-height\s*:\s*44px/);
  assert.match(css, /tree-node:focus-visible/);
  assert.doesNotMatch(css, /font-size\s*:\s*clamp\(/);
});

test('phase 2 data workspace shares the mobile breakpoint and keyboard focus treatment', () => {
  const css = read('src/styles/data-workspace.css');
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /entity-title-button:focus-visible/);
  assert.match(css, /entity-row-link:focus-visible/);
  assert.doesNotMatch(css, /font-size\s*:\s*clamp\(/);
});

test('desktop explorer tree scrolls independently and returns to page flow on mobile', () => {
  const css = read('src/styles/explorer.css');
  assert.match(css, /\.folder-tree\s*\{[^}]*max-height\s*:\s*calc\(100dvh\s*-/s);
  assert.match(css, /\.folder-tree\s*\{[^}]*overflow-y\s*:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*767px\)[\s\S]*\.folder-tree\s*\{[^}]*max-height\s*:\s*none[^}]*overflow-y\s*:\s*visible/s);
});

test('exercise title buttons override the legacy filled button treatment', () => {
  const css = read('src/styles/data-workspace.css');
  const rule = css.match(/button\.entity-title-button:not\(\.rt-Button\)\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /color\s*:\s*var\(--cfs-ink\)/);
  assert.match(rule, /background\s*:\s*transparent/);
  assert.match(rule, /border\s*:\s*0/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)[\s\S]*button\.entity-title-button:not\(\.rt-Button\)\s*\{[^}]*min-height\s*:\s*44px/s);
});

test('parent review exposes a labelled learning mode control', () => {
  const source = read('src/routes/parent/ReviewExercise.tsx');
  assert.match(source, /โหมดการเรียนรู้/);
  assert.match(source, /Guided learning/);
  assert.match(source, /Exam/);
  assert.match(source, /learningMode/);
});

test('learning mode badge is informational', () => {
  const source = read('src/components/LearningModeBadge.tsx');
  assert.match(source, /LearningModeBadge/);
  assert.doesNotMatch(source, /<(button|select)/);
});

test('child learning foundation provides responsive targets, focus, and neutral progress', () => {
  const cssPath = 'src/styles/child-learning.css';
  assert.equal(existsSync(join(root, cssPath)), true, 'child-learning.css should exist');
  const css = read(cssPath);

  assert.match(css, /\.child-primary-action\s*\{[^}]*min-height\s*:\s*48px/s);
  assert.match(css, /\.child-secondary-action\s*\{[^}]*min-height\s*:\s*44px/s);
  assert.match(css, /\.child-progress-meter progress\s*\{[^}]*accent-color\s*:\s*#3f6f8f/s);
  assert.match(css, /--child-progress-track\s*:\s*#(?:dfe7df|e2e8e2)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(css, /font-size\s*:\s*(?:clamp|min|max)\(/);

  const selectedRule = css.match(/\.child-subject-switcher \[aria-selected='true'\]\s*\{[^}]*\}/s)?.[0] ?? '';
  assert.match(selectedRule, /color\s*:\s*var\(--ink-strong\)/);
  assert.match(selectedRule, /background\s*:\s*var\(--surface-selected\)/);
  assert.doesNotMatch(selectedRule, /background\s*:\s*(?:var\(--cfs-accent\)|#[0-4][0-9a-f]{5})/i);
});

test('child dashboard uses focused semantic components without reordering or nested controls', () => {
  const componentPaths = [
    'src/routes/play/components/ChildLearningShell.tsx',
    'src/routes/play/components/ChildProgressMeter.tsx',
    'src/routes/play/components/ResumeExercisePanel.tsx',
    'src/routes/play/components/SubjectSwitcher.tsx',
    'src/routes/play/components/ChildExerciseList.tsx',
  ];
  for (const path of componentPaths) {
    assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
  }

  const components = componentPaths.map(read).join('\n');
  const dashboard = read('src/routes/play/PlayExerciseList.tsx');
  const progress = read('src/routes/play/PlayProgress.tsx');
  const main = read('src/main.tsx');

  assert.match(components, /<progress/);
  assert.match(components, /role="tablist"/);
  assert.match(components, /role="list"/);
  assert.match(dashboard, /filterExercisesBySubject/);
  assert.match(dashboard, /selectResumeExercise/);
  assert.match(dashboard, /<ChildExerciseList/);
  assert.doesNotMatch(dashboard, /\.sort\(/);
  assert.match(progress, /<ChildProgressMeter/);
  assert.match(main, /\.\/styles\/child-learning\.css/);
  for (const source of [components, dashboard, progress]) {
    assert.doesNotMatch(source, /<Link[^>]*>\s*<button/);
    assert.doesNotMatch(source, /<button[^>]*>\s*<Link/);
  }
});

test('child controls decisively override the legacy button cascade', () => {
  const css = read('src/styles/child-learning.css');
  const primary = css.match(/\.child-learning button\.child-primary-action:not\(\.rt-Button\)\s*\{[^}]*\}/s)?.[0] ?? '';
  const secondary = css.match(/\.child-learning button\.child-secondary-action:not\(\.rt-Button\)\s*\{[^}]*\}/s)?.[0] ?? '';
  const subjectTab = css.match(/\.child-learning button\.child-subject-tab:not\(\.rt-Button\)\s*\{[^}]*\}/s)?.[0] ?? '';
  const selectedTab = css.match(/\.child-learning \.child-subject-switcher button\.child-subject-tab:not\(\.rt-Button\)\[aria-selected='true'\]\s*\{[^}]*\}/s)?.[0] ?? '';

  assert.match(primary, /min-height\s*:\s*48px/);
  assert.match(primary, /background\s*:\s*#3f6f8f/);
  assert.match(secondary, /min-height\s*:\s*44px/);
  assert.match(secondary, /color\s*:\s*var\(--ink-strong\)/);
  assert.match(secondary, /background\s*:\s*#fbfcf8/);
  assert.match(subjectTab, /min-height\s*:\s*44px/);
  assert.match(subjectTab, /color\s*:\s*#526359/);
  assert.match(subjectTab, /background\s*:\s*#fbfcf8/);
  assert.match(selectedTab, /color\s*:\s*var\(--ink-strong\)/);
  assert.match(selectedTab, /background\s*:\s*var\(--surface-selected\)/);
  assert.match(css, /\.child-learning button\.child-primary-action:not\(\.rt-Button\):hover:not\(:disabled\)/);
  assert.match(css, /\.child-learning button\.child-secondary-action:not\(\.rt-Button\):hover:not\(:disabled\)/);
  assert.match(css, /\.child-learning button\.child-subject-tab:not\(\.rt-Button\):hover:not\(:disabled\)/);
  assert.match(css, /\.child-learning :where\(a, button\):focus-visible/);
});

test('subject switcher contains overflow at every viewport width', () => {
  const css = read('src/styles/child-learning.css');
  const assignedWork = css.match(/\.child-assigned-work\s*\{[^}]*\}/s)?.[0] ?? '';
  const switcher = css.match(/\.child-subject-switcher\s*\{[^}]*\}/s)?.[0] ?? '';

  assert.match(assignedWork, /min-width\s*:\s*0/);
  assert.match(switcher, /min-width\s*:\s*0/);
  assert.match(switcher, /max-width\s*:\s*100%/);
  assert.match(switcher, /overflow-x\s*:\s*auto/);
  assert.match(switcher, /overscroll-behavior-inline\s*:\s*contain/);
});

test('subject tabs use roving focus and control the dashboard tabpanel', () => {
  const switcher = read('src/routes/play/components/SubjectSwitcher.tsx');
  const dashboard = read('src/routes/play/PlayExerciseList.tsx');

  assert.match(switcher, /useRef/);
  assert.match(switcher, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(switcher, /onKeyDown=/);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.match(switcher, new RegExp(`case '${key}'`));
  }
  assert.match(switcher, /event\.preventDefault\(\)/);
  assert.match(switcher, /tabRefs\.current\[nextIndex\]\?\.focus\(\)/);
  assert.match(switcher, /aria-controls=\{panelId\}/);
  assert.match(switcher, /id=\{getSubjectTabId\(panelId, index\)\}/);
  assert.match(dashboard, /role="tabpanel"/);
  assert.match(dashboard, /id=\{DASHBOARD_EXERCISE_PANEL_ID\}/);
  assert.match(dashboard, /aria-labelledby=\{getSubjectTabId\(DASHBOARD_EXERCISE_PANEL_ID, activeSubjectIndex\)\}/);
});

test('dashboard normalizes uncategorized subjects for summaries and filtering', () => {
  const state = read('src/routes/play/child-learning-state.ts');
  const dashboard = read('src/routes/play/PlayExerciseList.tsx');

  assert.match(state, /UNCATEGORIZED_SUBJECT\s*=\s*'ไม่ระบุวิชา'/);
  assert.match(state, /subjectName\s*\?\?\s*UNCATEGORIZED_SUBJECT/);
  assert.match(dashboard, /summarizeExercisesBySubject/);
  assert.doesNotMatch(dashboard, /if \(!exercise\.subjectName\) continue/);
});

test('shared player shell exposes visible feedback gating and accessible save state', () => {
  const componentPaths = [
    'src/routes/play/components/PlayerHeader.tsx',
    'src/routes/play/components/QuestionNavigator.tsx',
    'src/routes/play/components/AnswerFeedback.tsx',
    'src/routes/play/components/ExamSaveStatus.tsx',
  ];
  for (const path of componentPaths) {
    assert.equal(existsSync(join(root, path)), true, `${path} should exist`);
  }

  const header = read(componentPaths[0]);
  const navigator = read(componentPaths[1]);
  const feedback = read(componentPaths[2]);
  const saveStatus = read(componentPaths[3]);

  assert.match(header, /<progress/);
  assert.match(header, /<Link[^>]*to="\/play\/exercises"/);
  assert.match(navigator, /answeredLabel/);
  assert.match(navigator, /unansweredLabel/);
  assert.match(navigator, /currentLabel/);
  assert.match(navigator, /correctLabel/);
  assert.match(navigator, /wrongLabel/);
  assert.match(navigator, /questionNavigatorSummary/);
  assert.match(navigator, /correctIds/);
  assert.match(navigator, /wrongIds/);
  assert.match(feedback, /visible:\s*boolean/);
  assert.match(feedback, /if \(!visible\) return null/);
  assert.match(feedback, /aria-live="polite"/);
  assert.match(saveStatus, /role="alert"/);
  assert.match(saveStatus, /onRetry/);
});

test('player keeps Guided locking and Exam secrecy in separate API flows', () => {
  const source = read('src/routes/play/Player.tsx');

  assert.match(source, /learningMode === 'guided'/);
  assert.match(source, /api\.post<AnswerResult>/);
  assert.match(source, /api\.put/);
  assert.match(source, /<ExamSaveStatus/);
  assert.match(source, /<dialog/);
  assert.match(source, /AnswerFeedback visible=\{learningMode === 'guided'/);
  assert.match(source, /phase === 'result'/);
  assert.doesNotMatch(source, /<Link[^>]*>\s*<button/);
  assert.doesNotMatch(source, /<button[^>]*>\s*<Link/);
});

test('completed result owns review actions and lazy Exam reasoning feedback', () => {
  const source = read('src/routes/play/components/ExerciseResult.tsx');

  assert.match(source, /subjectCompleted/);
  assert.match(source, /recommendation/);
  assert.match(source, /<AnswerFeedback visible=\{true\}/);
  assert.match(source, /onToggle/);
  assert.match(source, /reasoning-feedback/);
  assert.match(source, /api\.post<ReasoningFeedback>/);
  assert.doesNotMatch(source, /<Link[^>]*>\s*<button/);
  assert.doesNotMatch(source, /<button[^>]*>\s*<Link/);
});

test('parent progress can drill into per-question attempt answers', () => {
  const app = read('src/App.tsx');
  const progress = read('src/routes/parent/ChildProgress.tsx');
  assert.match(app, /children\/:id\/attempts\/:attemptId/);
  assert.match(progress, /ดูคำตอบรายข้อ/);
  assert.match(progress, /AttemptAnswerReview/);
  assert.match(progress, /api\.get<AttemptResult>/);
});

test('child learning workspace keeps visible navigation in Thai', () => {
  const dashboard = read('src/routes/play/PlayExerciseList.tsx');
  const progress = read('src/routes/play/PlayProgress.tsx');
  const shell = read('src/routes/play/components/ChildLearningShell.tsx');
  assert.match(dashboard, /ความคืบหน้า/);
  assert.match(dashboard, /สลับสมาชิก/);
  assert.match(dashboard, /ผู้ปกครอง/);
  assert.match(progress, /ความคืบหน้าของ/);
  assert.match(shell, /เมนูการเรียนรู้ของเด็ก/);
  assert.doesNotMatch(dashboard, />\s*(Progress|Switch member|Parent|Continue)\s*</);
});

test('family child tiles keep labels readable on dark surfaces', () => {
  const css = read('src/styles/auth-family.css');
  assert.match(css, /\.family-member-child \.family-member-name,\s*\.family-member-child \.family-member-action/);
  assert.match(css, /color:\s*#f7fbf4/);
  assert.match(css, /\.family-member-child:hover \.family-member-name/);
});

test('player geometry remains stable and mobile navigation cannot overflow', () => {
  const css = read('src/styles/child-learning.css');

  assert.match(css, /\.child-answer-stage\s*\{[^}]*min-height/s);
  assert.match(css, /\.child-question-navigator button\s*\{[^}]*min-height\s*:\s*44px/s);
  assert.match(css, /\.child-player-actions [^{]*\{[^}]*min-height\s*:\s*48px/s);
  assert.match(css, /\.child-question-navigator \.current\s*\{[^}]*background\s*:\s*#fbfcf8[^}]*border-color\s*:\s*var\(--ink-strong\)/s);
  assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*\.child-question-navigator/s);
  assert.match(css, /\.child-question-navigator\s*\{[^}]*min-width\s*:\s*0[^}]*max-width\s*:\s*100%/s);
  assert.doesNotMatch(css, /font-size\s*:\s*(?:clamp|min|max)\(/);
});
