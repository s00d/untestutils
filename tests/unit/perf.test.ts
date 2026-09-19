import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'pathe';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { averageBuildMetrics, averageTargetResults } from '../../packages/perf/src/average';
import { measureBundle } from '../../packages/perf/src/bundle';
import { parseArtilleryJson, parseAutocannonJson } from '../../packages/perf/src/load/parse';
import { checkThresholds } from '../../packages/perf/src/thresholds';
import type { BuildMetrics, PerfTargetResult } from '../../packages/perf/src/types';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  createSampleAccumulator,
  finalizeSamples,
  pushSample,
} from '../../packages/perf/src/process-sample';
import type { StartedTarget } from '../../packages/perf/src/start';

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

describe('perf/load process metrics timing', () => {
  test('finalizeSamples zeros when no samples (old early-take bug)', () => {
    const m = finalizeSamples(createSampleAccumulator());
    expect(m.maxCpuPct).toBe(0);
    expect(m.avgMemoryMb).toBe(0);
  });

  test('runLoadPhase takes process metrics after load tools', async () => {
    const order: string[] = [];
    vi.resetModules();
    vi.doMock('../../packages/perf/src/load/autocannon', () => ({
      runAutocannon: async () => {
        order.push('autocannon');
        return {
          requests: { average: 1, mean: 1, total: 1 },
          latency: { average: 1, mean: 1, min: 1, max: 1, p50: 1, p97_5: 1, p99: 1 },
          throughput: { average: 1 },
          errors: 0,
        };
      },
    }));
    vi.doMock('../../packages/perf/src/load/artillery', () => ({
      runArtillery: async () => undefined,
    }));

    const { runLoadPhase } = await import('../../packages/perf/src/load/index');
    const started: StartedTarget = {
      url: 'http://127.0.0.1:9',
      port: 9,
      takeProcessMetrics: () => {
        order.push('take');
        const acc = createSampleAccumulator();
        pushSample(acc, { cpu: 42, memoryMb: 128 });
        return finalizeSamples(acc);
      },
      stop: async () => {},
    };

    const metrics = await runLoadPhase({
      target: {
        id: 't',
        root: '/tmp',
        build: { command: 'true' },
        start: { command: 'true', port: 9 },
        load: { autocannon: { connections: 1, durationSec: 1 } },
      },
      started,
      artifactsDir: await mkdtemp(join(tmpdir(), 'ut-perf-load-')),
    });

    expect(order).toEqual(['autocannon', 'take']);
    expect(metrics.maxCpuPct).toBe(42);
    expect(metrics.maxMemoryMb).toBe(128);
    vi.doUnmock('../../packages/perf/src/load/autocannon');
    vi.doUnmock('../../packages/perf/src/load/artillery');
    vi.resetModules();
  });
});
