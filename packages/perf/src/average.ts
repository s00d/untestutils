import type {
  AutocannonResult,
  BuildMetrics,
  BundleSize,
  LoadMetrics,
  PerfTargetResult,
} from './types';

function avg(values: Array<number | undefined>): number | undefined {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function averageBundle(sizes: Array<BundleSize | undefined>): BundleSize | undefined {
  const present = sizes.filter((s): s is BundleSize => Boolean(s));
  if (!present.length) return undefined;
  const byDir: Record<string, number> = {};
  for (const s of present) {
    for (const [k, v] of Object.entries(s.byDir)) {
      byDir[k] = (byDir[k] ?? 0) + v;
    }
  }
  for (const k of Object.keys(byDir)) byDir[k]! /= present.length;
  return {
    total: avg(present.map((s) => s.total)) ?? 0,
    code: avg(present.map((s) => s.code)) ?? 0,
    asset: avg(present.map((s) => s.asset)) ?? 0,
    other: avg(present.map((s) => s.other)) ?? 0,
    byDir,
  };
}

function averageAutocannon(
  items: Array<AutocannonResult | undefined>,
): AutocannonResult | undefined {
  const present = items.filter((a): a is AutocannonResult => Boolean(a));
  if (!present.length) return undefined;
  return {
    requests: {
      average: avg(present.map((a) => a.requests.average)) ?? 0,
      mean: avg(present.map((a) => a.requests.mean)) ?? 0,
      total: avg(present.map((a) => a.requests.total)) ?? 0,
    },
    latency: {
      average: avg(present.map((a) => a.latency.average)) ?? 0,
      mean: avg(present.map((a) => a.latency.mean)) ?? 0,
      min: avg(present.map((a) => a.latency.min)) ?? 0,
      max: avg(present.map((a) => a.latency.max)) ?? 0,
      p50: avg(present.map((a) => a.latency.p50)) ?? 0,
      p97_5: avg(present.map((a) => a.latency.p97_5)) ?? 0,
      p99: avg(present.map((a) => a.latency.p99)) ?? 0,
    },
    throughput: { average: avg(present.map((a) => a.throughput.average)) ?? 0 },
    errors: avg(present.map((a) => a.errors)) ?? 0,
  };
}

export function averageBuildMetrics(results: BuildMetrics[]): BuildMetrics {
  if (!results.length) throw new Error('cannot average empty build metrics');
  return {
    buildTimeSec: avg(results.map((r) => r.buildTimeSec)) ?? 0,
    maxMemoryMb: avg(results.map((r) => r.maxMemoryMb)) ?? 0,
    minMemoryMb: avg(results.map((r) => r.minMemoryMb)) ?? 0,
    avgMemoryMb: avg(results.map((r) => r.avgMemoryMb)) ?? 0,
    maxCpuPct: avg(results.map((r) => r.maxCpuPct)) ?? 0,
    minCpuPct: avg(results.map((r) => r.minCpuPct)) ?? 0,
    avgCpuPct: avg(results.map((r) => r.avgCpuPct)) ?? 0,
    bundle: averageBundle(results.map((r) => r.bundle)),
  };
}

export function averageLoadMetrics(results: LoadMetrics[]): LoadMetrics {
  if (!results.length) throw new Error('cannot average empty load metrics');
  const last = results[results.length - 1]!;
  return {
    maxMemoryMb: avg(results.map((r) => r.maxMemoryMb)) ?? 0,
    minMemoryMb: avg(results.map((r) => r.minMemoryMb)) ?? 0,
    avgMemoryMb: avg(results.map((r) => r.avgMemoryMb)) ?? 0,
    maxCpuPct: avg(results.map((r) => r.maxCpuPct)) ?? 0,
    minCpuPct: avg(results.map((r) => r.minCpuPct)) ?? 0,
    avgCpuPct: avg(results.map((r) => r.avgCpuPct)) ?? 0,
    durationSec: avg(results.map((r) => r.durationSec)),
    responseTimeAvg: avg(results.map((r) => r.responseTimeAvg)),
    responseTimeMin: avg(results.map((r) => r.responseTimeMin)),
    responseTimeMax: avg(results.map((r) => r.responseTimeMax)),
    responseTimeP50: avg(results.map((r) => r.responseTimeP50)),
    responseTimeP95: avg(results.map((r) => r.responseTimeP95)),
    responseTimeP99: avg(results.map((r) => r.responseTimeP99)),
    requestsPerSecond: avg(results.map((r) => r.requestsPerSecond)),
    errorRate: avg(results.map((r) => r.errorRate)),
    autocannon: averageAutocannon(results.map((r) => r.autocannon)),
    artillery: last.artillery,
  };
}

export function averageTargetResults(results: PerfTargetResult[]): PerfTargetResult {
  if (!results.length) throw new Error('cannot average empty target results');
  const first = results[0]!;
  const loads = results.map((r) => r.load).filter((l): l is LoadMetrics => Boolean(l));
  return {
    id: first.id,
    label: first.label,
    build: averageBuildMetrics(results.map((r) => r.build)),
    load: loads.length === results.length ? averageLoadMetrics(loads) : undefined,
  };
}
