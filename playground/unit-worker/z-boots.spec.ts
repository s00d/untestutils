/**
 * Asserts boot-counter expectations for appIsolation modes.
 * Run AFTER the suite via scripts/assert-unit-worker-boots.mjs (reads global from a reporter),
 * or use the dedicated meta-tests below that only run under specific configs.
 *
 * Boot counter lives in fixtures/unit-app/plugins/boot-counter.ts → globalThis.__UT_BOOTS.
 */
import { expect, test } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var __UT_BOOTS: number | undefined;
  // eslint-disable-next-line no-var
  var __UT_EXPECT_BOOTS: number | undefined;
}

test('records Nuxt plugin boots on this worker', () => {
  const boots = globalThis.__UT_BOOTS ?? 0;
  expect(boots).toBeGreaterThanOrEqual(1);
  // Optional env override used by assert script / CI matrix.
  const expected = globalThis.__UT_EXPECT_BOOTS;
  if (typeof expected === 'number') {
    expect(boots).toBe(expected);
  }
});
