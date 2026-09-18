import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'pathe';
import type { PerfReporter } from '../types';

export function jsonReporter(opts?: { dir?: string }): PerfReporter {
  return {
    name: 'json',
    onEnd({ results, suite, runs, skipLoad }) {
      const dir = opts?.dir ?? suite.artifactsDir ?? '.untestutils/perf';
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `results-${Date.now()}.json`);
      writeFileSync(
        path,
        JSON.stringify({ runs, skipLoad, results, generatedAt: new Date().toISOString() }, null, 2),
      );
      console.log(`Wrote JSON report: ${path}`);
    },
  };
}
