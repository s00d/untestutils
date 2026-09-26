#!/usr/bin/env node
/**
 * Subprocess isolate-setup matrix (aligned with nuxt/test-utils#1821):
 * - isolate / file mode → setupNuxt once per file
 * - no-isolate worker maxWorkers=1|2 → once per worker
 * - fail-then-retry clears rejected promise (second file boots)
 * - no Vue double-mount warning
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const playground = fileURLToPath(new URL('..', import.meta.url));
const FILE_COUNT = 3;
const viteCache = join(playground, 'fixtures/unit-app/node_modules/.cache');

function clearViteCache() {
  rmSync(viteCache, { recursive: true, force: true });
}

function run(env = {}, extraArgs = [], setupLogFile) {
  clearViteCache();
  if (setupLogFile) writeFileSync(setupLogFile, '', 'utf8');
  return spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', 'vitest.isolate-setup.config.ts', ...extraArgs],
    {
      cwd: playground,
      env: {
        ...process.env,
        ...env,
        ...(setupLogFile ? { UT_SETUP_LOG_FILE: setupLogFile } : {}),
      },
      encoding: 'utf8',
    },
  );
}

function collectSetupCalls(text) {
  const matches = [...text.matchAll(/### setupNuxt called ### (\d+):(\S+)/g)];
  const byWorker = new Map();
  for (const m of matches) {
    const workerId = m[2];
    byWorker.set(workerId, (byWorker.get(workerId) ?? 0) + 1);
  }
  return { total: matches.length, byWorker };
}

function callsFrom(result, setupLogFile) {
  const fromStdout = collectSetupCalls(`${result.stdout || ''}\n${result.stderr || ''}`);
  if (!setupLogFile) return fromStdout;
  try {
    const fromFile = collectSetupCalls(readFileSync(setupLogFile, 'utf8'));
    return fromFile.total >= fromStdout.total ? fromFile : fromStdout;
  } catch {
    return fromStdout;
  }
}

function assertNoDoubleMount(result) {
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (text.includes('[Vue warn]: There is already an app instance mounted on the host container.')) {
    throw new Error('Vue double-mount warning detected');
  }
}

const dir = mkdtempSync(join(tmpdir(), 'ut-isolate-'));
try {
  // 1) file isolation (default isolate) → N boots
  {
    const logFile = join(dir, 'file.log');
    const result = run({ UT_APP_ISOLATION: 'file', UT_MAX_WORKERS: '1' }, ['--isolate'], logFile);
    assertNoDoubleMount(result);
    if (result.status !== 0) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      throw new Error(`file+isolate failed (exit ${result.status})`);
    }
    const calls = callsFrom(result, logFile);
    if (calls.total !== FILE_COUNT) {
      throw new Error(`file+isolate expected ${FILE_COUNT} setupNuxt calls, got ${calls.total}`);
    }
  }

  // 2) worker no-isolate maxWorkers=1 → 1 boot
  {
    const logFile = join(dir, 'worker1.log');
    const result = run(
      { UT_APP_ISOLATION: 'worker', UT_MAX_WORKERS: '1' },
      ['--no-isolate'],
      logFile,
    );
    assertNoDoubleMount(result);
    if (result.status !== 0) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      throw new Error(`worker maxWorkers=1 failed (exit ${result.status})`);
    }
    const calls = callsFrom(result, logFile);
    if (calls.total !== 1) {
      throw new Error(`worker maxWorkers=1 expected 1 setupNuxt call, got ${calls.total}`);
    }
    if (![...calls.byWorker.values()].every((c) => c === 1)) {
      throw new Error('worker maxWorkers=1 expected exactly one call per worker');
    }
  }

  // 3) worker no-isolate maxWorkers=2 → boots ∈ [1,2], one per worker
  {
    const logFile = join(dir, 'worker2.log');
    const result = run(
      { UT_APP_ISOLATION: 'worker', UT_MAX_WORKERS: '2' },
      ['--no-isolate'],
      logFile,
    );
    assertNoDoubleMount(result);
    if (result.status !== 0) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      throw new Error(`worker maxWorkers=2 failed (exit ${result.status})`);
    }
    const calls = callsFrom(result, logFile);
    if (calls.total < 1 || calls.total > 2) {
      throw new Error(`worker maxWorkers=2 expected boots in [1,2], got ${calls.total}`);
    }
    if (calls.total !== calls.byWorker.size) {
      throw new Error('worker maxWorkers=2 expected one setupNuxt per active worker');
    }
    if (![...calls.byWorker.values()].every((c) => c === 1)) {
      throw new Error('worker maxWorkers=2 expected exactly one call per worker');
    }
  }

  // 4) fail before first setup → cleared promise, remaining files boot
  {
    const logFile = join(dir, 'fail-before.log');
    const result = run(
      {
        UT_APP_ISOLATION: 'worker',
        UT_MAX_WORKERS: '1',
        ERROR_TEST_PATTERN: 'before',
      },
      ['--no-isolate'],
      logFile,
    );
    assertNoDoubleMount(result);
    if (result.status === 0) {
      throw new Error('expected fail-before run to exit non-zero');
    }
    const text = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (!text.includes('#### setupNuxt failed before ###')) {
      process.stderr.write(text);
      throw new Error('expected setupNuxt failed before error');
    }
    const calls = callsFrom(result, logFile);
    if (calls.total < 2) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      process.stderr.write(`\nsetup log:\n${readFileSync(logFile, 'utf8')}\n`);
      throw new Error(`fail-before expected >=2 setupNuxt calls after clear, got ${calls.total}`);
    }
  }

  // 5) fail after first setup mounts → still clear memo + later files boot, no double-mount
  {
    const logFile = join(dir, 'fail-after.log');
    const result = run(
      {
        UT_APP_ISOLATION: 'worker',
        UT_MAX_WORKERS: '1',
        ERROR_TEST_PATTERN: 'after',
      },
      ['--no-isolate'],
      logFile,
    );
    assertNoDoubleMount(result);
    if (result.status === 0) {
      throw new Error('expected fail-after run to exit non-zero');
    }
    const text = `${result.stdout || ''}\n${result.stderr || ''}`;
    if (!text.includes('#### setupNuxt failed after ###')) {
      process.stderr.write(text);
      throw new Error('expected setupNuxt failed after error');
    }
    const calls = callsFrom(result, logFile);
    if (calls.total < 2) {
      process.stderr.write(`\nsetup log:\n${readFileSync(logFile, 'utf8')}\n`);
      throw new Error(`fail-after expected >=2 setupNuxt calls after clear, got ${calls.total}`);
    }
  }

  console.log(JSON.stringify({ ok: true, fileCount: FILE_COUNT }, null, 2));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
