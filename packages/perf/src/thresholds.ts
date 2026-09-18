import type { PerfTargetResult, PerfThresholds } from './types';

export type ThresholdFailure = { id: string; rule: string; actual: number; limit: number };

export function checkThresholds(
  results: PerfTargetResult[],
  thresholds: PerfThresholds,
): ThresholdFailure[] {
  const failures: ThresholdFailure[] = [];
  for (const r of results) {
    if (thresholds.buildTimeSec != null && r.build.buildTimeSec > thresholds.buildTimeSec) {
      failures.push({
        id: r.id,
        rule: 'buildTimeSec',
        actual: r.build.buildTimeSec,
        limit: thresholds.buildTimeSec,
      });
    }
    if (thresholds.maxMemoryMb != null && r.build.maxMemoryMb > thresholds.maxMemoryMb) {
      failures.push({
        id: r.id,
        rule: 'maxMemoryMb',
        actual: r.build.maxMemoryMb,
        limit: thresholds.maxMemoryMb,
      });
    }
    if (r.load) {
      if (
        thresholds.requestsPerSecond != null &&
        (r.load.requestsPerSecond ?? 0) < thresholds.requestsPerSecond
      ) {
        failures.push({
          id: r.id,
          rule: 'requestsPerSecond',
          actual: r.load.requestsPerSecond ?? 0,
          limit: thresholds.requestsPerSecond,
        });
      }
      if (
        thresholds.responseTimeP95 != null &&
        (r.load.responseTimeP95 ?? 0) > thresholds.responseTimeP95
      ) {
        failures.push({
          id: r.id,
          rule: 'responseTimeP95',
          actual: r.load.responseTimeP95 ?? 0,
          limit: thresholds.responseTimeP95,
        });
      }
      if (thresholds.errorRate != null && (r.load.errorRate ?? 0) > thresholds.errorRate) {
        failures.push({
          id: r.id,
          rule: 'errorRate',
          actual: r.load.errorRate ?? 0,
          limit: thresholds.errorRate,
        });
      }
    }
  }
  return failures;
}
