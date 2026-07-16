# Calm Family Studio Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Calm Family Studio design foundation, responsive parent app shell, accessible authentication pages, and redesigned family homepage without changing backend behavior.

**Architecture:** Keep the existing React Router and API flows. Add a small CSS layer system after the legacy stylesheet so touched routes can migrate safely, then introduce focused shell and state components. Source-contract tests guard semantic and styling rules while typecheck, build, and manual viewport checks verify integration.

**Tech Stack:** React 18, TypeScript, React Router 6, Radix Themes, Lucide React, Vite 6, Node test runner.

## Global Constraints

- Current-cycle scope is Phase 1 only; do not modify parent explorer routes in this plan.
- Preserve all existing routes, API calls, authentication behavior, and Thai product copy.
- Minimum viewport width is 360px; verify at 390, 768, 1024, and 1440px.
- Parent touch targets are at least 44px; later child answer targets remain at least 48px.
- Dark surfaces use light text; dark text is used only on light surfaces.
- Brand moss is not the semantic success color.
- Keep React, React Router, Radix Themes, and Lucide; add no runtime dependencies.
- Preserve unrelated working-tree changes in `HANDOFF.md` and `src/routes/parent/Upload.tsx`.

---

## File Map

- Create `src/styles/tokens.css`: one source for color, type, space, geometry, and elevation tokens.
- Create `src/styles/foundation.css`: body, typography, controls, focus, and shared utilities.
- Create `src/styles/shell.css`: desktop app bar and mobile navigation.
- Create `src/styles/auth-family.css`: authentication and family homepage compositions.
- Create `src/styles/shared-components.css`: page header and shared state components.
- Create `src/components/PageHeader.tsx`: route heading contract.
- Create `src/components/AppState.tsx`: stable loading, empty, and error states.
- Create `src/components/AppShell.tsx`: responsive parent navigation.
- Modify `src/main.tsx`: import new CSS layers after the legacy stylesheet.
- Modify `src/routes/parent/ParentLayout.tsx`: retain auth guard, delegate layout to `AppShell`.
- Modify `src/routes/parent/Login.tsx`: accessible form and consistent surface.
- Modify `src/routes/parent/Signup.tsx`: accessible form and consistent surface.
- Modify `src/routes/play/ProfilePicker.tsx`: semantic profile tiles and shared states.
- Create `tests/ui-design-contracts.mjs`: source-level contracts for the redesign.
- Modify `package.json`: add `test:ui` and include it in `test`.

### Task 1: Establish UI Contract Tests and CSS Layers

**Files:**
- Create: `tests/ui-design-contracts.mjs`
- Create: `src/styles/tokens.css`
- Create: `src/styles/foundation.css`
- Modify: `src/main.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces CSS custom properties `--cfs-*` consumed by every later task.
- Produces `npm run test:ui` for all later source-contract tests.

- [ ] **Step 1: Write the failing token contract**

Create `tests/ui-design-contracts.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
```

- [ ] **Step 2: Add the test script and verify failure**

In `package.json`, add:

```json
"test:ui": "node --test tests/ui-design-contracts.mjs",
"test": "node --test tests/run-tests.mjs && npm run test:ui"
```

Run: `npm.cmd run test:ui`

Expected: FAIL because `src/styles/tokens.css` does not exist.

- [ ] **Step 3: Create exact foundation tokens**

Create `src/styles/tokens.css`:

```css
:root {
  --cfs-bg: #edf1ea;
  --cfs-surface: #fbfcf8;
  --cfs-surface-muted: #e6ece3;
  --cfs-ink: #19241d;
  --cfs-muted: #5d6b60;
  --cfs-border: #cbd6c8;
  --cfs-border-strong: #aebdaa;
  --cfs-accent: #496a50;
  --cfs-accent-hover: #3c5b43;
  --cfs-accent-soft: #e2ebe0;
  --cfs-accent-ink: #294330;
  --cfs-success: #287a49;
  --cfs-success-soft: #e0f0e4;
  --cfs-danger: #b93843;
  --cfs-danger-soft: #f8e5e7;
  --cfs-warning: #89621d;
  --cfs-warning-soft: #f6edd7;
  --cfs-info: #356b83;
  --cfs-info-soft: #e1edf2;
  --cfs-child-marigold: #c88b24;
  --cfs-child-coral: #bd6652;
  --cfs-child-sky: #4f7f95;
  --cfs-focus: #2f6f4b;
  --cfs-radius-sm: 8px;
  --cfs-radius: 10px;
  --cfs-space-1: 4px;
  --cfs-space-2: 8px;
  --cfs-space-3: 12px;
  --cfs-space-4: 16px;
  --cfs-space-5: 24px;
  --cfs-space-6: 32px;
  --cfs-shadow-sm: 0 1px 2px rgb(25 36 29 / 6%);
  --cfs-shadow-md: 0 14px 34px rgb(25 36 29 / 10%);
  --cfs-container: 1280px;
}
```

Create `src/styles/foundation.css`:

```css
:root {
  --bg: var(--cfs-bg);
  --card: var(--cfs-surface);
  --surface: var(--cfs-surface);
  --surface-muted: var(--cfs-surface-muted);
  --ink: var(--cfs-ink);
  --muted: var(--cfs-muted);
  --border: var(--cfs-border);
  --border-strong: var(--cfs-border-strong);
  --accent: var(--cfs-accent);
  --accent-hover: var(--cfs-accent-hover);
  --accent-soft: var(--cfs-accent-soft);
  --accent-ink: var(--cfs-accent-ink);
  --green: var(--cfs-success);
  --green-soft: var(--cfs-success-soft);
  --red: var(--cfs-danger);
  --red-soft: var(--cfs-danger-soft);
  --warning: var(--cfs-warning);
  --warning-soft: var(--cfs-warning-soft);
}
html { color-scheme: light; background: var(--cfs-bg); }
body { margin: 0; background: var(--cfs-bg); color: var(--cfs-ink); font-family: 'Sarabun', ui-sans-serif, system-ui, sans-serif; line-height: 1.55; }
a { color: inherit; }
:where(a, button, input, select, textarea):focus-visible { outline: 3px solid color-mix(in srgb, var(--cfs-focus) 34%, transparent); outline-offset: 2px; }
.cfs-page { width: min(var(--cfs-container), 100%); margin-inline: auto; padding: var(--cfs-space-6) var(--cfs-space-5) 80px; }
.cfs-surface { background: var(--cfs-surface); border: 1px solid var(--cfs-border); border-radius: var(--cfs-radius); box-shadow: var(--cfs-shadow-sm); }
.cfs-stack { display: flex; flex-direction: column; gap: var(--cfs-space-4); }
.cfs-muted { color: var(--cfs-muted); }
.cfs-button, .cfs-link-button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: var(--cfs-space-2); padding: 9px 16px; border: 1px solid transparent; border-radius: var(--cfs-radius-sm); font: inherit; font-weight: 700; text-decoration: none; }
.cfs-button-primary { color: #fff; background: var(--cfs-accent); }
.cfs-button-primary:hover { background: var(--cfs-accent-hover); }
.cfs-button-secondary { color: var(--cfs-ink); background: var(--cfs-surface); border-color: var(--cfs-border); }
@media (max-width: 720px) { .cfs-page { padding: var(--cfs-space-5) var(--cfs-space-4) 96px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
```

- [ ] **Step 4: Import layers after legacy CSS**

In `src/main.tsx`, keep Radix and legacy imports, then add:

```ts
import './styles/tokens.css';
import './styles/foundation.css';
import './styles/shared-components.css';
import './styles/shell.css';
import './styles/auth-family.css';
```

Create the three not-yet-populated CSS files with a one-line file-purpose comment so the contract can read them.

- [ ] **Step 5: Verify and commit**

Run: `npm.cmd run test:ui`

Expected: 2 tests PASS.

Run: `npm.cmd run typecheck`

Expected: exit 0.

Commit:

```bash
git add package.json src/main.tsx src/styles tests/ui-design-contracts.mjs
git commit -m "Add Calm Family Studio design foundation"
```

### Task 2: Add Shared Page and State Components

**Files:**
- Create: `src/components/PageHeader.tsx`
- Create: `src/components/AppState.tsx`
- Modify: `src/styles/shared-components.css`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Produces `PageHeader({ title, description?, eyebrow?, actions?, children? })`.
- Produces `AppState({ tone, title, description?, action? })` where tone is `loading | empty | error`.

- [ ] **Step 1: Add failing source contracts**

Append:

```js
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
```

Run: `npm.cmd run test:ui`

Expected: FAIL because both component files are missing.

- [ ] **Step 2: Implement `PageHeader`**

```tsx
import type { ReactNode } from 'react';

export function PageHeader({ title, description, eyebrow, actions, children }: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <span className="page-header-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 3: Implement `AppState`**

```tsx
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function AppState({ tone, title, description, action }: {
  tone: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = tone === 'loading' ? LoaderCircle : tone === 'error' ? CircleAlert : Inbox;
  return (
    <section
      className={`app-state app-state-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <Icon className={tone === 'loading' ? 'app-state-spinner' : undefined} aria-hidden="true" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="app-state-action">{action}</div>}
    </section>
  );
}
```

- [ ] **Step 4: Style shared components**

```css
.page-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--cfs-space-5); align-items: end; margin-bottom: var(--cfs-space-5); }
.page-header-copy { min-width: 0; }
.page-header-eyebrow { display: block; margin-bottom: var(--cfs-space-2); color: var(--cfs-muted); font-size: 13px; font-weight: 700; }
.page-header h1 { margin: 0; color: var(--cfs-ink); font-size: 32px; line-height: 1.2; }
.page-header p { max-width: 680px; margin: var(--cfs-space-2) 0 0; color: var(--cfs-muted); }
.page-header-actions { display: flex; flex-wrap: wrap; gap: var(--cfs-space-2); justify-content: flex-end; }
.app-state { min-height: 180px; display: grid; place-items: center; align-content: center; gap: var(--cfs-space-2); padding: var(--cfs-space-5); text-align: center; color: var(--cfs-muted); background: var(--cfs-surface); border: 1px solid var(--cfs-border); border-radius: var(--cfs-radius); }
.app-state > svg { width: 28px; height: 28px; color: var(--cfs-accent); }
.app-state h2, .app-state p { margin: 0; }
.app-state h2 { color: var(--cfs-ink); font-size: 20px; }
.app-state-error > svg { color: var(--cfs-danger); }
.app-state-spinner { animation: cfs-spin .8s linear infinite; }
@keyframes cfs-spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) {
  .page-header { grid-template-columns: 1fr; align-items: stretch; }
  .page-header h1 { font-size: 28px; }
  .page-header-actions { justify-content: stretch; }
  .page-header-actions > * { flex: 1 1 100%; }
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm.cmd run test:ui`

Expected: all UI contracts PASS.

Run: `npm.cmd run typecheck`

Expected: exit 0.

Commit:

```bash
git add src/components/PageHeader.tsx src/components/AppState.tsx src/styles/shared-components.css tests/ui-design-contracts.mjs
git commit -m "Add shared page and state components"
```

### Task 3: Build Responsive Parent App Shell

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/routes/parent/ParentLayout.tsx`
- Modify: `src/styles/shell.css`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Consumes `ReactNode` route content and an async `onLogout` callback.
- Produces desktop navigation and mobile destinations Home, Exercises, Children, and More.

- [ ] **Step 1: Add failing shell contracts**

Append:

```js
test('AppShell provides desktop and mobile navigation landmarks', () => {
  const source = read('src/components/AppShell.tsx');
  assert.match(source, /<header className="app-shell-header">/);
  assert.match(source, /className="app-shell-desktop-nav"/);
  assert.match(source, /className="app-shell-mobile-nav"/);
  assert.match(source, /aria-label="Main navigation"/);
  assert.match(source, /aria-label="Mobile navigation"/);
});
```

- [ ] **Step 2: Implement `AppShell`**

```tsx
import { BookOpen, House, LogOut, Menu, Settings2, Sparkles, Upload, UsersRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const desktopItems = [
  { to: '/play', label: 'ครอบครัว', icon: House },
  { to: '/parent', label: 'ดูแลข้อมูล', icon: Settings2, end: true },
  { to: '/parent/exercises', label: 'แบบฝึกหัด', icon: BookOpen },
  { to: '/parent/upload', label: 'อัปโหลด', icon: Upload },
  { to: '/parent/ai', label: 'AI', icon: Sparkles },
  { to: '/parent/children', label: 'เด็ก', icon: UsersRound },
];

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout: () => Promise<void> }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <div className="app-shell-header-inner">
          <NavLink to="/play" className="app-shell-brand"><span aria-hidden="true">K</span>Kids Tutor</NavLink>
          <nav className="app-shell-desktop-nav" aria-label="Main navigation">
            {desktopItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}><Icon aria-hidden="true" /><span>{label}</span></NavLink>
            ))}
          </nav>
          <button className="app-shell-logout" type="button" onClick={onLogout}><LogOut aria-hidden="true" />ออกจากระบบ</button>
        </div>
      </header>
      <main className="app-shell-main">{children}</main>
      {moreOpen && (
        <div className="app-shell-more" id="mobile-more-panel">
          <div className="app-shell-more-header"><b>เมนูเพิ่มเติม</b><button type="button" aria-label="ปิดเมนู" onClick={() => setMoreOpen(false)}><X aria-hidden="true" /></button></div>
          {desktopItems.filter((item) => ['/parent', '/parent/upload', '/parent/ai'].includes(item.to)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMoreOpen(false)}><Icon aria-hidden="true" />{label}</NavLink>
          ))}
          <button type="button" onClick={onLogout}><LogOut aria-hidden="true" />ออกจากระบบ</button>
        </div>
      )}
      <nav className="app-shell-mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/play"><House aria-hidden="true" /><span>ครอบครัว</span></NavLink>
        <NavLink to="/parent/exercises"><BookOpen aria-hidden="true" /><span>แบบฝึกหัด</span></NavLink>
        <NavLink to="/parent/children"><UsersRound aria-hidden="true" /><span>เด็ก</span></NavLink>
        <button type="button" aria-expanded={moreOpen} aria-controls="mobile-more-panel" onClick={() => setMoreOpen((open) => !open)}><Menu aria-hidden="true" /><span>เพิ่มเติม</span></button>
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Delegate layout from `ParentLayout`**

Keep its existing `/api/auth/me` guard and logout request. Replace the current navigation JSX with:

```tsx
return (
  <AppShell onLogout={logout}>
    <Outlet />
  </AppShell>
);
```

- [ ] **Step 4: Style responsive shell**

Create `src/styles/shell.css`:

```css
.app-shell { min-height: 100vh; }
.app-shell-header { position: sticky; top: 0; z-index: 40; min-height: 72px; background: rgb(251 252 248 / 96%); border-bottom: 1px solid var(--cfs-border); backdrop-filter: blur(14px); }
.app-shell-header-inner { width: min(var(--cfs-container), 100%); min-height: 72px; margin-inline: auto; padding-inline: var(--cfs-space-5); display: flex; align-items: center; gap: var(--cfs-space-4); }
.app-shell-brand { display: inline-flex; align-items: center; gap: var(--cfs-space-2); color: var(--cfs-ink); font-size: 18px; font-weight: 850; text-decoration: none; white-space: nowrap; }
.app-shell-brand > span { width: 36px; height: 36px; display: grid; place-items: center; color: #fff; background: var(--cfs-accent); border-radius: var(--cfs-radius-sm); }
.app-shell-desktop-nav { display: flex; align-items: center; gap: var(--cfs-space-1); }
.app-shell-desktop-nav a, .app-shell-logout { min-height: 44px; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; color: var(--cfs-muted); background: transparent; border: 0; border-radius: var(--cfs-radius-sm); font: inherit; font-weight: 700; text-decoration: none; }
.app-shell-desktop-nav a:hover, .app-shell-desktop-nav a.active { color: var(--cfs-accent-ink); background: var(--cfs-accent-soft); }
.app-shell-desktop-nav svg, .app-shell-logout svg { width: 18px; height: 18px; }
.app-shell-logout { margin-left: auto; }
.app-shell-main { width: min(var(--cfs-container), 100%); margin-inline: auto; padding: var(--cfs-space-6) var(--cfs-space-5) 80px; }
.app-shell-mobile-nav, .app-shell-more { display: none; }
@media (max-width: 980px) { .app-shell-desktop-nav a { padding-inline: 9px; } .app-shell-desktop-nav a span { display: none; } }
@media (max-width: 720px) {
  .app-shell-header, .app-shell-header-inner { min-height: 60px; }
  .app-shell-header-inner { padding-inline: var(--cfs-space-4); }
  .app-shell-desktop-nav, .app-shell-logout { display: none; }
  .app-shell-main { padding: var(--cfs-space-5) var(--cfs-space-4) calc(88px + env(safe-area-inset-bottom)); }
  .app-shell-mobile-nav { position: fixed; z-index: 50; inset: auto 0 0; min-height: 64px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: repeat(4, 1fr); background: rgb(251 252 248 / 98%); border-top: 1px solid var(--cfs-border); }
  .app-shell-mobile-nav a, .app-shell-mobile-nav button { min-height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--cfs-muted); background: transparent; border: 0; border-radius: var(--cfs-radius-sm); font: inherit; font-size: 12px; font-weight: 700; text-decoration: none; }
  .app-shell-mobile-nav a.active { color: var(--cfs-accent-ink); background: var(--cfs-accent-soft); }
  .app-shell-mobile-nav svg { width: 20px; height: 20px; }
  .app-shell-more { position: fixed; z-index: 49; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom)); width: min(320px, calc(100vw - 24px)); padding: var(--cfs-space-3); display: grid; gap: var(--cfs-space-1); color: var(--cfs-ink); background: var(--cfs-surface); border: 1px solid var(--cfs-border); border-radius: var(--cfs-radius); box-shadow: var(--cfs-shadow-md); }
  .app-shell-more a, .app-shell-more button { min-height: 44px; display: flex; align-items: center; gap: var(--cfs-space-2); padding: 8px 10px; color: var(--cfs-ink); background: transparent; border: 0; border-radius: var(--cfs-radius-sm); font: inherit; text-decoration: none; }
  .app-shell-more-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; }
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm.cmd test`

Expected: worker and UI tests PASS.

Run: `npm.cmd run build`

Expected: TypeScript and both Vite bundles complete successfully.

Commit:

```bash
git add src/components/AppShell.tsx src/routes/parent/ParentLayout.tsx src/styles/shell.css tests/ui-design-contracts.mjs
git commit -m "Add responsive family workspace shell"
```

### Task 4: Redesign Login and Signup

**Files:**
- Modify: `src/routes/parent/Login.tsx`
- Modify: `src/routes/parent/Signup.tsx`
- Modify: `src/styles/auth-family.css`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Preserve existing submit handlers, API payloads, navigation, and error translation.

- [ ] **Step 1: Add failing accessibility contracts**

Append:

```js
test('authentication forms use labels and autocomplete without nested controls', () => {
  for (const path of ['src/routes/parent/Login.tsx', 'src/routes/parent/Signup.tsx']) {
    const source = read(path);
    assert.match(source, /className="auth-shell"/);
    assert.match(source, /<label/);
    assert.match(source, /autoComplete=/);
    assert.doesNotMatch(source, /<Link[^>]*>\s*<button/);
  }
});
```

- [ ] **Step 2: Replace only the rendered markup**

Use `<main className="auth-shell">`, a brand link, `.auth-panel`, labelled fields, `autoComplete="email"`, `autoComplete="current-password"`, and `autoComplete="new-password"`. Keep errors in `role="alert"`. Use a styled `<Link className="text-link">` instead of a nested button.

- [ ] **Step 3: Style authentication**

Use a two-column composition above 900px with a short product statement and form panel; collapse to a single panel below 900px. Keep form measure under 480px, all fields 44px high, and links in moss with visible underline on hover/focus.

- [ ] **Step 4: Verify and commit**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit 0.

Commit:

```bash
git add src/routes/parent/Login.tsx src/routes/parent/Signup.tsx src/styles/auth-family.css tests/ui-design-contracts.mjs
git commit -m "Redesign parent authentication experience"
```

### Task 5: Redesign Family Homepage

**Files:**
- Modify: `src/routes/play/ProfilePicker.tsx`
- Modify: `src/styles/auth-family.css`
- Modify: `tests/ui-design-contracts.mjs`

**Interfaces:**
- Preserve `/api/play/family`, `/api/play/children`, `/api/play/select-child`, and navigation behavior.

- [ ] **Step 1: Add failing semantic contracts**

Append:

```js
test('family homepage uses semantic tiles and Lucide empty-state art', () => {
  const source = read('src/routes/play/ProfilePicker.tsx');
  assert.match(source, /<main className="family-home">/);
  assert.match(source, /LockKeyhole/);
  assert.doesNotMatch(source, /<Link[^>]*>\s*<button/);
});
```

- [ ] **Step 2: Recompose the page**

Use `AppState` for loading, login-required, and empty states. Render each child as one semantic button with `data-avatar={normalizeAvatar(ch.avatar).key}` and the parent tile as one semantic link. Keep `ChildAvatar`, name, and action text. Add a `.profile-tile-accent` decorative span rather than a saturated tile background.

- [ ] **Step 3: Style family tiles**

Use a centered heading, a responsive `repeat(auto-fit, minmax(210px, 1fr))` grid capped at three columns, light tiles, subtle borders, 8px radius, and avatar-specific accent custom properties. Hover raises border contrast and shadow without changing text color.

- [ ] **Step 4: Verify Phase 1**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit 0; record CSS and JS gzip sizes for comparison.

Manual checks:

- `/parent/login` and `/parent/signup` at 390 and 1440px.
- `/` signed out at 390 and 1024px.
- `/` signed in with long family and child names at 390, 768, and 1440px.
- Keyboard traversal shows focus and never focuses nested interactive controls.
- Mobile bottom navigation does not obscure route content.

- [ ] **Step 5: Commit Phase 1 checkpoint**

```bash
git add src/routes/play/ProfilePicker.tsx src/styles/auth-family.css tests/ui-design-contracts.mjs
git commit -m "Polish family member selection"
```
