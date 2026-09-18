import { formatBytes, formatSec } from '../format';
import type { PerfReporter, PerfTargetResult } from '../types';

export function consoleReporter(): PerfReporter {
  return {
    name: 'console',
    onTarget(result: PerfTargetResult) {
      const b = result.build;
      console.log(`\n── ${result.label} (${result.id}) ──`);
      console.log(
        `  build  ${formatSec(b.buildTimeSec)} · peak RSS ${b.maxMemoryMb.toFixed(0)} MB · CPU ${b.avgCpuPct.toFixed(0)}%`,
      );
      if (b.bundle) {
        console.log(
          `  bundle ${formatBytes(b.bundle.total)} (code ${formatBytes(b.bundle.code)}, asset ${formatBytes(b.bundle.asset)})`,
        );
      }
      if (result.load) {
        const l = result.load;
        console.log(
          `  load   ${(l.requestsPerSecond ?? 0).toFixed(1)} RPS · p95 ${(l.responseTimeP95 ?? 0).toFixed(1)} ms · err ${(l.errorRate ?? 0).toFixed(2)}%`,
        );
      }
    },
    onEnd({ results, runs }) {
      console.log(`\n══════════ summary (mean of ${runs}) ══════════`);
      for (const r of results) {
        const load = r.load
          ? ` · ${r.load.requestsPerSecond?.toFixed(0) ?? '—'} RPS`
          : '';
        console.log(
          `  ${r.label.padEnd(20)} build ${formatSec(r.build.buildTimeSec)}${load}`,
        );
      }
    },
  };
}
