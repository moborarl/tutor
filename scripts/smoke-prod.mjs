const baseUrl = process.env.SMOKE_BASE_URL ?? 'https://kids-tutor.nupark.workers.dev';

const checks = [
  {
    name: 'health endpoint',
    path: '/api/health',
    status: 200,
    includes: '"ok":true',
  },
  {
    name: 'AI contract',
    path: '/contract',
    status: 200,
    includes: 'AI Contract',
  },
  {
    name: 'family homepage shell',
    path: '/play',
    status: 200,
    includes: 'Kids Tutor',
  },
  {
    name: 'parent page shell',
    path: '/parent',
    status: 200,
    includes: 'Kids Tutor',
  },
  {
    name: 'avatar asset',
    path: '/avatars/panda.png',
    status: 200,
    contentType: 'image/png',
  },
  {
    name: 'bad ingest token is rejected',
    path: '/api/ingest/bad-token-for-smoke-test',
    method: 'POST',
    status: 401,
    body: JSON.stringify({ title: 'smoke', questions: [] }),
    headers: { 'content-type': 'application/json' },
  },
];

let failures = 0;

for (const check of checks) {
  const url = new URL(check.path, baseUrl);
  try {
    const res = await fetch(url, {
      method: check.method ?? 'GET',
      headers: check.headers,
      body: check.body,
      redirect: 'manual',
    });
    const text = check.contentType ? '' : await res.text();
    const contentType = res.headers.get('content-type') ?? '';
    const statusOk = res.status === check.status;
    const bodyOk = !check.includes || text.includes(check.includes);
    const typeOk = !check.contentType || contentType.includes(check.contentType);

    if (statusOk && bodyOk && typeOk) {
      console.log(`PASS ${check.name}`);
      continue;
    }

    failures += 1;
    console.error(`FAIL ${check.name}`);
    console.error(`  ${url}`);
    console.error(`  expected status ${check.status}, got ${res.status}`);
    if (check.includes && !bodyOk) console.error(`  missing text: ${check.includes}`);
    if (check.contentType && !typeOk) console.error(`  expected content-type containing ${check.contentType}, got ${contentType || '(none)'}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL ${check.name}`);
    console.error(`  ${url}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} production smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\nProduction smoke checks passed: ${checks.length}/${checks.length}`);
