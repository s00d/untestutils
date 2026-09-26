#!/usr/bin/env node
/**
 * Mean-of-3 wall-clock A/B: file-scoped vs worker-scoped Nuxt unit setup.
 * Writes playground/unit-bench/results.json
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const playground = join(scriptsDir, '..');
const require = createRequire(join(playground, 'package.json'));

function pkgVersion(name) {
  try {
    return require(`${name}/package.json`).version;
  } catch {
    return 'unknown';
  }
}

function runOnce(config) {
  const started = performance.now();
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', config], {
    cwd: playground,
    encoding: 'utf8',
    env: process.env,
  });
  const ms = performance.now() - started;
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`vitest failed for ${config}`);
  }
  return ms;
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const rounds = 3;
const fileMs = [];
const workerMs = [];

for (let i = 0; i < rounds; i++) {
  fileMs.push(runOnce('vitest.unit-bench-file.config.ts'));
  workerMs.push(runOnce('vitest.unit-bench-worker.config.ts'));
}

const payload = {
  vitest: pkgVersion('vitest'),
  nuxt: pkgVersion('nuxt'),
  files: 12,
  maxWorkers: 1,
  rounds,
  fileMs,
  fileMeanMs: mean(fileMs),
  workerMs,
  workerMeanMs: mean(workerMs),
  speedup: mean(fileMs) / mean(workerMs),
  capturedAt: new Date().toISOString(),
};

const out = join(playground, 'unit-bench/results.json');
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(payload, null, 2));
