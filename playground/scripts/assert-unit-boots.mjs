#!/usr/bin/env node
/**
 * Asserts unit boot counts for a framework:
 * - file mode (2 specs) → boots === 2
 * - worker mode maxWorkers=1 (2 specs) → boots === 1
 *
 * Usage: node assert-unit-boots.mjs <framework>
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const playground = fileURLToPath(new URL('..', import.meta.url));
const fw = process.argv[2];
if (!fw) {
  console.error('usage: node assert-unit-boots.mjs <framework>');
  process.exit(2);
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
  return Number(readFileSync(bootFile, 'utf8').trim());
}

const dir = mkdtempSync(join(tmpdir(), `ut-${fw}-boots-`));
try {
  const fileBoots = runVitest(`vitest.unit-${fw}-file.config.ts`, join(dir, 'file.txt'));
  const workerBoots = runVitest(`vitest.unit-${fw}-worker.config.ts`, join(dir, 'worker.txt'));

  if (fileBoots !== 2) {
    throw new Error(`file mode expected 2 boots, got ${fileBoots}`);
  }
  if (workerBoots !== 1) {
    throw new Error(`worker mode expected 1 boot, got ${workerBoots}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        framework: fw,
        fileBoots,
        workerBoots,
        speedupHint: `${fileBoots}->${workerBoots} boots`,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
