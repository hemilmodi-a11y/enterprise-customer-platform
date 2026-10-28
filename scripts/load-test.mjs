const baseUrl = process.env.LOAD_TEST_BASE_URL;
const email = process.env.LOAD_TEST_EMAIL;
const password = process.env.LOAD_TEST_PASSWORD;

if (!baseUrl || !email || !password) {
  throw new Error(
    'Set LOAD_TEST_BASE_URL, LOAD_TEST_EMAIL, and LOAD_TEST_PASSWORD.',
  );
}

const requestCount = Number(process.env.LOAD_TEST_REQUESTS ?? 100);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 10);
if (
  !Number.isInteger(requestCount) ||
  requestCount < 1 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1
) {
  throw new Error(
    'Load-test request and concurrency values must be positive integers.',
  );
}

const base = new URL(baseUrl);
const target = new URL(
  process.env.LOAD_TEST_ENDPOINT ??
    '/api/v1/services?page=1&limit=20&sortBy=name&sortOrder=ASC',
  base,
);
if (target.origin !== base.origin) {
  throw new Error('The load-test endpoint must use the base URL origin.');
}

const login = await fetch(new URL('/api/v1/auth/login', base), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  throw new Error(`Load-test login failed with HTTP ${login.status}.`);
}

const { accessToken } = await login.json();
const headers = { authorization: `Bearer ${accessToken}` };
const warmup = await fetch(target, { headers });
await warmup.arrayBuffer();
if (!warmup.ok) {
  throw new Error(`Load-test warm-up failed with HTTP ${warmup.status}.`);
}

let nextRequest = 0;
const timings = [];
const statusCodes = {};
const startedAt = performance.now();

await Promise.all(
  Array.from({ length: Math.min(concurrency, requestCount) }, async () => {
    while (true) {
      const requestIndex = nextRequest;
      nextRequest += 1;
      if (requestIndex >= requestCount) {
        return;
      }

      const requestStartedAt = performance.now();
      const response = await fetch(target, { headers });
      await response.arrayBuffer();
      timings.push(performance.now() - requestStartedAt);
      statusCodes[response.status] = (statusCodes[response.status] ?? 0) + 1;
    }
  }),
);

const elapsedMs = performance.now() - startedAt;
timings.sort((left, right) => left - right);
const percentile = (fraction) =>
  timings[Math.ceil(fraction * timings.length) - 1];
const result = {
  endpoint: `${target.pathname}${target.search}`,
  requests: requestCount,
  concurrency: Math.min(concurrency, requestCount),
  elapsedMs: Number(elapsedMs.toFixed(1)),
  requestsPerSecond: Number((requestCount / (elapsedMs / 1000)).toFixed(2)),
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
  statusCodes,
};
console.log(JSON.stringify(result));

if (
  Object.keys(statusCodes).some(
    (status) => Number(status) < 200 || Number(status) >= 300,
  )
) {
  process.exitCode = 1;
}
