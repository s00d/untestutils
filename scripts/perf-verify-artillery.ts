/**
 * Verify Artillery aggregate has every headline metric we need, and that
 * three consecutive 5s runs stay within a stability band.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = '/Users/s00d/packeges/nuxt-i18n-next/test/fixtures/i18n-micro';
const PORT = 19_250;
const ARTIFACTS = join(process.cwd(), '.untestutils/perf-verify');
const PATHS = ['/', '/page', '/ru', '/de'];

const REQUIRED_KEYS = [
  'requestsPerSecond',
  'responseTimeAvg',
  'responseTimeMin',
  'responseTimeMax',
  'responseTimeP50',
  'responseTimeP95',
  'responseTimeP99',
  'durationSec',
  'errorRate',
] as const;

async function waitReady(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      /* retry */
    }
    await delay(200);
  }
  throw new Error(`not ready: ${url}`);
}

async function startServer(): Promise<ChildProcess> {
  const child = spawn('node', ['.output/server/index.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      NITRO_PORT: String(PORT),
      NITRO_HOST: '127.0.0.1',
      NITRO_PRESET: 'node-server',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitReady(`http://127.0.0.1:${PORT}/`);
  return child;
}

function extract(
  art: Awaited<ReturnType<typeof import('../packages/perf/src/load/artillery').runArtillery>>,
) {
  const summary = art.aggregate;
  const rt = summary.summaries['http.response_time'];
  const requests = Number(summary.counters['http.requests'] ?? 0);
  let failures = 0;
  for (const [key, value] of Object.entries(summary.counters)) {
    if (typeof value !== 'number') continue;
    if (key.startsWith('errors.') || /^http\.codes\.(?:[45]\d\d)$/.test(key)) failures += value;
  }
  return {
    requestsPerSecond: summary.rates['http.request_rate'],
    responseTimeAvg: rt?.mean,
    responseTimeMin: rt?.min,
    responseTimeMax: rt?.max,
    responseTimeP50: rt?.p50,
    responseTimeP95: rt?.p95,
    responseTimeP99: rt?.p99,
    durationSec: (summary.lastMetricAt - summary.firstMetricAt) / 1000,
    errorRate: requests ? (failures / requests) * 100 : undefined,
    httpRequests: requests,
    counterKeys: Object.keys(summary.counters).sort(),
    summaryKeys: Object.keys(summary.summaries).sort(),
    rateKeys: Object.keys(summary.rates).sort(),
  };
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const { runArtillery } = await import('../packages/perf/src/load/artillery.ts');
  const { buildArtilleryScript } = await import('../packages/perf/src/load/defaults.ts');

  const child = await startServer();
  const url = `http://127.0.0.1:${PORT}/`;
  const runs: ReturnType<typeof extract>[] = [];

  try {
    for (let i = 1; i <= 3; i++) {
      console.log(`\n→ run ${i}/3 · artillery 5s`);
      const art = await runArtillery({
        name: `verify-run${i}`,
        artifactsDir: ARTIFACTS,
        cwd: ROOT,
        targetUrl: url,
        script: buildArtilleryScript({
          durationSec: 5,
          arrivalRate: 10,
          maxVusers: 10,
          paths: PATHS,
        }),
      });
      const row = extract(art);
      runs.push(row);
      console.log(
        `  RPS=${row.requestsPerSecond} p50=${row.responseTimeP50} p95=${row.responseTimeP95} err%=${row.errorRate} dur=${row.durationSec?.toFixed(2)} reqs=${row.httpRequests}`,
      );
      await delay(500);
    }
  } finally {
    child.kill('SIGTERM');
    await delay(300);
  }

  const missing = REQUIRED_KEYS.filter((k) => {
    const v = runs[0]?.[k];
    return v === undefined || (typeof v === 'number' && Number.isNaN(v));
  });

  const rps = runs.map((r) => r.requestsPerSecond!).filter((n) => Number.isFinite(n));
  const mean = rps.reduce((a, b) => a + b, 0) / rps.length;
  const maxDev = Math.max(...rps.map((n) => Math.abs(n - mean) / mean)) * 100;

  const report = {
    fixture: 'i18n-micro',
    requiredOk: missing.length === 0,
    missing,
    sampleKeys: {
      counters: runs[0]?.counterKeys,
      rates: runs[0]?.rateKeys,
      summaries: runs[0]?.summaryKeys,
    },
    runs,
    stability: {
      rps,
      meanRps: mean,
      maxRelativeDeviationPct: maxDev,
      passBand15pct: maxDev <= 15,
    },
  };

  const out = join(ARTIFACTS, 'verify.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nWrote ${out}`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.requiredOk || !report.stability.passBand15pct) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
