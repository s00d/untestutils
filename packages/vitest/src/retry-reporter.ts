import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'pathe';
import type { Reporter, TestCase } from 'vitest/node';

export interface RetriedTest {
  /** `file > describe > test` */
  name: string;
  file: string;
  /** Retries used (attempts = retryCount + 1). */
  retryCount: number;
  /** `true` when a retry passed — the test is flaky. */
  flaky: boolean;
  /** First line of each attempt's error. */
  errors: string[];
}

export interface RetryReporterOptions {
  /** Also write the list as JSON (e.g. for a CI artifact / job summary). */
  outputFile?: string;
}

/**
 * Lists every test that needed a retry, so `retry` (or `retryInfra`) never hides a flaky
 * test. Add next to the default reporter:
 * `reporters: ['default', new RetryReporter()]`.
 */
export class RetryReporter implements Reporter {
  readonly retried: RetriedTest[] = [];
  private logger: { log: (...args: unknown[]) => void } = console;

  constructor(private readonly options: RetryReporterOptions = {}) {}

  onInit(vitest: { logger?: { log: (...args: unknown[]) => void } }): void {
    if (vitest.logger) this.logger = vitest.logger;
  }

  onTestCaseResult(testCase: TestCase): void {
    const { retryCount, flaky } = testCase.diagnostic() ?? { retryCount: 0, flaky: false };
    if (!retryCount) return;
    this.retried.push({
      name: testCase.fullName,
      file: testCase.module.moduleId,
      retryCount,
      flaky,
      errors: (testCase.result().errors ?? []).map((e) => String(e.message).split('\n')[0]!),
    });
  }

  async onTestRunEnd(): Promise<void> {
    // Drain per run — watch mode reruns must not report previous runs' retries.
    const retried = this.retried.splice(0);
    if (this.options.outputFile) {
      await mkdir(dirname(this.options.outputFile), { recursive: true });
      await writeFile(this.options.outputFile, JSON.stringify(retried, null, 2), 'utf8');
    }
    if (!retried.length) return;
    this.logger.log(`\n[untestutils] ${retried.length} test(s) needed a retry:`);
    for (const t of retried) {
      const verdict = t.flaky ? 'FLAKY, passed' : 'failed';
      this.logger.log(
        `  - ${t.name} (${verdict} after ${t.retryCount} retr${t.retryCount > 1 ? 'ies' : 'y'})`,
      );
      for (const e of t.errors) this.logger.log(`      ${e}`);
    }
  }
}
