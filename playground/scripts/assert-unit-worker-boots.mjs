#!/usr/bin/env node
/**
 * Runs unit-worker suites and asserts Nuxt plugin boot counts.
 *
 * - file mode (isolate default): boots === matched file count
 * - file mode + isolate:false: boots === matched file count (remount each file)
 * - worker mode maxWorkers=1: boots === 1
 * - worker mode maxWorkers=2: boots ∈ [1, 2]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const playground = fileURLToPath(new URL('..', import.meta.url));

function countSpecFiles() {
  return readdirSync(join(playground, 'unit-worker')).filter((name) =>
    /\.(test|spec)\.ts$/.test(name),
  ).length;
}

function runVitest(config, bootFile) {
  writeFileSync(bootFile, '0', 'utf8');
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', config], {
    cwd: playground,
    env: { ...process.env, UNTESTUTILS_BOOT_FILE: bootFile },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`vitest failed for ${config} (exit ${result.status})`);
  }
  if (
    (result.stderr || '').includes(
      '[Vue warn]: There is already an app instance mounted on the host container.',
    ) ||
    (result.stdout || '').includes(
      '[Vue warn]: There is already an app instance mounted on the host container.',
    )
  ) {
    throw new Error(`Vue double-mount warning for ${config}`);
  }
  return Number(readFileSync(bootFile, 'utf8').trim());
}

const fileCount = countSpecFiles();
if (fileCount < 1) throw new Error('no unit-worker specs found');

const dir = mkdtempSync(join(tmpdir(), 'ut-boots-'));
try {
  const fileBoots = runVitest('vitest.unit-worker-file.config.ts', join(dir, 'file.txt'));
  const fileNoIsolateBoots = runVitest(
    'vitest.unit-worker-file-no-isolate.config.ts',
    join(dir, 'file-no-isolate.txt'),
  );
  const workerBoots = runVitest('vitest.unit-worker-reuse.config.ts', join(dir, 'worker.txt'));
  const multiBoots = runVitest('vitest.unit-worker-multi.config.ts', join(dir, 'multi.txt'));

  if (fileBoots !== fileCount) {
    throw new Error(`file mode expected ${fileCount} boots, got ${fileBoots}`);
  }
  if (fileNoIsolateBoots !== fileCount) {
    throw new Error(
      `file+isolate:false expected ${fileCount} remount boots, got ${fileNoIsolateBoots}`,
    );
  }
  if (workerBoots !== 1) {
    throw new Error(`worker mode expected 1 boot, got ${workerBoots}`);
  }
  if (multiBoots < 1 || multiBoots > 2) {
    throw new Error(`worker multi expected boots in [1, 2], got ${multiBoots}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        fileCount,
        fileBoots,
        fileNoIsolateBoots,
        workerBoots,
        multiBoots,
        speedupHint: `${fileBoots}->${workerBoots} boots`,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
