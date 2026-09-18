import { describe, expect, test } from 'vitest';
import {
  normalizeHarnessBrowsers,
  resolveHarnessBrowserName,
} from '../../packages/vitest/src/browsers';

describe('harness browsers', () => {
  test('normalizeHarnessBrowsers defaults to chromium', () => {
    expect(normalizeHarnessBrowsers(undefined)).toEqual(['chromium']);
    expect(normalizeHarnessBrowsers(['firefox', 'chromium', 'firefox'])).toEqual([
      'firefox',
      'chromium',
    ]);
  });

  test('resolveHarnessBrowserName reads env', () => {
    const prev = process.env.UNTESTUTILS_BROWSER;
    process.env.UNTESTUTILS_BROWSER = 'webkit';
    expect(resolveHarnessBrowserName()).toBe('webkit');
    if (prev === undefined) delete process.env.UNTESTUTILS_BROWSER;
    else process.env.UNTESTUTILS_BROWSER = prev;
  });
});
