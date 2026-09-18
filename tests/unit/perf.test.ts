import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'pathe';
import { afterEach, describe, expect, test } from 'vitest';
import { averageBuildMetrics, averageTargetResults } from '../../packages/perf/src/average';
import { measureBundle } from '../../packages/perf/src/bundle';
import { parseArtilleryJson, parseAutocannonJson } from '../../packages/perf/src/load/parse';
import { checkThresholds } from '../../packages/perf/src/thresholds';
import type { BuildMetrics, PerfTargetResult } from '../../packages/perf/src/types';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('perf/average', () => {
  test('averages build metrics', () => {
    const a: BuildMetrics = {
      buildTimeSec: 10,
      maxMemoryMb: 100,
      minMemoryMb: 50,
      avgMemoryMb: 75,
      maxCpuPct: 80,
      minCpuPct: 20,
      avgCpuPct: 40,
    };
    const b: BuildMetrics = {
      buildTimeSec: 20,
      maxMemoryMb: 200,
      minMemoryMb: 100,
      avgMemoryMb: 150,
      maxCpuPct: 90,
      minCpuPct: 30,
      avgCpuPct: 60,
    };
    const mean = averageBuildMetrics([a, b]);
    expect(mean.buildTimeSec).toBe(15);
    expect(mean.maxMemoryMb).toBe(150);
  });

  test('averages target results', () => {
    const make = (t: number): PerfTargetResult => ({
      id: 'x',
      label: 'X',
      build: {
        buildTimeSec: t,
        maxMemoryMb: t,
        minMemoryMb: t,
        avgMemoryMb: t,
        maxCpuPct: t,
        minCpuPct: t,
        avgCpuPct: t,
      },
    });
    expect(averageTargetResults([make(2), make(4)]).build.buildTimeSec).toBe(3);
  });
});

describe('perf/bundle', () => {
  let dir: string;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test('classifies files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ut-perf-'));
    mkdirSync(join(dir, 'out'), { recursive: true });
    writeFileSync(join(dir, 'out', 'app.js'), 'x'.repeat(100));
    writeFileSync(join(dir, 'out', 'en.json'), 'y'.repeat(50));
    const size = measureBundle(dir, {
      dirs: ['out'],
      classify: (p) => (p.endsWith('.json') ? 'asset' : 'code'),
    });
    expect(size.code).toBe(100);
    expect(size.asset).toBe(50);
    expect(size.total).toBe(150);
  });
});

describe('perf/parse', () => {
  test('parses autocannon json', () => {
    const raw = JSON.stringify({
      requests: { average: 100, mean: 100, total: 1000 },
      latency: {
        average: 10,
        mean: 10,
        min: 1,
        max: 50,
        p50: 8,
        p97_5: 20,
        p99: 30,
      },
      throughput: { average: 50_000 },
      errors: 0,
    });
    expect(parseAutocannonJson(raw).requests.average).toBe(100);
  });

  test('parses artillery json', () => {
    const raw = JSON.stringify({
      aggregate: {
        counters: { 'http.requests': 10 },
        rates: { 'http.request_rate': 5 },
        firstMetricAt: 0,
        lastMetricAt: 1000,
        summaries: {
          'http.response_time': {
            min: 1,
            max: 10,
            count: 10,
            mean: 5,
            p50: 4,
            median: 4,
            p75: 6,
            p90: 8,
            p95: 9,
            p99: 10,
            p999: 10,
          },
        },
        histograms: {},
      },
    });
    expect(parseArtilleryJson(raw).aggregate.rates['http.request_rate']).toBe(5);
  });
});

describe('perf/thresholds', () => {
  test('detects failures', () => {
    const results: PerfTargetResult[] = [
      {
        id: 'a',
        label: 'A',
        build: {
          buildTimeSec: 50,
          maxMemoryMb: 10,
          minMemoryMb: 1,
          avgMemoryMb: 5,
          maxCpuPct: 1,
          minCpuPct: 1,
          avgCpuPct: 1,
        },
        load: {
          maxMemoryMb: 1,
          minMemoryMb: 1,
          avgMemoryMb: 1,
          maxCpuPct: 1,
          minCpuPct: 1,
          avgCpuPct: 1,
          requestsPerSecond: 10,
          responseTimeP95: 900,
          errorRate: 0,
        },
      },
    ];
    const fails = checkThresholds(results, {
      buildTimeSec: 30,
      requestsPerSecond: 100,
      responseTimeP95: 200,
    });
    expect(fails.map((f) => f.rule).sort()).toEqual([
      'buildTimeSec',
      'requestsPerSecond',
      'responseTimeP95',
    ]);
  });
});
