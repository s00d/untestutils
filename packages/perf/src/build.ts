import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { join, resolve } from 'pathe';
import { contentHash, hashString } from '@untestutils/core';
import { measureBundle } from './bundle';
import { ProcessSampler } from './process-sample';
import type { BuildMetrics, PerfTarget } from './types';
import type { HarnessOpts } from './ui';

/**
 * High-signal Nuxt/Nitro lifecycle lines only.
 * Excludes Nitro file trees (`.output/…`, box-drawing chunk lists).
 */
export function defaultLogFilter(line: string): boolean {
  if (/[├└│]/.test(line) || /\.output\//.test(line)) return false;
  return (
    /\b(Building|built|ERROR|WARN|preset|complete)\b/i.test(line) ||
    /✔|✓|✨/.test(line) ||
    /Client built|Server built|Nitro server built|Build complete/i.test(line)
  );
}

const emptyProcess = {
  maxMemoryMb: 0,
  minMemoryMb: 0,
  avgMemoryMb: 0,
  maxCpuPct: 0,
  minCpuPct: 0,
  avgCpuPct: 0,
};

const BUILD_HASH_FILE = '.perf-build-hash';

function outputDir(target: PerfTarget): string {
  return resolve(target.root, target.build.outputDir ?? '.output');
}

function hashSidecar(target: PerfTarget): string {
  return join(outputDir(target), BUILD_HASH_FILE);
}

/** Hash inputs: `build.hashInputs` or target root (contentHash, skips .output/node_modules/…). */
export async function resolveBuildHashInputs(target: PerfTarget): Promise<string[]> {
  const custom = target.build.hashInputs;
  if (typeof custom === 'function') return custom(target);
  if (custom?.length) return custom.map((p) => resolve(target.root, p));
  return [resolve(target.root)];
}

/** Content hash of sources + build command fingerprint (same idea as core ArtifactStore). */
export async function computeBuildHash(target: PerfTarget): Promise<string> {
  const inputs = await resolveBuildHashInputs(target);
  const content = await contentHash(inputs);
  const cmd = [target.build.command, ...(target.build.args ?? [])].join(' ');
  const env = JSON.stringify(target.build.env ?? {});
  return hashString(`perf-build|1|${target.id}|${cmd}|${env}|${content}`);
}

export function readStoredBuildHash(target: PerfTarget): string | undefined {
  const path = hashSidecar(target);
  if (!existsSync(path)) return undefined;
  try {
    return readFileSync(path, 'utf8').trim() || undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredBuildHash(target: PerfTarget, hash: string): void {
  const out = outputDir(target);
  mkdirSync(out, { recursive: true });
  writeFileSync(hashSidecar(target), `${hash}\n`, 'utf8');
}

/** True when output exists and stored hash matches current sources. */
export async function isBuildWarm(target: PerfTarget): Promise<boolean> {
  if (!existsSync(outputDir(target))) return false;
  const current = await computeBuildHash(target);
  return readStoredBuildHash(target) === current;
}

/** Reuse an existing warm build (bundle sizes only; timings zeroed). */
export function cachedBuildMetrics(target: PerfTarget): BuildMetrics {
  const bundle = target.bundle ? measureBundle(resolve(target.root), target.bundle) : undefined;
  return { buildTimeSec: 0, cached: true, ...emptyProcess, bundle };
}

async function runBuildCommand(target: PerfTarget, opts: HarnessOpts = {}): Promise<BuildMetrics> {
  const cwd = resolve(target.build.cwd ?? target.root);
  const args = target.build.args ?? [];
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    USER: process.env.USER,
    SHELL: process.env.SHELL,
    NODE_ENV: 'production',
    ...target.build.env,
  };

  const started = performance.now();
  const child = spawn(target.build.command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const filter = target.build.logFilter ?? defaultLogFilter;
  const verbose = opts.ui?.verbosity === 'verbose';

  child.stdout?.on('data', (buf: Buffer) => {
    for (const line of buf.toString().split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (filter(t) || verbose) {
        opts.ui?.emit({ type: 'log', channel: 'build', line: t.slice(0, 200) });
      }
    }
  });
  child.stderr?.on('data', (buf: Buffer) => {
    for (const line of buf.toString().split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (verbose || filter(t) || /WARN|ERROR/i.test(t)) {
        opts.ui?.emit({ type: 'log', channel: 'build', line: t.slice(0, 240) });
      }
    }
  });

  const sampler = child.pid ? new ProcessSampler(child.pid) : undefined;
  sampler?.begin();

  try {
    await new Promise<void>((resolvePromise, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolvePromise();
        else reject(new Error(`Build exited with code ${code}`));
      });
      child.on('error', reject);
    });
  } finally {
    sampler?.note();
  }

  const buildTimeSec = (performance.now() - started) / 1000;
  const processMetrics = sampler ? sampler.finalize() : emptyProcess;
  const bundle = target.bundle ? measureBundle(resolve(target.root), target.bundle) : undefined;

  return { buildTimeSec, ...processMetrics, bundle };
}

/**
 * Build target unless sources are unchanged (contentHash warm cache).
 * Pass `force: true` to always rebuild.
 */
export async function measureBuild(
  target: PerfTarget,
  opts: { force?: boolean } & HarnessOpts = {},
): Promise<BuildMetrics> {
  if (!opts.force && (await isBuildWarm(target))) {
    opts.ui?.emit({ type: 'phase', phase: 'build', detail: 'cache hit (sources unchanged)' });
    return cachedBuildMetrics(target);
  }

  opts.ui?.emit({
    type: 'phase',
    phase: 'build',
    detail: opts.force ? 'forced' : '…',
  });
  const metrics = await runBuildCommand(target, opts);
  // Recompute after build so self-mutating roots (codegen into fixture) still warm next run.
  const postHash = await computeBuildHash(target);
  writeStoredBuildHash(target, postHash);
  return metrics;
}
