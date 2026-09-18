import { defineCommand } from 'citty';
import { pathToFileURL } from 'node:url';
import { resolve } from 'pathe';
import { consola } from 'consola';

export const perfCommand = defineCommand({
  meta: {
    name: 'perf',
    description: [
      'Run a build+load performance suite from a config module.',
      '',
      'Examples:',
      '  untestutils perf --config ./perf.config.ts',
      '  untestutils perf --config ./perf.config.ts --only micro --skip-load',
      '  untestutils perf --config ./perf.config.ts --runs 3 --json',
    ].join('\n'),
  },
  args: {
    config: {
      type: 'string',
      required: true,
      description: 'Path to perf.config.ts exporting definePerfSuite(...) or default suite',
    },
    only: {
      type: 'string',
      description: 'Target id(s), comma-separated',
    },
    runs: {
      type: 'string',
      description: 'Override consecutive runs',
    },
    skipLoad: {
      type: 'boolean',
      default: false,
      description: 'Measure builds only (skip autocannon/artillery)',
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Also write JSON report under artifactsDir',
    },
  },
  async run({ args }) {
    const configPath = resolve(args.config);
    const mod = (await import(pathToFileURL(configPath).href)) as {
      default?: unknown;
      suite?: unknown;
    };
    const suite = (mod.default ?? mod.suite) as import('@untestutils/perf').PerfSuite | undefined;
    if (!suite || !Array.isArray((suite as { targets?: unknown }).targets)) {
      consola.error('Config must default-export a PerfSuite (definePerfSuite({ targets: [...] }))');
      process.exitCode = 1;
      return;
    }

    const { runPerfSuite } = await import('@untestutils/perf');
    const only = args.only
      ? args.only.split(',').map((s: string) => s.trim()).filter(Boolean)
      : undefined;
    const runs = args.runs ? Number(args.runs) : undefined;
    if (runs !== undefined && (!Number.isFinite(runs) || runs < 1)) {
      consola.error('--runs must be a positive number');
      process.exitCode = 1;
      return;
    }

    await runPerfSuite(suite, {
      only,
      runs,
      skipLoad: args.skipLoad,
      json: args.json,
    });
  },
});
