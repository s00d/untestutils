import { defineCommand, runMain } from 'citty';
import { consola } from 'consola';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = join(ROOT, 'examples/mass-nuxt');
const OUT = join(ROOT, 'docs/public/demo');

const ESC = String.fromCharCode(27);

function stripAnsi(s: string): string {
  return s.split(ESC).join('\0').replace(/\0\[[0-9;]*m/g, '').replace(/\0/g, '');
}

function runPnpm(args: string[], wipeSession?: string): { code: number; log: string; wallMs: number } {
  if (wipeSession) {
    rmSync(join(ROOT, '.untestutils/sessions', wipeSession), { recursive: true, force: true });
  }
  const started = Date.now();
  try {
    const log = execFileSync('pnpm', args, {
      cwd: EXAMPLE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
      maxBuffer: 32 * 1024 * 1024,
    });
    return { code: 0, log, wallMs: Date.now() - started };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    const log = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    return { code: err.status ?? 1, log, wallMs: Date.now() - started };
  }
}

function parseVitestSummary(log: string): {
  files: number;
  tests: number;
  durationSec: number;
  excerpt: string[];
} {
  const plain = stripAnsi(log);
  const files = Number(plain.match(/Test Files\s+(\d+)\s+passed/)?.[1] ?? 0);
  const tests = Number(plain.match(/Tests\s+(\d+)\s+passed/)?.[1] ?? 0);
  const durationSec = Number(plain.match(/Duration\s+([\d.]+)s/)?.[1] ?? 0);
  const lines = plain.split(/\r?\n/);
  const excerpt = lines.filter((l) =>
    /prepare once|cached|warm|Test Files|Tests\s+\d|Duration|mass run|recipes prepared|teardown/.test(
      l,
    ),
  );
  return {
    files,
    tests,
    durationSec,
    excerpt: excerpt.slice(0, 20).length ? excerpt.slice(0, 20) : lines.slice(-24),
  };
}

const main = defineCommand({
  meta: {
    name: 'demo:capture',
    description:
      'Run mass-nuxt shared + naive browser suites (measured) and refresh docs/public/demo',
  },
  async run() {
    mkdirSync(OUT, { recursive: true });

    consola.info('shared: one Nuxt recipe, prepare once, browser scenarios…');
    const shared = runPnpm(['test:shared'], 'mass-shared');
    writeFileSync(join(OUT, 'shared.log'), shared.log);
    if (shared.code !== 0) {
      consola.error('shared suite expected PASS');
      process.exitCode = 1;
      return;
    }
    const sharedSummary = parseVitestSummary(shared.log);
    if (sharedSummary.tests < 100) {
      consola.error(`shared: expected ~150 tests, got ${sharedSummary.tests}`);
      process.exitCode = 1;
      return;
    }

    consola.info('naive: one Nuxt recipe id per file (ordinary per-file prepare)…');
    const naive = runPnpm(['test:naive'], 'mass-naive');
    writeFileSync(join(OUT, 'naive.log'), naive.log);
    if (naive.code !== 0) {
      consola.error('naive suite expected PASS');
      process.exitCode = 1;
      return;
    }
    const naiveSummary = parseVitestSummary(naive.log);
    if (naiveSummary.tests < 100) {
      consola.error(`naive: expected ~150 tests, got ${naiveSummary.tests}`);
      process.exitCode = 1;
      return;
    }

    const sharedWallSec = Math.round((shared.wallMs / 1000) * 10) / 10;
    const naiveWallSec = Math.round((naive.wallMs / 1000) * 10) / 10;
    const speedup =
      shared.wallMs > 0 ? Math.round((naive.wallMs / shared.wallMs) * 10) / 10 : 0;

    const results = {
      files: sharedSummary.files,
      tests: sharedSummary.tests,
      kind: 'browser-hydration',
      measuredAt: new Date().toISOString(),
      shared: {
        label: 'untestutils — shared prepare',
        body: 'One Nuxt recipe id for all files — build/start once, then 10 files hit the same live URL with Playwright.',
        wallSec: sharedWallSec,
        durationSec: sharedSummary.durationSec,
        tests: sharedSummary.tests,
        files: sharedSummary.files,
        command: 'pnpm test:shared',
        excerpt: sharedSummary.excerpt,
      },
      naive: {
        label: 'Ordinary — prepare per file',
        body: 'Same scenarios, but each of 10 files uses its own Nuxt recipe id (own prepare/start). No shared host.',
        wallSec: naiveWallSec,
        durationSec: naiveSummary.durationSec,
        tests: naiveSummary.tests,
        files: naiveSummary.files,
        command: 'pnpm test:naive',
        excerpt: naiveSummary.excerpt,
      },
      speedup,
    };

    writeFileSync(join(OUT, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
    // drop stale mass.log name if present
    rmSync(join(OUT, 'mass.log'), { force: true });
    consola.success(
      `wrote ${OUT} — shared ${sharedWallSec}s vs naive ${naiveWallSec}s (${speedup}×)`,
    );
  },
});

runMain(main);
