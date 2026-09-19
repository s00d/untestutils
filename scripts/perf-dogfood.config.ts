import { definePerfSuite, consoleReporter } from '../packages/perf/src/index.ts';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = join(dirname(fileURLToPath(import.meta.url)), '../playground/fixtures/static-site');

/**
 * Tiny optional dogfood for `workflow_dispatch` + `run_perf`.
 * Build is a no-op; `--skip-load` skips start/autocannon.
 */
export default definePerfSuite({
  runs: 1,
  artifactsDir: '.untestutils/perf-dogfood',
  reporters: [consoleReporter()],
  targets: [
    {
      id: 'static-noop',
      root,
      build: {
        command: process.execPath,
        args: ['-e', "console.log('perf-dogfood build ok')"],
      },
      start: {
        command: process.execPath,
        args: ['-e', 'setInterval(()=>{}, 1e6)'],
        port: 19_087,
      },
      bundle: { dirs: ['.'] },
    },
  ],
  thresholds: { buildTimeSec: 30 },
});
