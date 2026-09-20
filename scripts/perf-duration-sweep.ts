/**
 * Duration sweep: find Artillery phase length that keeps rank + gap,
 * with enough traffic that RPS isn't noise (~40).
 *
 * Usage: pnpm exec tsx scripts/perf-duration-sweep.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const I18N_ROOT = '/Users/s00d/packeges/nuxt-i18n-next';
const PORT_BASE = 19_300;
const ARTIFACTS = join(process.cwd(), '.untestutils/perf-duration-sweep');

const FIXTURES = [
  { id: 'plain-nuxt', dir: 'test/fixtures/plain-nuxt' },
  { id: 'i18n', dir: 'test/fixtures/i18n' },
  { id: 'i18n-micro', dir: 'test/fixtures/i18n-micro' },
] as const;

/** Harder than maxVU=10 — need headroom so RPS reflects the app, not VU cap. */
const ARRIVAL = 40;
const MAX_VU = 40;
const WARM_SEC = 2;
const WARM_ARRIVAL = 10;
const DURATIONS = [5, 10, 15, 20, 30] as const;
const PATHS = ['/', '/page', '/ru', '/de', '/fr', '/ru/page', '/de/page', '/fr/page'];
const REPEATS = 2; // per duration×fixture — mean RPS

type Cell = { durationSec: number; fixture: string; rps: number[]; mean: number; reqs: number[] };

async function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

async function waitReady(url: string, timeoutMs = 45_000): Promise<void> {
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

async function startServer(root: string, port: number): Promise<ChildProcess> {
  const child = spawn('node', ['.output/server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      NITRO_HOST: '127.0.0.1',
      NITRO_PRESET: 'node-server',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', (b: Buffer) => {
    const t = b.toString().trim();
    if (t) console.error(`  [srv] ${t.slice(0, 120)}`);
  });
  await waitReady(`http://127.0.0.1:${port}/`);
  return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  child.kill('SIGTERM');
  await delay(400);
  if (!child.killed) child.kill('SIGKILL');
}

function rank(means: Record<string, number>): string[] {
  return Object.entries(means)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

function gap(means: Record<string, number>, a: string, b: string): number | undefined {
  const x = means[a];
  const y = means[b];
  if (!x || !y) return undefined;
  return x / y;
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const { runArtillery } = await import('../packages/perf/src/load/artillery.ts');
  const { buildArtilleryScript } = await import('../packages/perf/src/load/script.ts');
  const { runAutocannon } = await import('../packages/perf/src/load/autocannon.ts');

  const cells: Cell[] = [];
  const acByFixture: Record<string, number> = {};

  // ── Autocannon baseline (10c × 10s) once per fixture ──
  console.log('\n══ autocannon baseline 10c×10s');
  for (let i = 0; i < FIXTURES.length; i++) {
    const fx = FIXTURES[i]!;
    const port = PORT_BASE + i;
    const root = join(I18N_ROOT, fx.dir);
    if (!(await portFree(port))) throw new Error(`port ${port} busy`);
    const child = await startServer(root, port);
    try {
      const ac = await runAutocannon({
        url: `http://127.0.0.1:${port}/`,
        connections: 10,
        durationSec: 10,
        artifactsDir: ARTIFACTS,
        name: `ac-${fx.id}`,
      });
      acByFixture[fx.id] = ac.requests.average;
      console.log(`  ${fx.id}: RPS ${ac.requests.average.toFixed(1)}`);
    } finally {
      await stopServer(child);
    }
    await delay(800);
  }

  // ── Artillery duration sweep ──
  for (const durationSec of DURATIONS) {
    console.log(`\n══ artillery main ${durationSec}s · arrival ${ARRIVAL} maxVU ${MAX_VU}`);
    for (let i = 0; i < FIXTURES.length; i++) {
      const fx = FIXTURES[i]!;
      const port = PORT_BASE + 10 + i;
      const root = join(I18N_ROOT, fx.dir);
      if (!(await portFree(port))) throw new Error(`port ${port} busy`);
      const child = await startServer(root, port);
      const url = `http://127.0.0.1:${port}/`;
      const rps: number[] = [];
      const reqs: number[] = [];
      try {
        for (let rep = 1; rep <= REPEATS; rep++) {
          console.log(`  → ${fx.id} · ${durationSec}s · rep ${rep}/${REPEATS}`);
          const art = await runArtillery({
            name: `${fx.id}-${durationSec}s-r${rep}`,
            artifactsDir: ARTIFACTS,
            cwd: root,
            targetUrl: url,
            script: buildArtilleryScript({
              durationSec,
              arrivalRate: ARRIVAL,
              maxVusers: MAX_VU,
              warmUpSec: WARM_SEC,
              warmUpArrivalRate: WARM_ARRIVAL,
              paths: PATHS,
            }),
          });
          const rate = art.aggregate.rates['http.request_rate'] ?? 0;
          const n = Number(art.aggregate.counters['http.requests'] ?? 0);
          rps.push(rate);
          reqs.push(n);
          console.log(`     RPS ${rate} · reqs ${n}`);
          await delay(600);
        }
      } finally {
        await stopServer(child);
      }
      const mean = rps.reduce((a, b) => a + b, 0) / rps.length;
      cells.push({ durationSec, fixture: fx.id, rps, mean, reqs });
      await delay(800);
    }
  }

  // ── Score each duration ──
  const byDur: Record<number, Record<string, number>> = {};
  for (const c of cells) {
    byDur[c.durationSec] ??= {};
    byDur[c.durationSec]![c.fixture] = c.mean;
  }

  const expectedOrder = ['i18n-micro', 'i18n', 'plain-nuxt'];
  const acRank = rank(acByFixture);
  const acGapMicroI18n = gap(acByFixture, 'i18n-micro', 'i18n');

  const scores = DURATIONS.map((d) => {
    const means = byDur[d]!;
    const r = rank(means);
    const rankOk = r.join() === expectedOrder.join();
    const g = gap(means, 'i18n-micro', 'i18n');
    const gapDeltaPct =
      g !== undefined && acGapMicroI18n
        ? (Math.abs(g - acGapMicroI18n) / acGapMicroI18n) * 100
        : Infinity;
    const minReqs = Math.min(...cells.filter((c) => c.durationSec === d).flatMap((c) => c.reqs));
    const minRps = Math.min(...Object.values(means));
    // Prefer: correct rank, gap close to autocannon, enough samples, not endless wall time
    const wallSec = (WARM_SEC + d) * FIXTURES.length * REPEATS;
    let score = 0;
    if (rankOk) score += 100;
    if (gapDeltaPct <= 15) score += 40;
    else if (gapDeltaPct <= 25) score += 20;
    if (minReqs >= 500) score += 20;
    if (minRps >= 80) score += 15;
    // mild preference for shorter once quality is ok
    score += Math.max(0, 30 - d);
    return {
      durationSec: d,
      rank: r,
      rankOk,
      means,
      microI18nGap: g,
      gapDeltaPctVsAutocannon: gapDeltaPct,
      minReqs,
      minRps,
      wallSecApprox: wallSec,
      score,
    };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0]!;

  const report = {
    knobs: { ARRIVAL, MAX_VU, WARM_SEC, WARM_ARRIVAL, PATHS, REPEATS, DURATIONS },
    autocannonBaseline10s: { rps: acByFixture, rank: acRank, microI18nGap: acGapMicroI18n },
    cells,
    scores,
    recommendedDurationSec: best.durationSec,
    reason: best.rankOk
      ? `rank ok, gapΔ ${best.gapDeltaPctVsAutocannon.toFixed(1)}% vs autocannon, minReqs ${best.minReqs}`
      : `best score among broken ranks — tune arrivalRate/maxVU further`,
  };

  const out = join(ARTIFACTS, 'sweep.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n══ recommendation: ${best.durationSec}s (score ${best.score})`);
  console.log(JSON.stringify(scores, null, 2));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
