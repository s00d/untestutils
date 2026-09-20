import { formatBytes, formatSec } from '../format';
import type { LoadMetrics, PerfReporter, PerfTargetResult, ProcessMetrics } from '../types';
import {
  createPerfUi,
  hasUsefulProcessMetrics,
  type PerfUi,
  type PerfUiEvent,
  type PerfVerbosity,
} from '../ui';

export type ConsoleReporterOpts = {
  verbosity?: PerfVerbosity;
  /** Shared UI instance (suite injects the same into harness). */
  ui?: PerfUi;
};

function processSuffix(m: ProcessMetrics, cached: boolean | undefined, verbosity: PerfVerbosity): string {
  if (cached) return '';
  if (!hasUsefulProcessMetrics(m)) {
    return verbosity === 'verbose' ? ' · RSS n/a' : '';
  }
  return ` · peak RSS ${Math.round(m.maxMemoryMb)} MB · CPU ${Math.round(m.avgCpuPct)}%`;
}

function formatLoadLines(load: LoadMetrics): string[] {
  const lines: string[] = [];
  const ac = load.autocannon;
  const art = load.artillery;
  if (ac && art) {
    const acErr = (ac.errors / Math.max(1, ac.requests.total)) * 100;
    lines.push(
      `  load    AC  ${ac.requests.average.toFixed(0)} RPS  p95 ${ac.latency.p97_5.toFixed(1)}ms  err ${acErr.toFixed(2)}%`,
    );
    lines.push(
      `          Art ${(load.requestsPerSecond ?? 0).toFixed(0)} RPS  p95 ${(load.responseTimeP95 ?? 0).toFixed(1)}ms  err ${(load.errorRate ?? 0).toFixed(2)}%`,
    );
  } else {
    lines.push(
      `  load    ${(load.requestsPerSecond ?? 0).toFixed(0)} RPS  p95 ${(load.responseTimeP95 ?? 0).toFixed(1)}ms  err ${(load.errorRate ?? 0).toFixed(2)}%`,
    );
  }
  return lines;
}

function printTargetResult(result: PerfTargetResult, verbosity: PerfVerbosity): void {
  const b = result.build;
  console.log('  ──');
  const cachedTag = b.cached ? '  cached' : '';
  console.log(`  build   ${formatSec(b.buildTimeSec)}${cachedTag}${processSuffix(b, b.cached, verbosity)}`);
  if (b.bundle) {
    console.log(
      `  bundle  ${formatBytes(b.bundle.total)} (code ${formatBytes(b.bundle.code)}, asset ${formatBytes(b.bundle.asset)})`,
    );
  }
  if (result.load) {
    for (const line of formatLoadLines(result.load)) console.log(line);
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function printSummary(results: PerfTargetResult[], runs: number): void {
  const dual = results.some((r) => r.load?.autocannon && r.load?.artillery);
  console.log(`\nsummary (mean of ${runs})`);
  if (dual) {
    console.log(`  ${pad('target', 18)} ${pad('build', 10)} ${pad('AC', 8)} ${pad('Art', 8)} ${pad('p95', 10)} err`);
    for (const r of results) {
      const ac = r.load?.autocannon?.requests.average;
      const art = r.load?.requestsPerSecond;
      const p95 = r.load?.responseTimeP95;
      const err = r.load?.errorRate;
      console.log(
        `  ${pad(r.label, 18)} ${pad(formatSec(r.build.buildTimeSec), 10)} ${pad(ac !== undefined ? ac.toFixed(0) : '—', 8)} ${pad(art !== undefined ? art.toFixed(0) : '—', 8)} ${pad(p95 !== undefined ? `${p95.toFixed(0)}ms` : '—', 10)} ${err !== undefined ? `${err.toFixed(2)}%` : '—'}`,
      );
    }
  } else {
    console.log(`  ${pad('target', 18)} ${pad('build', 10)} ${pad('RPS', 8)} ${pad('p95', 10)} err`);
    for (const r of results) {
      const rps = r.load?.requestsPerSecond;
      const p95 = r.load?.responseTimeP95;
      const err = r.load?.errorRate;
      console.log(
        `  ${pad(r.label, 18)} ${pad(formatSec(r.build.buildTimeSec), 10)} ${pad(rps !== undefined ? rps.toFixed(0) : '—', 8)} ${pad(p95 !== undefined ? `${p95.toFixed(0)}ms` : '—', 10)} ${err !== undefined ? `${err.toFixed(2)}%` : '—'}`,
      );
    }
  }
}

function bindConsoleRenderer(ui: PerfUi): () => void {
  return ui.on((e: PerfUiEvent) => {
    const v = ui.verbosity;
    switch (e.type) {
      case 'targetStart': {
        if (v === 'quiet') break;
        console.log(`\n${e.label}  run ${e.run}/${e.runs}`);
        break;
      }
      case 'phase': {
        if (v === 'quiet') break;
        if (e.phase === 'build') {
          console.log(`  build   ${e.detail ?? '…'}`);
        } else if (e.phase === 'start') {
          console.log(`  start   ${e.detail ?? ''}`);
        } else if (e.phase === 'autocannon') {
          console.log(`  load    autocannon  ${e.detail ?? ''}`);
        } else if (e.phase === 'artillery') {
          const isPhaseName = e.detail?.startsWith('phase ');
          if (isPhaseName && v !== 'verbose') break;
          if (isPhaseName) console.log(`  load    artillery  ${e.detail}`);
          else console.log(`  load    artillery  ${e.detail ?? ''}`);
        }
        break;
      }
      case 'log': {
        if (v === 'quiet') break;
        if (e.channel === 'warn') {
          console.warn(`  warn    ${e.line}`);
          break;
        }
        if (v === 'verbose' || e.channel === 'build' || e.channel === 'server') {
          if (v === 'default' && e.channel === 'server') break;
          const prefix = e.channel === 'build' ? '  [build]' : '  [server]';
          if (v === 'verbose' || e.channel === 'build') {
            console.log(`${prefix} ${e.line}`);
          }
        }
        break;
      }
      case 'targetResult': {
        if (v === 'quiet') {
          // still show compact one-liner
          const r = e.result;
          const rps = r.load?.requestsPerSecond;
          console.log(
            `${r.label}  build ${formatSec(r.build.buildTimeSec)}${r.build.cached ? ' cached' : ''}${rps !== undefined ? ` · ${rps.toFixed(0)} RPS` : ''}`,
          );
        } else {
          printTargetResult(e.result, v);
        }
        break;
      }
      case 'suiteEnd': {
        printSummary(e.results, e.runs);
        break;
      }
      default:
        break;
    }
  });
}

/**
 * Console progress + result reporter. Owns a {@link PerfUi} that the suite
 * injects into build/start/load so all stdout goes through one renderer.
 */
export function consoleReporter(opts: ConsoleReporterOpts = {}): PerfReporter {
  const verbosity = opts.verbosity ?? 'default';
  const ui = opts.ui ?? createPerfUi(verbosity);
  ui.setVerbosity(verbosity);
  bindConsoleRenderer(ui);

  return {
    name: 'console',
    ui,
    onTarget(result) {
      ui.emit({ type: 'targetResult', result });
    },
    onEnd({ results, runs }) {
      ui.emit({ type: 'suiteEnd', results, runs });
    },
  };
}

/** Render helpers exported for unit snapshots. */
export const _consoleFormat: {
  formatLoadLines: typeof formatLoadLines;
  printSummary: typeof printSummary;
  processSuffix: typeof processSuffix;
  hasUsefulProcessMetrics: typeof hasUsefulProcessMetrics;
} = {
  formatLoadLines,
  printSummary,
  processSuffix,
  hasUsefulProcessMetrics,
};
