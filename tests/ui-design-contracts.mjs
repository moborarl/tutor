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
