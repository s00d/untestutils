import type { APIRequestContext, Browser, Page, Response } from 'playwright-core';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  test as base,
  type TestAPI,
} from 'vitest';
import { getCurrentHarness, normalizeBaseUrl, useHarness, type Recipe } from '@untestutils/core';

export { afterAll, afterEach, beforeAll, beforeEach, describe };

export interface HarnessFixtures {
  /** Recipe id or Recipe — set via `test.override({ harness: 'site' })`. */
  harness: string | Recipe | undefined;
  page: Page;
  goto: (path: string, options?: Record<string, unknown>) => Promise<Response | null>;
  baseURL: string;
  request: APIRequestContext;
}

let browserPromise: Promise<Browser> | undefined;

/** @internal */
export const browserApi = {
  /* v8 ignore next 4 — real chromium launch covered in playground e2e */
  async launch() {
    const { chromium } = await import('playwright-core');
    return chromium.launch({ headless: true });
  },
};

/** @internal */
export function getBrowser() {
  return browserPromise ?? (browserPromise = browserApi.launch());
}

/** @internal reset for tests */
export function resetBrowserPromise() {
  browserPromise = undefined;
}

/** @internal */
export async function resolveBaseURL(): Promise<string> {
  const h = getCurrentHarness();
  if (!h?.url) throw new Error('[untestutils] no harness url — call await useHarness(...) first');
  return normalizeBaseUrl(h.url);
}

/** @internal */
export function createGoto(page: Page, baseURL: string) {
  return async (path: string, options?: Record<string, unknown>) => {
    const url = path.startsWith('http') ? path : new URL(path, baseURL).toString();
    const waitUntil = (options as { waitUntil?: string } | undefined)?.waitUntil;
    if (waitUntil === 'hydration' || waitUntil === 'route') {
      const res = await page.goto(url, { ...(options as object), waitUntil: 'load' });
      await waitForNuxt(page, waitUntil);
      return res;
    }
    return page.goto(url, options as Parameters<Page['goto']>[1]);
  };
}

/** @internal */
export async function waitForNuxt(page: Page, mode: 'hydration' | 'route'): Promise<void> {
  await page.waitForFunction(
    (m) => {
      const w = globalThis as typeof globalThis & {
        useNuxtApp?: () => { isHydrating?: boolean; _route?: { fullPath?: string } };
      };
      const app = w.useNuxtApp?.();
      if (!app) return false;
      if (m === 'hydration') return app.isHydrating === false;
      return Boolean(app._route?.fullPath);
    },
    mode,
    { timeout: 30_000 },
  );
}

/** @internal — body of the page fixture (callable from unit tests) */
export async function usePageFixture(baseURL: string, use: (page: Page) => Promise<void>) {
  const browser = await getBrowser();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await use(page);
  await context.close().catch(() => {});
}

/** @internal */
export async function useRequestFixture(
  baseURL: string,
  use: (ctx: APIRequestContext) => Promise<void>,
) {
  const requestApi = await importRequestApi();
  const ctx = await requestApi.newContext({ baseURL });
  await use(ctx);
  await ctx.dispose().catch(() => {});
}

/** @internal */
export async function importRequestApi() {
  const { request } = await import('@playwright/test');
  return request;
}

/** Prefer Playwright web-first expect when available. */
export async function loadExpect() {
  const mod = await importExpectModule();
  return mod.expect;
}

/** @internal */
export async function importExpectModule() {
  return import('@playwright/test');
}

export { expect } from '@playwright/test';

/**
 * Builder `extend` (Vitest 4.1+) so types keep real fixture keys.
 * Object `extend<HarnessFixtures>(…)` hits the wrong overload and emits
 * `Record<HarnessFixtures, …>` — wiping `page`/`goto`/`harness` from context.
 * Vitest has no Playwright `{ option: true }`; use `test.override({ harness })`.
 *
 * Asserted as `TestAPI<HarnessFixtures>` so published dts stays flat (builder
 * otherwise nests `Omit & Record<"page", …> & { $__test?: … }` noise).
 */
export const test: TestAPI<HarnessFixtures> = base
  .extend('harness', undefined as string | Recipe | undefined)
  .extend('baseURL', async ({ harness }) => {
    if (harness) await useHarness(harness);
    return resolveBaseURL();
  })
  .extend('page', async ({ baseURL }, { onCleanup }) => {
    const browser = await getBrowser();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    onCleanup(() => context.close().catch(() => {}));
    return page;
  })
  .extend('goto', ({ page, baseURL }) => createGoto(page, baseURL))
  .extend('request', async ({ baseURL }, { onCleanup }) => {
    const requestApi = await importRequestApi();
    const ctx = await requestApi.newContext({ baseURL });
    onCleanup(() => ctx.dispose().catch(() => {}));
    return ctx;
  }) as TestAPI<HarnessFixtures>;
