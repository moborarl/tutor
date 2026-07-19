const baseUrl = process.env.SMOKE_BASE_URL ?? 'https://kids-tutor.nupark.workers.dev';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const shouldStartAttempt = process.env.SMOKE_CHILD_START_ATTEMPT === '1';

if (!email || !password) {
  console.error('Set SMOKE_EMAIL and SMOKE_PASSWORD before running child smoke checks.');
  console.error('Example: $env:SMOKE_EMAIL="parent@example.com"; $env:SMOKE_PASSWORD="..." ; npm run smoke:child');
  process.exit(1);
}

const jar = new Map();
let failures = 0;
let selectedChild = null;
let selectedExercise = null;

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
    const result = await fn();
    console.log(result === 'skip' ? `SKIP ${name}` : `PASS ${name}`);
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

await check('load children', async () => {
  const { res, body } = await request('/api/play/children');
  if (res.status !== 200 || !Array.isArray(body)) throw new Error(`expected children list, got ${res.status}`);
  selectedChild = body[0] ?? null;
  if (!selectedChild) return 'skip';
});

await check('select child session', async () => {
  if (!selectedChild) return 'skip';
  const { res, body } = await request('/api/play/select-child', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ childId: selectedChild.id }),
  });
  if (res.status !== 200 || body?.child?.id !== selectedChild.id) {
    throw new Error(`expected selected child ${selectedChild.id}, got ${res.status}`);
  }
});

await check('load child exercise list', async () => {
  if (!selectedChild) return 'skip';
  const { res, body } = await request('/api/play/exercises');
  if (res.status !== 200 || !Array.isArray(body)) throw new Error(`expected exercise list, got ${res.status}`);
  selectedExercise = body.find((exercise) => Number(exercise.questionCount ?? 0) > 0) ?? body[0] ?? null;
  if (!selectedExercise) return 'skip';
});

await check('load first assigned exercise', async () => {
  if (!selectedExercise) return 'skip';
  const { res, body } = await request(`/api/play/exercises/${selectedExercise.id}`);
  if (res.status !== 200 || body?.id !== selectedExercise.id || !Array.isArray(body?.questions)) {
    throw new Error(`expected exercise detail ${selectedExercise.id}, got ${res.status}`);
  }
});

await check('start or resume attempt when enabled', async () => {
  if (!shouldStartAttempt) return 'skip';
  if (!selectedExercise) return 'skip';
  const { res, body } = await request('/api/play/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ exerciseSetId: selectedExercise.id }),
  });
  if (![200, 201].includes(res.status) || typeof body?.attemptId !== 'number') {
    throw new Error(`expected attempt id, got ${res.status}`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} child smoke check(s) failed.`);
  process.exit(1);
}

console.log('\nChild smoke checks passed.');
