import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'pathe';
import type { Result as AutocannonRawResult } from 'autocannon';
import type { AutocannonResult } from '../types';

export const AUTOCANNON_PINNED_VERSION = '8.0.0';

function normalize(raw: AutocannonRawResult): AutocannonResult {
  return {
    requests: {
      average: raw.requests.average,
      mean: raw.requests.mean ?? raw.requests.average,
      total: raw.requests.total ?? raw.requests.sent ?? 0,
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

/** Programmatic peer only (`autocannon()`). No CLI / npx. */
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

  let run: (options: {
    url: string;
    connections?: number;
    duration?: number;
  }) => Promise<AutocannonRawResult>;
  try {
    const mod = await import('autocannon');
    run = mod.default;
  } catch {
    throw new Error(
      `@untestutils/perf: autocannon@${AUTOCANNON_PINNED_VERSION} is required for load.autocannon (optional peer). Install it in the project.`,
    );
  }

  const raw = await run({
    url: opts.url,
    connections,
    duration,
  });
  const result = normalize(raw);

  writeFileSync(
    join(opts.artifactsDir, `autocannon-${opts.name}.json`),
    JSON.stringify(result, null, 2),
  );
  return result;
}
