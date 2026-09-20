import { mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'pathe';
import { averageTargetResults } from './average';
import { measureBuild } from './build';
import { runLoadPhase } from './load';
import { consoleReporter } from './report/console';
import { jsonReporter } from './report/json';
import { startTarget } from './start';
import { checkThresholds } from './thresholds';
import type { PerfSuite, PerfTarget, PerfTargetResult, RunPerfOptions } from './types';
import { createPerfUi, type PerfUi } from './ui';

const DEFAULT_COOL_DOWN_MS = 500;
const DEFAULT_POST_BUILD_DELAY_MS = 200;

function selectTargets(suite: PerfSuite, only?: string | string[]): PerfTarget[] {
  const filter = only ?? suite.only;
  if (!filter || filter === 'all') return suite.targets;
  const ids = new Set(Array.isArray(filter) ? filter : [filter]);
  return suite.targets.filter((t) => ids.has(t.id) || ids.has(t.label ?? ''));
}

function resolveUi(suite: PerfSuite, options: RunPerfOptions): PerfUi {
  const verbosity = options.verbosity ?? suite.verbosity ?? 'default';
  const reporters = suite.reporters;
  const fromReporter = reporters?.find((r) => r.ui)?.ui;
  if (fromReporter) {
    fromReporter.setVerbosity(verbosity);
    return fromReporter;
  }
  return createPerfUi(verbosity);
}

async function runTargetOnce(
  target: PerfTarget,
  opts: {
    skipLoad: boolean;
    forceBuild: boolean;
    postBuildDelayMs: number;
    artifactsDir: string;
    ui: PerfUi;
    preferredPort?: number;
  },
): Promise<{ result: PerfTargetResult; boundPort?: number }> {
  const build = await measureBuild(target, { force: opts.forceBuild, ui: opts.ui });

  let load;
  let boundPort: number | undefined;
  if (!opts.skipLoad && target.load) {
    await delay(opts.postBuildDelayMs);
    const started = await startTarget(target, {
      ui: opts.ui,
      preferredPort: opts.preferredPort,
    });
    boundPort = started.port;
    try {
      load = await runLoadPhase({
        target,
        started,
        artifactsDir: opts.artifactsDir,
        ui: opts.ui,
      });
    } finally {
      await started.stop();
    }
  }

  return {
    result: {
      id: target.id,
      label: target.label ?? target.id,
      build,
      load,
    },
    boundPort,
  };
}

export async function runPerfSuite(
  suite: PerfSuite,
  options: RunPerfOptions = {},
): Promise<PerfTargetResult[]> {
  const runs = options.runs ?? suite.runs ?? 1;
  const skipLoad = options.skipLoad ?? suite.skipLoad ?? false;
  const forceBuild = options.forceBuild ?? false;
  const coolDownMs = options.coolDownMs ?? suite.coolDownMs ?? DEFAULT_COOL_DOWN_MS;
  const postBuildDelayMs =
    options.postBuildDelayMs ?? suite.postBuildDelayMs ?? DEFAULT_POST_BUILD_DELAY_MS;
  const artifactsDir = resolve(suite.artifactsDir ?? '.untestutils/perf');
  mkdirSync(artifactsDir, { recursive: true });

  const targets = selectTargets(suite, options.only);
  if (!targets.length) throw new Error('[untestutils/perf] no targets matched');

  const verbosity = options.verbosity ?? suite.verbosity ?? 'default';
  const reporters = [
    ...(suite.reporters ?? [consoleReporter({ verbosity })]),
    ...(options.json ? [jsonReporter({ dir: artifactsDir })] : []),
  ];
  const ui = resolveUi({ ...suite, reporters }, options);

  // Forward phase events to reporters with onPhase
  const unsubPhase = ui.on((e) => {
    if (e.type !== 'phase') return;
    for (const r of reporters) {
      void r.onPhase?.({ phase: e.phase, detail: e.detail });
    }
  });

  await suite.beforeAll?.(suite);
  for (const r of reporters) await r.onStart?.(suite);
  ui.emit({ type: 'suiteStart', suite, runs, skipLoad });

  const averaged: PerfTargetResult[] = [];
  /** Next preferred port after a reassignment (avoids hammering a fixed LOAD_PORT). */
  let portCursor: number | undefined;

  for (let ti = 0; ti < targets.length; ti++) {
    const target = targets[ti]!;
    await suite.beforeTarget?.(target);

    const samples: PerfTargetResult[] = [];
    for (let run = 1; run <= runs; run++) {
      ui.emit({
        type: 'targetStart',
        id: target.id,
        label: target.label ?? target.id,
        run,
        runs,
      });
      const { result, boundPort } = await runTargetOnce(target, {
        skipLoad,
        forceBuild,
        postBuildDelayMs,
        artifactsDir,
        ui,
        preferredPort: portCursor ?? target.start.port,
      });
      samples.push(result);
      if (boundPort != null) portCursor = boundPort + 1;
      if (run < runs) await delay(coolDownMs);
    }

    const mean = averageTargetResults(samples);
    averaged.push(mean);
    await suite.afterTarget?.(target, mean);
    for (const r of reporters) await r.onTarget?.(mean);

    if (ti < targets.length - 1) await delay(coolDownMs);
  }

  const ctx = { suite, results: averaged, runs, skipLoad };
  for (const r of reporters) await r.onEnd?.(ctx);

  unsubPhase();

  if (suite.thresholds) {
    const failures = checkThresholds(averaged, suite.thresholds);
    if (failures.length) {
      for (const f of failures) {
        ui.emit({
          type: 'log',
          channel: 'warn',
          line: `threshold ${f.rule} failed for ${f.id}: ${f.actual} (limit ${f.limit})`,
        });
      }
      process.exitCode = 1;
    }
  }

  return averaged;
}
