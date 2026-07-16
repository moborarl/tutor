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

test('child tree uses names while detail workspace owns the avatar', () => {
  const source = read('src/routes/parent/ChildrenList.tsx');
  assert.match(source, /PageHeader/);
  assert.match(source, /EntityList/);
  const treeBlock = source.match(/const treeItems[\s\S]*?;\r?\n/)?.[0] ?? '';
  assert.doesNotMatch(treeBlock, /ChildAvatar/);
  assert.match(source, /<ChildAvatar/);
});
