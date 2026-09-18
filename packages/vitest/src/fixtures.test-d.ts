import type { Page, Response } from 'playwright-core';
import { expectTypeOf, type TestAPI } from 'vitest';
import { test, type HarnessFixtures } from './fixtures';

expectTypeOf(test).toEqualTypeOf<TestAPI<HarnessFixtures>>();

test.override({ harness: 'site' });

// @ts-expect-error unknown fixture key
test.override({ notAFixture: true });

test('fixtures', async ({ page, goto, baseURL, request, harness, browserName }) => {
  expectTypeOf(page).toEqualTypeOf<Page>();
  expectTypeOf(goto).toEqualTypeOf<
    (path: string, options?: Record<string, unknown>) => Promise<Response | null>
  >();
  expectTypeOf(baseURL).toEqualTypeOf<string>();
  expectTypeOf(request).toEqualTypeOf<HarnessFixtures['request']>();
  expectTypeOf(harness).toEqualTypeOf<HarnessFixtures['harness']>();
  expectTypeOf(browserName).toEqualTypeOf<HarnessFixtures['browserName']>();
});
