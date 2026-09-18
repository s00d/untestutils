import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'pathe';
import type { AutocannonResult } from '../types';

type AutocannonFn = (opts: {
  url: string;
  connections?: number;
  duration?: number;
  renderProgressBar?: boolean;
  renderResultsTable?: boolean;
  renderLatencyTable?: boolean;
}) => Promise<{
  requests: { average: number; mean?: number; total?: number };
  latency: {
    average: number;
    mean?: number;
    min: number;
    max: number;
    p50?: number;
    p97_5?: number;
    p99?: number;
  };
  throughput: { average: number };
  errors?: number;
  totalCompletedRequests?: number;
  totalRequests?: number;
}>;

function normalize(raw: Awaited<ReturnType<AutocannonFn>>): AutocannonResult {
  return {
    requests: {
      average: raw.requests.average,
      mean: raw.requests.mean ?? raw.requests.average,
      total: raw.requests.total ?? raw.totalCompletedRequests ?? raw.totalRequests ?? 0,
    },
    latency: {
      average: raw.latency.average,
      mean: raw.latency.mean ?? raw.latency.average,
      min: raw.latency.min,
      max: raw.latency.max,
      p50: raw.latency.p50 ?? raw.latency.average,
      p97_5: raw.latency.p97_5 ?? raw.latency.p99 ?? raw.latency.max,
      p99: raw.latency.p99 ?? raw.latency.max,
    },
    throughput: { average: raw.throughput.average },
    errors: raw.errors ?? 0,
  };
}

async function viaApi(opts: {
  url: string;
  connections: number;
  duration: number;
}): Promise<AutocannonResult | null> {
  try {
    // @ts-expect-error optional peer
    const mod = (await import('autocannon')) as { default?: AutocannonFn } & AutocannonFn;
    const run = (mod.default ?? mod) as AutocannonFn;
    const raw = await run({
      url: opts.url,
      connections: opts.connections,
      duration: opts.duration,
      renderProgressBar: false,
      renderResultsTable: false,
      renderLatencyTable: false,
    });
    return normalize(raw);
  } catch {
    return null;
  }
}

function viaNpx(opts: {
  url: string;
  connections: number;
  duration: number;
}): Promise<AutocannonResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      [
        '--yes',
        'autocannon',
        '-c',
        String(opts.connections),
        '-d',
        String(opts.duration),
        '-j',
        opts.url,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`autocannon exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      try {
        resolve(normalize(JSON.parse(stdout) as Awaited<ReturnType<AutocannonFn>>));
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Prefer programmatic peer; fall back to `npx autocannon`. */
export async function runAutocannon(opts: {
  url: string;
  connections?: number;
  durationSec?: number;
  artifactsDir: string;
  name: string;
}): Promise<AutocannonResult> {
  const connections = opts.connections ?? 10;
  const duration = opts.durationSec ?? 10;
  mkdirSync(opts.artifactsDir, { recursive: true });

  const result =
    (await viaApi({ url: opts.url, connections, duration })) ??
    (await viaNpx({ url: opts.url, connections, duration }));

  writeFileSync(
    join(opts.artifactsDir, `autocannon-${opts.name}.json`),
    JSON.stringify(result, null, 2),
  );
  return result;
}
