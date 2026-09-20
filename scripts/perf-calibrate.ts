/**
 * One-shot load-duration calibration against existing nuxt-i18n-next fixture builds.
 * Usage: tsx scripts/perf-calibrate.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const I18N_ROOT = '/Users/s00d/packeges/nuxt-i18n-next';
const PORT_BASE = 19_100;
const ARTIFACTS = join(process.cwd(), '.untestutils/perf-calibrate');

const FIXTURES = [
  { id: 'plain-nuxt', dir: 'test/fixtures/plain-nuxt' },
  { id: 'i18n', dir: 'test/fixtures/i18n' },
  { id: 'i18n-micro', dir: 'test/fixtures/i18n-micro' },
] as const;

type Row = {
  id: string;
  ac5?: number;
  ac10?: number;
  artShort?: number;
};

async function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

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
    if (t) console.error(`  [srv] ${t.slice(0, 160)}`);
  });
  await waitReady(`http://127.0.0.1:${port}/`);
  return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  child.kill('SIGTERM');
  await delay(300);
  if (!child.killed) child.kill('SIGKILL');
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });
  const { runAutocannon } = await import('../packages/perf/src/load/autocannon.ts');
  const { runArtillery } = await import('../packages/perf/src/load/artillery.ts');

  const rows: Row[] = [];

  for (let i = 0; i < FIXTURES.length; i++) {
    const fx = FIXTURES[i]!;
    const port = PORT_BASE + i;
    const root = join(I18N_ROOT, fx.dir);
    if (!(await portFree(port))) throw new Error(`port ${port} busy`);

    console.log(`\n══ ${fx.id} @ :${port}`);
    const child = await startServer(root, port);
    const url = `http://127.0.0.1:${port}/`;
    const row: Row = { id: fx.id };

    try {
      console.log('  → autocannon 5s');
      const a5 = await runAutocannon({
        url,
        connections: 10,
        durationSec: 5,
        artifactsDir: ARTIFACTS,
        name: `${fx.id}-ac5`,
      });
      row.ac5 = a5.requests.average;
      console.log(`     RPS ${row.ac5.toFixed(1)}`);

      await delay(500);

      console.log('  → autocannon 10s');
      const a10 = await runAutocannon({
        url,
        connections: 10,
        durationSec: 10,
        artifactsDir: ARTIFACTS,
        name: `${fx.id}-ac10`,
      });
      row.ac10 = a10.requests.average;
      console.log(`     RPS ${row.ac10.toFixed(1)}`);

      await delay(500);

      console.log('  → artillery 2s+8s');
      const art = await runArtillery({
        name: `${fx.id}-short`,
        artifactsDir: ARTIFACTS,
        cwd: root,
        targetUrl: url,
        script: {
          config: {
            target: url,
            phases: [
              { duration: 2, arrivalRate: 6 },
              { duration: 8, arrivalRate: 60 },
            ],
          },
          scenarios: [
            {
              name: 'cal',
              flow: [
                { get: { url: '/' } },
                { get: { url: '/page' } },
                { get: { url: '/ru' } },
                { get: { url: '/de' } },
              ],
            },
          ],
        },
      });
      row.artShort = art.aggregate.rates['http.request_rate'];
      console.log(`     RPS ${row.artShort ?? '—'}`);
    } finally {
      await stopServer(child);
    }

    rows.push(row);
  }

  const outPath = join(ARTIFACTS, 'calibration.json');
  writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`\nWrote ${outPath}`);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
