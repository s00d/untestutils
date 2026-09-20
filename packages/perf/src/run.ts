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

const DEFAULT_COOL_DOWN_MS = 500;
const DEFAULT_POST_BUILD_DELAY_MS = 200;

function selectTargets(suite: PerfSuite, only?: string | string[]): PerfTarget[] {
  const filter = only ?? suite.only;
  if (!filter || filter === 'all') return suite.targets;
  const ids = new Set(Array.isArray(filter) ? filter : [filter]);
  return suite.targets.filter((t) => ids.has(t.id) || ids.has(t.label ?? ''));
}

async function runTargetOnce(
  target: PerfTarget,
  opts: {
    skipLoad: boolean;
    forceBuild: boolean;
    postBuildDelayMs: number;
    artifactsDir: string;
  },
): Promise<PerfTargetResult> {
  console.log(`\n══════════ ${target.label ?? target.id} ══════════`);
  const build = await measureBuild(target, { force: opts.forceBuild });

  let load;
  if (!opts.skipLoad && target.load) {
    await delay(opts.postBuildDelayMs);
    console.log('  → start + load');
    const started = await startTarget(target);
    try {
      load = await runLoadPhase({ target, started, artifactsDir: opts.artifactsDir });
    } finally {
      await started.stop();
    }
  }

  return {
    id: target.id,
    label: target.label ?? target.id,
    build,
    load,
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

  const reporters = [
    ...(suite.reporters ?? [consoleReporter()]),
    ...(options.json ? [jsonReporter({ dir: artifactsDir })] : []),
  ];

  await suite.beforeAll?.(suite);
  for (const r of reporters) await r.onStart?.(suite);

  const averaged: PerfTargetResult[] = [];

  for (let ti = 0; ti < targets.length; ti++) {
    const target = targets[ti]!;
    await suite.beforeTarget?.(target);

    const samples: PerfTargetResult[] = [];
    for (let run = 1; run <= runs; run++) {
      console.log(`\n▸ ${target.label ?? target.id} · run ${run}/${runs}`);
      samples.push(
        await runTargetOnce(target, {
          skipLoad,
          forceBuild,
          postBuildDelayMs,
          artifactsDir,
        }),
      );
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

  if (suite.thresholds) {
    const failures = checkThresholds(averaged, suite.thresholds);
    if (failures.length) {
      for (const f of failures) {
        console.error(
          `[untestutils/perf] threshold ${f.rule} failed for ${f.id}: ${f.actual} (limit ${f.limit})`,
        );
      }
      process.exitCode = 1;
    }
  }

  return averaged;
}

export { consoleReporter, jsonReporter };
