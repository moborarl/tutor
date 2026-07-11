const baseUrl = process.env.SMOKE_BASE_URL ?? 'https://kids-tutor.nupark.workers.dev';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!email || !password) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD before running authenticated smoke checks.');
  console.error('Example: $env:SMOKE_EMAIL="parent@example.com"; $env:SMOKE_PASSWORD="..." ; npm run smoke:auth');
  process.exit(1);
}

const jar = new Map();
const tempSubjectName = `Smoke วิชา ${Date.now()}`;
let createdSubjectId = null;
let failures = 0;

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function storeCookies(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return;
  for (const part of setCookie.split(/,(?=\s*[^;,=]+=[^;,]+)/)) {
    const [pair] = part.trim().split(';');
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (jar.size > 0) headers.set('cookie', cookieHeader());
  const res = await fetch(new URL(path, baseUrl), { ...init, headers });
  storeCookies(res);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  }
}

await check('parent login', async () => {
  const { res, body } = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200 || body?.ok !== true) throw new Error(`expected login 200, got ${res.status}`);
});

await check('load parent exercises', async () => {
  const { res, body } = await request('/api/parent/exercise-sets');
  if (res.status !== 200 || !Array.isArray(body)) throw new Error(`expected exercise list, got ${res.status}`);
});

await check('create temporary subject', async () => {
  const { res, body } = await request('/api/parent/subjects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: tempSubjectName }),
  });
  if (![200, 201].includes(res.status) || typeof body?.id !== 'number') throw new Error(`expected subject id, got ${res.status}`);
  createdSubjectId = body.id;
});

await check('temporary subject appears in list', async () => {
  const { res, body } = await request('/api/parent/subjects');
  if (res.status !== 200 || !Array.isArray(body)) throw new Error(`expected subject list, got ${res.status}`);
  if (!body.some((subject) => subject.id === createdSubjectId && subject.name === tempSubjectName)) {
    throw new Error('created subject was not returned by subject list');
  }
});

await check('delete temporary subject', async () => {
  if (createdSubjectId == null) throw new Error('no subject id to delete');
  const { res, body } = await request(`/api/parent/subjects/${createdSubjectId}`, { method: 'DELETE' });
  if (res.status !== 200 || body?.ok !== true) throw new Error(`expected delete ok, got ${res.status}`);
});

await check('load family children', async () => {
  const { res, body } = await request('/api/play/children');
  if (res.status !== 200 || !Array.isArray(body)) throw new Error(`expected children list, got ${res.status}`);
});

await check('load parent admin summary', async () => {
  const { res, body } = await request('/api/parent/admin/summary');
  if (res.status !== 200 || typeof body?.counts !== 'object') throw new Error(`expected admin summary, got ${res.status}`);
  if (typeof body.counts.exerciseSets !== 'number') throw new Error('admin summary missing exerciseSets count');
});

await check('load parent R2 file list', async () => {
  const { res, body } = await request('/api/parent/admin/r2-files');
  if (res.status !== 200 || !Array.isArray(body?.files)) throw new Error(`expected R2 file list, got ${res.status}`);
});

if (process.env.SMOKE_SUPER_ADMIN_TOKEN) {
  await check('load super-admin summary', async () => {
    const { res, body } = await request('/api/super-admin/summary', {
      headers: { 'x-super-admin-token': process.env.SMOKE_SUPER_ADMIN_TOKEN },
    });
    if (res.status !== 200 || typeof body?.totals !== 'object') throw new Error(`expected super-admin summary, got ${res.status}`);
  });
}

if (failures > 0) {
  console.error(`\n${failures} authenticated smoke check(s) failed.`);
  process.exit(1);
}

console.log('\nAuthenticated smoke checks passed.');
