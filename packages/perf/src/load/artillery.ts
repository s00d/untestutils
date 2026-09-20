import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'pathe';
import { pathToFileURL } from 'node:url';
import type { ArtilleryResult, ArtilleryScript, ArtillerySummary } from '../types';
import type { HarnessOpts } from '../ui';

export type { ArtilleryScript };

/** Pinned private runner surface — bump only with intentional adapter rewrite. */
export const ARTILLERY_PINNED_VERSION = '2.0.34';

export type RunArtilleryOpts = {
  artifactsDir: string;
  name: string;
  cwd?: string;
  /** Overrides `config.target` (needed when the suite picks a free port). */
  targetUrl?: string;
} & HarnessOpts &
  (
    | { configPath: string; script?: undefined }
    | { script: ArtilleryScript; configPath?: undefined }
  );

type HistogramSketch = {
  min: number;
  max: number;
  count: number;
  sum: number;
  getValueAtQuantile: (q: number) => number;
};

type PeriodMetrics = {
  period?: string | number;
  counters?: Record<string, number>;
  rates?: Record<string, number | null | undefined>;
  histograms?: Record<string, HistogramSketch>;
  summaries?: Record<string, ArtillerySummary>;
  firstMetricAt?: number;
  lastMetricAt?: number;
};

type ArtilleryRunnerEe = {
  run: (contextVars?: Record<string, unknown>) => void;
  stop: () => Promise<void>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type SummarizeHistogram = (h: HistogramSketch) => ArtillerySummary;

type ArtilleryCore = {
  runner: (script: ArtilleryScript, payload?: unknown) => Promise<ArtilleryRunnerEe>;
  summarizeHistogram: SummarizeHistogram;
  updateGlobalObject: (opts?: { version?: string }) => Promise<void>;
  readScript: (path: string) => Promise<string>;
  parseScript: (data: string) => Promise<ArtilleryScript>;
  checkConfig: (
    script: ArtilleryScript,
    scriptPath: string,
    flags: { target?: string },
  ) => Promise<ArtilleryScript>;
};

function requireArtilleryPkg(): { root: string; version: string } {
  try {
    const req = createRequire(import.meta.url);
    const pkgPath = req.resolve('artillery/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    return { root: dirname(pkgPath), version: pkg.version };
  } catch {
    throw new Error(
      `@untestutils/perf: artillery@${ARTILLERY_PINNED_VERSION} is required for load.artillery (optional peer). Install it in the project.`,
    );
  }
}

function assertPinnedVersion(version: string): void {
  if (version !== ARTILLERY_PINNED_VERSION) {
    throw new Error(
      `@untestutils/perf: artillery@${ARTILLERY_PINNED_VERSION} required (private runner lock); found ${version}`,
    );
  }
}

async function importArtilleryCore(root: string): Promise<ArtilleryCore> {
  const core = (rel: string) => pathToFileURL(join(root, rel)).href;
  const [{ runner }, { summarizeHistogram }, { updateGlobalObject }, util] = await Promise.all([
    import(core('dist/lib/core/runner.js')) as Promise<{
      runner: ArtilleryCore['runner'];
    }>,
    import(core('dist/lib/core/ssms.js')) as Promise<{
      summarizeHistogram: SummarizeHistogram;
    }>,
    import(core('dist/lib/core/update-global-object.js')) as Promise<{
      updateGlobalObject: ArtilleryCore['updateGlobalObject'];
    }>,
    // Same package as `artillery/util` export; deep path avoids missing .d.ts on the subpath.
    import(core('dist/lib/util.js')) as Promise<{
      readScript: ArtilleryCore['readScript'];
      parseScript: ArtilleryCore['parseScript'];
      checkConfig: ArtilleryCore['checkConfig'];
    }>,
  ]);
  return {
    runner,
    summarizeHistogram,
    updateGlobalObject,
    readScript: util.readScript,
    parseScript: util.parseScript,
    checkConfig: util.checkConfig,
  };
}

function applySummaries(
  period: PeriodMetrics,
  summarizeHistogram: SummarizeHistogram,
): {
  counters: Record<string, number>;
  rates: Record<string, number | null | undefined>;
  summaries: Record<string, ArtillerySummary>;
  histograms: Record<string, ArtillerySummary>;
  period?: string;
  firstMetricAt?: number;
  lastMetricAt?: number;
} {
  const summaries: Record<string, ArtillerySummary> = { ...(period.summaries ?? {}) };
  for (const [name, sketch] of Object.entries(period.histograms ?? {})) {
    if (sketch && typeof sketch.getValueAtQuantile === 'function') {
      summaries[name] = summarizeHistogram(sketch);
    }
  }
  return {
    counters: period.counters ?? {},
    rates: period.rates ?? {},
    summaries,
    // CLI --output mirrors summaries into histograms for JSON consumers.
    histograms: summaries,
    period:
      period.period !== undefined && period.period !== null ? String(period.period) : undefined,
    firstMetricAt: period.firstMetricAt,
    lastMetricAt: period.lastMetricAt,
  };
}

/** Build ArtilleryResult from in-process runner `done` + `stats` payloads. */
export function packArtilleryReport(
  aggregateRaw: PeriodMetrics,
  intermediatesRaw: PeriodMetrics[],
  summarizeHistogram: SummarizeHistogram,
): ArtilleryResult {
  const aggregate = applySummaries(aggregateRaw, summarizeHistogram);
  return {
    aggregate: {
      counters: aggregate.counters,
      rates: aggregate.rates as Record<string, number | undefined>,
      firstMetricAt: aggregate.firstMetricAt ?? 0,
      lastMetricAt: aggregate.lastMetricAt ?? 0,
      summaries: aggregate.summaries,
      histograms: aggregate.histograms,
    },
    intermediate: intermediatesRaw.map((ix) => {
      const packed = applySummaries(ix, summarizeHistogram);
      return {
        counters: packed.counters,
        rates: packed.rates,
        period: packed.period,
        summaries: packed.summaries,
        histograms: packed.histograms,
      };
    }),
  };
}

/**
 * Run an Artillery script in-process via the pinned private core runner
 * (`artillery@2.0.34` `dist/lib/core/runner.js`). No CLI / spawn.
 */
export async function runArtillery(opts: RunArtilleryOpts): Promise<ArtilleryResult> {
  const { root, version } = requireArtilleryPkg();
  assertPinnedVersion(version);

  mkdirSync(opts.artifactsDir, { recursive: true });
  const outputFile = join(opts.artifactsDir, `artillery-${opts.name}.json`);

  const { runner, summarizeHistogram, updateGlobalObject, readScript, parseScript, checkConfig } =
    await importArtilleryCore(root);

  const target = opts.targetUrl?.replace(/\/$/, '');
  let script: ArtilleryScript;
  if (opts.script) {
    script = {
      ...opts.script,
      config: {
        ...opts.script.config,
        ...(target ? { target } : {}),
      },
    };
  } else {
    const configPath = resolve(opts.configPath);
    const raw = await readScript(configPath);
    const parsed = await parseScript(raw);
    script = await checkConfig(parsed, configPath, target ? { target } : {});
  }

  await updateGlobalObject({ version });

  const intermediates: PeriodMetrics[] = [];
  const ee = await runner(script);

  const aggregateRaw = await new Promise<PeriodMetrics>((resolvePromise, reject) => {
    ee.on('stats', (stats) => {
      intermediates.push(stats as PeriodMetrics);
      // period epoch ms is noise — skip
    });
    ee.on('phaseStarted', (spec) => {
      const name = (spec as { name?: string } | undefined)?.name;
      opts.ui?.emit({
        type: 'phase',
        phase: 'artillery',
        detail: `phase ${name ?? 'unnamed'}`,
      });
    });
    ee.on('done', (stats) => {
      resolvePromise(stats as PeriodMetrics);
    });
    ee.on('error', (err) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
    try {
      ee.run();
    } catch (err) {
      reject(err);
    }
  });

  try {
    await ee.stop();
  } catch {
    // stop() clears SSMS interval; ignore if already torn down
  }

  const result = packArtilleryReport(aggregateRaw, intermediates, summarizeHistogram);
  writeFileSync(outputFile, JSON.stringify(result, null, 2));
  return result;
}
