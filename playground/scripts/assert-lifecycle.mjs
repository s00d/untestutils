#!/usr/bin/env node
/**
 * Lifecycle stress matrix for shared Nuxt unit worker:
 * - double restart (no zombie / double-mount)
 * - reset failure → restart recovery
 * - fail-after boot cleanup (via isolate-setup assert)
 * - boot counter stays finite (no runaway remounts)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const playground = fileURLToPath(new URL('..', import.meta.url));

function run(config) {
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', config], {
    cwd: playground,
    encoding: 'utf8',
    env: { ...process.env },
  });
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (
    text.includes('[Vue warn]: There is already an app instance mounted on the host container.')
  ) {
    process.stderr.write(text);
    throw new Error(`Vue double-mount warning for ${config}`);
  }
  if (result.status !== 0) {
    process.stderr.write(text);
    throw new Error(`vitest failed for ${config} (exit ${result.status})`);
  }
  return text;
}

const hot = run('vitest.unit-worker-hot.config.ts');
if (!hot.includes('Test Files')) {
  throw new Error('unexpected vitest output for unit-worker-hot');
}

console.log(JSON.stringify({ ok: true, suites: ['unit-worker-hot'] }, null, 2));
