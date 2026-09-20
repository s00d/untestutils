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
      durationSec: 5,
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
    expect(parseAutocannonJson(raw).durationSec).toBe(5);
  });

  test('buildArtilleryScript builds phases without YAML', async () => {
    const { buildArtilleryScript, ARTILLERY_LOAD_DEFAULTS } = await import(
      '../../packages/perf/src/load/script'
    );
    const script = buildArtilleryScript({
      paths: ['/', '/ru'],
      warmUpSec: 1,
      warmUpArrivalRate: 6,
      durationSec: 3,
      arrivalRate: 8,
      maxVusers: 8,
    });
    expect(script.config?.phases).toEqual([
      { name: 'warm-up', duration: 1, arrivalRate: 6, maxVusers: 6 },
      { name: 'main', duration: 3, arrivalRate: 8, maxVusers: 8 },
    ]);
    expect(script.scenarios?.[0]).toMatchObject({
      'parallel-requests': 2,
    });
    expect(buildArtilleryScript().config?.phases?.at(-1)).toMatchObject({
      duration: ARTILLERY_LOAD_DEFAULTS.durationSec,
    });
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

  test('packArtilleryReport summarizes sketches like CLI --output', async () => {
    const { packArtilleryReport } = await import('../../packages/perf/src/load/artillery');
    const sketch = {
      min: 1,
      max: 10,
      count: 2,
      sum: 11,
      getValueAtQuantile: (q: number) => (q < 0.9 ? 4 : 9),
    };
    const report = packArtilleryReport(
      {
        counters: { 'http.requests': 2 },
        rates: { 'http.request_rate': 1 },
        firstMetricAt: 100,
        lastMetricAt: 1100,
        histograms: { 'http.response_time': sketch },
      },
      [
        {
          period: 1000,
          counters: { 'http.requests': 2 },
          rates: {},
          histograms: { 'http.response_time': sketch },
        },
      ],
      (h) => ({
        min: h.min,
        max: h.max,
        count: h.count,
        mean: h.sum / h.count,
        p50: h.getValueAtQuantile(0.5),
        median: h.getValueAtQuantile(0.5),
        p75: h.getValueAtQuantile(0.75),
        p90: h.getValueAtQuantile(0.9),
        p95: h.getValueAtQuantile(0.95),
        p99: h.getValueAtQuantile(0.99),
        p999: h.getValueAtQuantile(0.999),
      }),
    );
    expect(report.aggregate.summaries['http.response_time']?.mean).toBe(5.5);
    expect(report.aggregate.histograms['http.response_time']?.p90).toBe(9);
    expect(report.intermediate?.[0]?.summaries?.['http.response_time']?.min).toBe(1);
  });

  test('runArtillery in-process stops cleanly', async () => {
    const { runArtillery } = await import('../../packages/perf/src/load/artillery');
    const dir = await mkdtemp(join(tmpdir(), 'ut-artillery-'));
    try {
      const result = await runArtillery({
        name: 'smoke',
        artifactsDir: dir,
        script: {
          config: {
            target: 'http://127.0.0.1:9',
            phases: [{ duration: 1, arrivalCount: 1 }],
          },
          scenarios: [{ flow: [{ get: { url: '/' } }] }],
        },
      });
      expect(result.aggregate.counters['http.requests']).toBeGreaterThanOrEqual(1);
      expect(result.aggregate.firstMetricAt).toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});

describe('perf/build cache', () => {
  test('isBuildWarm requires matching content hash sidecar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-skip-'));
    try {
      const {
        isBuildWarm,
        computeBuildHash,
        writeStoredBuildHash,
        cachedBuildMetrics,
      } = await import('../../packages/perf/src/build');
      writeFileSync(join(dir, 'app.ts'), 'export const x = 1\n');
      const target = {
        id: 't',
        root: dir,
        build: { command: 'true' },
        start: { command: 'true', port: 1 },
      };
      expect(await isBuildWarm(target)).toBe(false);
      mkdirSync(join(dir, '.output'), { recursive: true });
      expect(await isBuildWarm(target)).toBe(false);
      const hash = await computeBuildHash(target);
      writeStoredBuildHash(target, hash);
      expect(await isBuildWarm(target)).toBe(true);
      writeFileSync(join(dir, 'app.ts'), 'export const x = 2\n');
      expect(await isBuildWarm(target)).toBe(false);
      const cached = cachedBuildMetrics(target);
      expect(cached.cached).toBe(true);
      expect(cached.buildTimeSec).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
  test('finalizeSamples zeros when no samples', () => {
    const m = finalizeSamples(createSampleAccumulator());
    expect(m.maxCpuPct).toBe(0);
    expect(m.avgMemoryMb).toBe(0);
  });

  test('parseCpuTime handles mm:ss and hh:mm:ss', async () => {
    const { parseCpuTime } = await import('../../packages/perf/src/process-sample');
    expect(parseCpuTime('01:30')).toBe(90);
    expect(parseCpuTime('1:02:03')).toBe(3723);
    expect(parseCpuTime('1-00:00:01')).toBe(86401);
  });

  test('runLoadPhase notes checkpoints around load tools', async () => {
    const order: string[] = [];
    vi.resetModules();
    vi.doMock('../../packages/perf/src/load/autocannon', () => ({
      runAutocannon: async () => {
        order.push('autocannon');
        return {
          durationSec: 1,
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
      noteProcess: () => {
        order.push('note');
      },
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

    expect(order).toEqual(['note', 'autocannon', 'note', 'take']);
    expect(metrics.maxCpuPct).toBe(42);
    expect(metrics.maxMemoryMb).toBe(128);
    expect(metrics.durationSec).toBe(1);
    expect(metrics.requestsPerSecond).toBe(1);
    vi.doUnmock('../../packages/perf/src/load/autocannon');
    vi.doUnmock('../../packages/perf/src/load/artillery');
    vi.resetModules();
  });
});
