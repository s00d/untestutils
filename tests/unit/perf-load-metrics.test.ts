import { describe, expect, test } from 'vitest';
import { averageLoadMetrics } from '../../packages/perf/src/average';
import type { ArtilleryResult, LoadMetrics } from '../../packages/perf/src/types';
import { artilleryVuserStats } from '../../packages/perf/src/load/index';

function emptyProcess(): Pick<
  LoadMetrics,
  'maxMemoryMb' | 'minMemoryMb' | 'avgMemoryMb' | 'maxCpuPct' | 'minCpuPct' | 'avgCpuPct'
> {
  return {
    maxMemoryMb: 0,
    minMemoryMb: 0,
    avgMemoryMb: 0,
    maxCpuPct: 0,
    minCpuPct: 0,
    avgCpuPct: 0,
  };
}

function artilleryWithVusers(created: number, skipped: number, rps: number): ArtilleryResult {
  return {
    aggregate: {
      counters: {
        'vusers.created': created,
        'vusers.skipped': skipped,
        'vusers.completed': created,
        'http.requests': created * 10,
      },
      rates: { 'http.request_rate': rps },
      firstMetricAt: 0,
      lastMetricAt: 12_000,
      summaries: {
        'http.response_time': {
          min: 1,
          max: 10,
          mean: 5,
          median: 5,
          p50: 5,
          p75: 6,
          p90: 8,
          p95: 9,
          p99: 10,
          count: created,
        },
      },
      histograms: {},
    },
  };
}

describe('perf/load vusers skipped', () => {
  test('artilleryVuserStats reads created and skipped counters', () => {
    const art = artilleryWithVusers(143, 277, 100);
    expect(artilleryVuserStats(art)).toEqual({ created: 143, skipped: 277 });
  });

  test('averageLoadMetrics averages vuser counters across runs', () => {
    const a: LoadMetrics = {
      ...emptyProcess(),
      requestsPerSecond: 100,
      vusersCreated: 100,
      vusersSkipped: 200,
      artillery: artilleryWithVusers(100, 200, 100),
    };
    const b: LoadMetrics = {
      ...emptyProcess(),
      requestsPerSecond: 200,
      vusersCreated: 300,
      vusersSkipped: 50,
      artillery: artilleryWithVusers(300, 50, 200),
    };
    const mean = averageLoadMetrics([a, b]);
    expect(mean.requestsPerSecond).toBe(150);
    expect(mean.vusersCreated).toBe(200);
    expect(mean.vusersSkipped).toBe(125);
  });
});
