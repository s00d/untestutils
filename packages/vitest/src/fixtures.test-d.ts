import type { Page, Response } from 'playwright-core';
import type { TestAPI } from 'vitest';
import { expectTypeOf } from 'vitest';
import { test, type HarnessFixtures } from './fixtures';

expectTypeOf(test).toEqualTypeOf<TestAPI<HarnessFixtures>>();

test.override({ harness: 'site' });

// @ts-expect-error unknown fixture key
test.override({ notAFixture: true });

test('fixtures', async ({ page, goto, baseURL, request, harness }) => {
  expectTypeOf(page).toEqualTypeOf<Page>();
  expectTypeOf(goto).toEqualTypeOf<(path: string, options?: Record<string, unknown>) => Promise<Response | null>>();
  expectTypeOf(baseURL).toEqualTypeOf<string>();
  expectTypeOf(request).toEqualTypeOf<HarnessFixtures['request']>();
  expectTypeOf(harness).toEqualTypeOf<HarnessFixtures['harness']>();
});
