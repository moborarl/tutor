# Calm Family Studio Phase 2 Parent Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Calm Family Studio explorer and data-management system to the parent overview, exercise management, and child management pages.

**Architecture:** Build explorer and list primitives first, then migrate one route at a time without changing APIs or domain behavior. Reuse the Phase 1 tokens, shell, page header, states, and UI contract suite. Keep route-specific data ownership in the existing route components while shared components own layout and interaction presentation.

**Tech Stack:** React 18, TypeScript, React Router 6, Radix Themes, Lucide React, CSS, Vite 6, Node test runner.

## Global Constraints

- Phase 1 must be complete before this plan starts.
- Preserve existing parent APIs, subject creation/deletion, bulk deletion, assignment, progress, R2, and profile behavior.
- Exercise tree hierarchy is subject then age group; exercise items stay in the workspace.
- Child tree contains names without avatars; the selected child's avatar appears in the workspace.
- Explorer desktop tree is 260-280px; mobile minimum viewport is 360px.
- Tree indentation reduces row width so all right edges align.
- No dark green tree blocks and no muted dark text on dark surfaces.
- No per-row delete action where bulk selection already exists.
- Preserve unrelated working-tree changes in `HANDOFF.md` and `src/routes/parent/Upload.tsx`.

---

## File Map

- Create `src/styles/explorer.css`: explorer and tree responsive behavior.
- Create `src/styles/data-workspace.css`: toolbars, rows, selection, status, and progress.
- Modify `src/main.tsx`: import the two Phase 2 layers after Phase 1 layers.
- Modify `src/components/ExplorerLayout.tsx`: accessible responsive panel and close context.
- Modify `src/components/TreePanel.tsx`: quiet rows and close-after-select behavior.
- Create `src/components/DataToolbar.tsx`: search, filters, and bulk action layout.
- Create `src/components/EntityList.tsx`: semantic list and row primitives.
- Create `src/components/StatusBadge.tsx`: labelled semantic status.
- Modify `src/routes/parent/Admin.tsx`: shared page and data workspace composition.
- Modify `src/routes/parent/ExerciseList.tsx`: shared tree, toolbar, and list system.
- Modify `src/routes/parent/ChildrenList.tsx`: shared tree and child detail workspace.
- Modify `tests/ui-design-contracts.mjs`: Phase 2 structural contracts.

### Task 1: Rebuild ExplorerLayout and TreePanel

**Files:**
- Modify: `src/components/ExplorerLayout.tsx`
- Modify: `src/components/TreePanel.tsx`
- Create: `src/styles/explorer.css`
- Modify: `src/main.tsx`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- `ExplorerLayout({ tree, children, mobileLabel? })` provides close behavior through internal context.
- `TreePanel` retains its current props and closes the mobile panel after `onSelect`.

- [ ] **Step 1: Add failing explorer contracts**

Append:

```js
test('explorer navigation closes after a mobile tree selection', () => {
  const layout = read('src/components/ExplorerLayout.tsx');
  const tree = read('src/components/TreePanel.tsx');
  assert.match(layout, /ExplorerTreeContext/);
  assert.match(layout, /aria-controls="explorer-tree-panel"/);
  assert.match(layout, /aria-expanded=/);
  assert.match(tree, /data-tree-node=/);
  assert.match(tree, /closeTree\(\)/);
});
```

- [ ] **Step 2: Implement close context**

Replace `ExplorerLayout.tsx` with:

```tsx
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';

const ExplorerTreeContext = createContext<() => void>(() => undefined);
export const useExplorerTreeControls = () => useContext(ExplorerTreeContext);

export function ExplorerLayout({ tree, children, mobileLabel = 'เมนูข้อมูล' }: {
  tree: ReactNode;
  children: ReactNode;
  mobileLabel?: string;
}) {
  const [treeOpen, setTreeOpen] = useState(false);
  return (
    <div className={`explorer-layout ${treeOpen ? 'tree-open' : ''}`}>
      <button
        className="explorer-tree-toggle cfs-button cfs-button-secondary"
        type="button"
        aria-controls="explorer-tree-panel"
        aria-expanded={treeOpen}
        onClick={() => setTreeOpen((open) => !open)}
      >
        {treeOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
        {treeOpen ? `ซ่อน${mobileLabel}` : `แสดง${mobileLabel}`}
      </button>
      <ExplorerTreeContext.Provider value={() => setTreeOpen(false)}>
        <aside className="explorer-tree" id="explorer-tree-panel">{tree}</aside>
      </ExplorerTreeContext.Provider>
      <section className="explorer-workspace">{children}</section>
    </div>
  );
}
```

In `TreePanel.tsx`, replace direct `onClick={() => onSelect(item.id)}` with:

```tsx
const closeTree = useExplorerTreeControls();

function selectItem(id: string) {
  onSelect(id);
  closeTree();
}
```

Add `data-tree-node={item.id}` and keep `aria-current`.

- [ ] **Step 3: Implement exact explorer geometry**

Create `explorer.css`:

```css
.explorer-layout { display: grid; grid-template-columns: minmax(260px, 280px) minmax(0, 1fr); gap: var(--cfs-space-5); align-items: start; }
.explorer-tree-toggle { display: none; }
.explorer-tree { min-width: 0; }
.explorer-workspace { min-width: 0; display: flex; flex-direction: column; gap: var(--cfs-space-4); }
.folder-tree { position: sticky; top: 96px; display: flex; flex-direction: column; gap: 2px; padding: var(--cfs-space-3); background: var(--cfs-surface); border: 1px solid var(--cfs-border); border-radius: var(--cfs-radius); box-shadow: var(--cfs-shadow-sm); }
.tree-label { padding: 4px 9px 10px; color: var(--cfs-muted) !important; font-size: 12px !important; }
.folder-tree button.tree-node { position: relative; width: calc(100% - var(--tree-indent, 0px)); min-height: 42px; margin-left: var(--tree-indent, 0px); display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; gap: 9px; align-items: center; padding: 7px 9px; color: var(--cfs-ink); background: transparent; border: 1px solid transparent; border-radius: var(--cfs-radius-sm); text-align: left; }
.folder-tree button.tree-node > span:nth-child(2) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.folder-tree button.tree-node:hover { color: var(--cfs-accent-ink); background: var(--cfs-accent-soft); }
.folder-tree button.tree-node.active { color: var(--cfs-accent-ink); background: var(--cfs-accent-soft); border-color: var(--cfs-border); }
.folder-tree button.tree-node.active::before { content: ''; position: absolute; inset: 7px auto 7px -1px; width: 3px; background: var(--cfs-accent); border-radius: 3px; }
.tree-icon { color: var(--cfs-muted); }
.tree-node.active .tree-icon, .tree-node:hover .tree-icon { color: var(--cfs-accent); }
.tree-node .rt-Badge { min-width: 27px; color: var(--cfs-ink); background: var(--cfs-surface-muted); border: 1px solid var(--cfs-border); }
@media (max-width: 1024px) { .explorer-layout { grid-template-columns: 248px minmax(0, 1fr); gap: var(--cfs-space-4); } }
@media (max-width: 767px) {
  .explorer-layout { grid-template-columns: 1fr; gap: var(--cfs-space-3); }
  .explorer-tree-toggle { width: 100%; display: inline-flex; }
  .explorer-layout:not(.tree-open) .explorer-tree { display: none; }
  .folder-tree { position: static; }
}
```

- [ ] **Step 4: Import and verify**

Add `import './styles/explorer.css';` after Phase 1 imports in `src/main.tsx`.

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExplorerLayout.tsx src/components/TreePanel.tsx src/styles/explorer.css src/main.tsx tests/ui-design-contracts.mjs
git commit -m "Rebuild responsive explorer navigation"
```

### Task 2: Add Data Workspace Primitives

**Files:**
- Create: `src/components/DataToolbar.tsx`
- Create: `src/components/EntityList.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/styles/data-workspace.css`
- Modify: `src/main.tsx`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- `DataToolbar({ search?, filters?, selection?, actions? })` renders one toolbar surface.
- `EntityList({ label, children, empty? })` and `EntityRow({ selected?, selection?, title, metadata?, status?, actions? })` provide semantic list structure.
- `StatusBadge({ tone, children })`, tone is `neutral | success | warning | danger | info`.

- [ ] **Step 1: Add failing component contracts**

Append:

```js
test('data workspace primitives expose semantic list and status structure', () => {
  const list = read('src/components/EntityList.tsx');
  const badge = read('src/components/StatusBadge.tsx');
  assert.match(list, /role="list"/);
  assert.match(list, /role="listitem"/);
  assert.match(badge, /aria-hidden="true"/);
  assert.match(badge, /\{children\}/);
});
```

- [ ] **Step 2: Implement `DataToolbar`**

```tsx
import type { ReactNode } from 'react';

export function DataToolbar({ search, filters, selection, actions }: {
  search?: ReactNode;
  filters?: ReactNode;
  selection?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="data-toolbar" role={search ? 'search' : undefined}>
      {search && <div className="data-toolbar-search">{search}</div>}
      {filters && <div className="data-toolbar-filters">{filters}</div>}
      {selection && <div className="data-toolbar-selection">{selection}</div>}
      {actions && <div className="data-toolbar-actions">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Implement semantic list primitives**

```tsx
import type { ReactNode } from 'react';

export function EntityList({ label, children, empty, isEmpty = false }: {
  label: string;
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
}) {
  if (isEmpty) return <div className="entity-list-empty">{empty}</div>;
  return <div className="entity-list" role="list" aria-label={label}>{children}</div>;
}

export function EntityRow({ selected = false, selection, title, metadata, status, actions }: {
  selected?: boolean;
  selection?: ReactNode;
  title: ReactNode;
  metadata?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`entity-row ${selected ? 'is-selected' : ''}`} role="listitem">
      {selection && <div className="entity-row-selection">{selection}</div>}
      <div className="entity-row-copy"><div className="entity-row-title">{title}</div>{metadata && <div className="entity-row-metadata">{metadata}</div>}</div>
      {status && <div className="entity-row-status">{status}</div>}
      {actions && <div className="entity-row-actions">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Implement status and workspace styling**

Create `StatusBadge.tsx`:

```tsx
import { CheckCircle2, CircleAlert, Clock3, Info, MinusCircle } from 'lucide-react';
import type { ReactNode } from 'react';

const icons = { neutral: MinusCircle, success: CheckCircle2, warning: Clock3, danger: CircleAlert, info: Info };
export function StatusBadge({ tone = 'neutral', children }: { tone?: keyof typeof icons; children: ReactNode }) {
  const Icon = icons[tone];
  return <span className={`status-badge status-badge-${tone}`}><Icon aria-hidden="true" />{children}</span>;
}
```

Create `data-workspace.css`:

```css
.data-toolbar { display: flex; flex-wrap: wrap; gap: var(--cfs-space-3); align-items: center; padding: var(--cfs-space-3); background: var(--cfs-surface); border: 1px solid var(--cfs-border); border-radius: var(--cfs-radius); }
.data-toolbar-search { flex: 1 1 260px; }
.data-toolbar-filters, .data-toolbar-selection, .data-toolbar-actions { display: flex; flex-wrap: wrap; gap: var(--cfs-space-2); align-items: center; }
.data-toolbar-actions { margin-left: auto; }
.entity-list { background: var(--cfs-surface); border: 1px solid var(--cfs-border); border-radius: var(--cfs-radius); overflow: hidden; }
.entity-row { min-height: 64px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: var(--cfs-space-3); align-items: center; padding: var(--cfs-space-3) var(--cfs-space-4); border-bottom: 1px solid var(--cfs-border); }
.entity-row:last-child { border-bottom: 0; }
.entity-row:hover { background: #f3f6f1; }
.entity-row.is-selected { background: var(--cfs-accent-soft); }
.entity-row-copy { min-width: 0; }
.entity-row-title { color: var(--cfs-ink); font-weight: 750; }
.entity-row-metadata { color: var(--cfs-muted); font-size: 13px; }
.compact-checkbox { width: 18px; height: 18px; accent-color: var(--cfs-accent); }
.status-badge { min-height: 26px; display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 750; }
.status-badge svg { width: 14px; height: 14px; }
.status-badge-neutral { color: var(--cfs-ink); background: var(--cfs-surface-muted); }
.status-badge-success { color: #1f6139; background: var(--cfs-success-soft); }
.status-badge-warning { color: #6e4b13; background: var(--cfs-warning-soft); }
.status-badge-danger { color: #8d2831; background: var(--cfs-danger-soft); }
.status-badge-info { color: #27556a; background: var(--cfs-info-soft); }
.progress-track, .progress-bar-track { background: #dce4d9; }
.progress-fill, .progress-bar-fill { background: var(--cfs-info); }
@media (max-width: 720px) {
  .data-toolbar > * { flex: 1 1 100%; }
  .data-toolbar-actions { margin-left: 0; }
  .entity-row { grid-template-columns: auto minmax(0, 1fr); }
  .entity-row-status, .entity-row-actions { grid-column: 2; justify-self: start; }
}
```

- [ ] **Step 5: Import, verify, and commit**

Add `import './styles/data-workspace.css';` in `src/main.tsx`.

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run typecheck`

Expected: exit 0.

Commit:

```bash
git add src/components/DataToolbar.tsx src/components/EntityList.tsx src/components/StatusBadge.tsx src/styles/data-workspace.css src/main.tsx tests/ui-design-contracts.mjs
git commit -m "Add parent data workspace components"
```

### Task 3: Migrate Parent Overview

**Files:**
- Modify: `src/routes/parent/Admin.tsx`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consume Phase 1 `PageHeader` and Phase 2 explorer/data components.
- Preserve all existing API calls and destructive confirmation components.

- [ ] **Step 1: Add failing route contracts**

Append:

```js
test('parent overview consumes shared workspace components', () => {
  const source = read('src/routes/parent/Admin.tsx');
  for (const name of ['PageHeader', 'ExplorerLayout', 'TreePanel', 'EntityList', 'StatusBadge']) {
    assert.match(source, new RegExp(name));
  }
  assert.doesNotMatch(source, /r2-file-row[\s\S]{0,900}<ConfirmR2Delete/);
});
```

- [ ] **Step 2: Replace heading and summary composition**

Render `PageHeader` with family name as context and the existing management description. Keep the tree sections unchanged. Convert summary totals to one `.summary-grid` and repeated family data to `EntityList` rows.

- [ ] **Step 3: Migrate exercise, child, and R2 lists**

Use `DataToolbar` for select-all and bulk actions. Use `EntityRow` for each item. Keep current checkbox aria-labels and confirmation copy. Remove the per-row R2 delete button; selecting one row and using the same bulk delete action handles single deletion.

- [ ] **Step 4: Verify behavior**

Run: `npm.cmd test`

Expected: all tests PASS, including R2 ownership/deletion tests.

Run: `npm.cmd run build`

Expected: exit 0.

Manual checks: profile update, password update, section switching, exercise bulk delete confirmation, R2 pagination and bulk delete confirmation.

- [ ] **Step 5: Commit**

```bash
git add src/routes/parent/Admin.tsx tests/ui-design-contracts.mjs
git commit -m "Apply workspace system to parent overview"
```

### Task 4: Migrate Exercise Management

**Files:**
- Modify: `src/routes/parent/ExerciseList.tsx`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Preserve subject CRUD, filtering, selection, deletion, navigation, and assignment counts.

- [ ] **Step 1: Add failing exercise contracts**

Append:

```js
test('exercise management keeps exercises out of the tree', () => {
  const source = read('src/routes/parent/ExerciseList.tsx');
  for (const name of ['PageHeader', 'DataToolbar', 'EntityList', 'StatusBadge']) {
    assert.match(source, new RegExp(name));
  }
  const treeBlock = source.match(/const treeItems[\s\S]*?;\n/)?.[0] ?? '';
  assert.doesNotMatch(treeBlock, /exercise\.title|ex\.title/);
});
```

- [ ] **Step 2: Recompose heading and subject creation**

Use `PageHeader` for title and description. Put subject creation and upload/create action in the action region. On mobile, controls stack full-width through shared page-header CSS.

- [ ] **Step 3: Recompose workspace**

Keep `TreePanel` subject/age nodes. Render context summary first, then one `DataToolbar`, then an `EntityList`. Each exercise row receives a compact checkbox, wide title/metadata area, `StatusBadge`, and one semantic link to review. Keep bulk deletion in the toolbar only.

- [ ] **Step 4: Verify behavior and layout**

Run: `npm.cmd test`

Expected: all tests PASS, including subject create/delete tests.

Run: `npm.cmd run build`

Expected: exit 0.

Manual checks at 390, 768, 1024, and 1440px: create subject, delete empty subject, select subject/age, search, status filter, select all visible, bulk delete, open exercise review, and return without losing filters.

- [ ] **Step 5: Commit**

```bash
git add src/routes/parent/ExerciseList.tsx tests/ui-design-contracts.mjs
git commit -m "Redesign exercise management workspace"
```

### Task 5: Migrate Children Management

**Files:**
- Modify: `src/routes/parent/ChildrenList.tsx`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Preserve child create/edit/delete, assignments, progress data, and avatar selection.

- [ ] **Step 1: Add failing child-management contracts**

Append:

```js
test('child tree uses names while detail workspace owns the avatar', () => {
  const source = read('src/routes/parent/ChildrenList.tsx');
  assert.match(source, /PageHeader/);
  assert.match(source, /EntityList/);
  const treeBlock = source.match(/const treeItems[\s\S]*?;\n/)?.[0] ?? '';
  assert.doesNotMatch(treeBlock, /ChildAvatar/);
  assert.match(source, /<ChildAvatar/);
});
```

- [ ] **Step 2: Recompose page and tree**

Use `PageHeader` for title, description, and add-child action. Keep only names and counts in tree nodes. Use `ExplorerLayout` mobile close behavior.

- [ ] **Step 3: Recompose selected child workspace**

Render selected child avatar/name/age in one workspace header. Place progress, assignments, and profile settings in separate sections without nested cards. Use `EntityList` for assignments and subject progress rows with neutral tracks and labelled values.

- [ ] **Step 4: Verify behavior and layout**

Run: `npm.cmd test`

Expected: all tests PASS, including child creation without PIN.

Run: `npm.cmd run build`

Expected: exit 0.

Manual checks: create, edit, change avatar, inspect progress, update assignments, delete child, long child name, and empty family state at all four viewport widths.

- [ ] **Step 5: Commit**

```bash
git add src/routes/parent/ChildrenList.tsx tests/ui-design-contracts.mjs
git commit -m "Redesign children management workspace"
```

### Task 6: Phase 2 Accessibility and Responsive Verification

**Files:**
- Modify: `src/styles/explorer.css`
- Modify: `src/styles/data-workspace.css`
- Modify: `tests/ui-design-contracts.mjs`
- Modify: `DESIGN.md`

**Interfaces:**
- No new runtime interfaces; this task closes verified gaps only.

- [ ] **Step 1: Add regression contracts**

Add tests that reject dark tree backgrounds, require `width: calc(100% - var(--tree-indent`, require `@media (max-width: 767px)`, and reject `font-size: clamp(` in Phase 2 styles.

- [ ] **Step 2: Run contracts and fix exact failures**

Run: `npm.cmd run test:ui`

Expected before fixes: FAIL for every missing contract. Modify only the selector named by each failure; do not add broad global overrides.

- [ ] **Step 3: Update design documentation**

Update `DESIGN.md` to identify the new CSS layer files as canonical for touched routes, list the fixed viewport breakpoints, and state that legacy `src/styles.css` remains only for deferred Phase 3-4 routes.

- [ ] **Step 4: Run full verification**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run typecheck`

Expected: exit 0.

Run: `npm.cmd run build`

Expected: exit 0.

Run after deployment: `npm.cmd run smoke:prod`

Expected: 6/6 production checks PASS.

Run with real credentials after deployment: `npm.cmd run smoke:auth`

Expected: all authenticated checks PASS.

Manual viewport matrix for `/parent`, `/parent/exercises`, and `/parent/children`: 390, 768, 1024, and 1440px. Verify no horizontal overflow, no clipped Thai/English labels, 44px touch targets, visible focus, readable hover/active/disabled states, and no green-on-green progress presentation.

- [ ] **Step 5: Commit Phase 2 checkpoint**

```bash
git add src/styles/explorer.css src/styles/data-workspace.css tests/ui-design-contracts.mjs DESIGN.md
git commit -m "Complete parent workspace redesign QA"
```
