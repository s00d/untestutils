import type { APIRequestContext, Browser, BrowserContext, Page, Response } from 'playwright-core';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  inject,
  test as base,
  type TestAPI,
} from 'vitest';
import {
  getCurrentHarness,
  normalizeBaseUrl,
  prepareOnce,
  useHarness,
  type HarnessHandle,
  type Recipe,
} from '@untestutils/core';
import { type HarnessBrowserName, resolveHarnessBrowserName } from './browsers';
import { providedContextAugmentation } from './provided-context';

void providedContextAugmentation;

export { afterAll, afterEach, beforeAll, beforeEach, describe };
export type { HarnessBrowserName } from './browsers';
export {
  HARNESS_BROWSER_NAMES,
  normalizeHarnessBrowsers,
  resolveHarnessBrowserName,
} from './browsers';

export interface HarnessFixtures {
  /** Recipe id or Recipe — set via `test.override({ harness: 'site' })`. */
  harness: string | Recipe | undefined;
  /** Playwright engine — from inject / `UNTESTUTILS_BROWSER` / plugin `browsers`. */
  browserName: HarnessBrowserName;
  /** Worker-scoped Playwright browser (one launch per worker). */
  browser: Browser;
  page: Page;
  goto: (path: string, options?: Record<string, unknown>) => Promise<Response | null>;
  baseURL: string;
  request: APIRequestContext;
}

/** @internal */
export const browserApi: {
  launch: (name?: HarnessBrowserName) => Promise<Browser>;
} = {
  /* v8 ignore next 8 — real browser launch covered in playground e2e */
  async launch(name: HarnessBrowserName = 'chromium') {
    const pw = await import('playwright-core');
    const launcher = pw[name];
    if (!launcher?.launch) {
      throw new Error(`[untestutils] playwright-core has no launcher for "${name}"`);
    }
    return launcher.launch({ headless: true });
  },
};

function resolveBrowserNameFromInject(): HarnessBrowserName {
  try {
    const injected = inject('untestutilsBrowser');
    if (injected) return injected;
  } catch {
    /* provide not set */
  }
  return resolveHarnessBrowserName();
}

/** @internal */
export async function resolveBaseURL(
  h: HarnessHandle | undefined = getCurrentHarness(),
): Promise<string> {
  if (!h?.url) throw new Error('[untestutils] no harness url — call await useHarness(...) first');
  return normalizeBaseUrl(h.url);
}

type CookieInput = Parameters<BrowserContext['addCookies']>[0][number];
type GotoFixture = (path: string, options?: Record<string, unknown>) => Promise<Response | null>;
type PlaywrightTestModule = typeof import('@playwright/test');

/** Rewrite cookies so `domain: 'localhost'` applies on 127.0.0.1 harness URLs. */
export function normalizeHarnessCookies(cookies: CookieInput[], baseURL: string): CookieInput[] {
  return cookies.map((c) => {
    if (!('domain' in c) || (c.domain !== 'localhost' && c.domain !== '127.0.0.1')) {
      return c;
    }
    // Playwright: use `url` XOR `domain`+`path` — never mix.
    const next: CookieInput = {
      name: c.name,
      value: c.value,
      url: baseURL,
    };
    if ('expires' in c && typeof c.expires === 'number' && c.expires >= 0) {
      next.expires = c.expires;
    }
    if ('httpOnly' in c && c.httpOnly !== undefined) next.httpOnly = c.httpOnly;
    if ('secure' in c && c.secure !== undefined) next.secure = c.secure;
    if ('sameSite' in c && c.sameSite !== undefined) next.sameSite = c.sameSite;
    return next;
  });
}

function patchContextCookies(context: BrowserContext, baseURL: string): void {
  const orig = context.addCookies.bind(context);
  context.addCookies = async (cookies) => orig(normalizeHarnessCookies([...cookies], baseURL));
}

/** `goto()` hydration wait policy — plugin `hydration` / `UNTESTUTILS_GOTO_HYDRATION`. */
export type HydrationMode = 'strict' | 'lenient';

/** @internal */
export function resolveHydrationMode(): HydrationMode {
  return process.env.UNTESTUTILS_GOTO_HYDRATION === 'lenient' ? 'lenient' : 'strict';
}

const HYDRATION_TIMEOUT_MS = 30_000;

/** @internal */
export function createGoto(
  page: Page,
  baseURL: string,
  mode: HydrationMode = resolveHydrationMode(),
): GotoFixture {
  return async (path: string, options?: Record<string, unknown>) => {
    const url = path.startsWith('http') ? path : new URL(path, baseURL).toString();
    const waitUntil = (options as { waitUntil?: string } | undefined)?.waitUntil;
    if (waitUntil === 'hydration' || waitUntil === 'route') {
      const res = await page.goto(url, { ...(options as object), waitUntil: 'load' });
      await waitForNuxt(page, waitUntil, url);
      return res;
    }
    const res = await page.goto(url, options as Parameters<Page['goto']>[1]);
    // Specs often use networkidle/load; Nuxt client plugins (i18n/hashMode) need hydration.
    if (waitUntil === 'networkidle' || waitUntil === 'load' || waitUntil === undefined) {
      if (mode === 'lenient') await waitForNuxt(page, 'hydration', url).catch(() => {});
      else if (await isNuxtPage(page)) await waitForNuxt(page, 'hydration', url);
    }
    return res;
  };
}

/** @internal — non-Nuxt pages (vite/next/static/JSON) skip the implicit hydration wait. */
export async function isNuxtPage(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const w = globalThis as typeof globalThis & { useNuxtApp?: unknown; __NUXT__?: unknown };
      const d = (globalThis as { document?: { getElementById: (id: string) => unknown } }).document;
      return (
        typeof w.useNuxtApp === 'function' ||
        w.__NUXT__ !== undefined ||
        Boolean(d?.getElementById('__NUXT_DATA__') || d?.getElementById('__nuxt'))
      );
    });
  } catch {
    // Context replaced mid-check (client redirect) — let the hydration wait decide.
    return true;
  }
}

/** @internal */
export async function waitForNuxt(
  page: Page,
  mode: 'hydration' | 'route',
  url: string = page.url(),
): Promise<void> {
  try {
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
      { timeout: HYDRATION_TIMEOUT_MS },
    );
  } catch (cause) {
    const state = await page
      .evaluate(() => {
        const w = globalThis as typeof globalThis & {
          useNuxtApp?: () => { isHydrating?: boolean };
        };
        const app = w.useNuxtApp?.();
        if (!app) return 'useNuxtApp() is not available';
        return `isHydrating=${String(app.isHydrating)}`;
      })
      .catch(() => 'page state unavailable');
    throw new Error(
      `[untestutils] goto(${url}): Nuxt ${mode === 'route' ? 'route' : 'hydration'} not ready ` +
        `within ${HYDRATION_TIMEOUT_MS}ms (${state}). A client error usually blocks hydration — ` +
        `check the page console. Use waitUntil 'domcontentloaded' to skip the wait, or ` +
        `untestutils({ hydration: 'lenient' }) for the old silent behaviour.`,
      { cause },
    );
  }
}

/** @internal — body of the page fixture (callable from unit tests) */
export async function usePageFixture(
  baseURL: string,
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const browser = await browserApi.launch();
  const context = await browser.newContext({ baseURL });
  patchContextCookies(context, baseURL);
  const page = await context.newPage();
  await use(page);
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

/** @internal */
export async function useRequestFixture(
  baseURL: string,
  use: (ctx: APIRequestContext) => Promise<void>,
): Promise<void> {
  const requestApi = await importRequestApi();
  const ctx = await requestApi.newContext({ baseURL });
  await use(ctx);
  await ctx.dispose().catch(() => {});
}

/** @internal */
export async function importRequestApi(): Promise<PlaywrightTestModule['request']> {
  const { request } = await import('@playwright/test');
  return request;
}

/** Prefer Playwright web-first expect when available. */
export async function loadExpect(): Promise<PlaywrightTestModule['expect']> {
  const mod = await importExpectModule();
  return mod.expect;
}

/** @internal */
export async function importExpectModule(): Promise<PlaywrightTestModule> {
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
  .extend('browserName', () => resolveBrowserNameFromInject())
  .extend(
    'browser',
    { scope: 'worker' },
    // Vitest requires `{}` destructure when a worker fixture has no deps.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, { onCleanup }) => {
      const browserName = resolveBrowserNameFromInject();
      const browser = await browserApi.launch(browserName);
      onCleanup(async () => {
        await browser.close().catch(() => {});
        const replacement = await relaunching?.catch(() => undefined);
        relaunching = undefined;
        await replacement?.close().catch(() => {});
      });
      return browser;
    },
  )
  .extend('baseURL', async ({ harness }) => {
    // Use the returned handle: `enterWith` inside the awaited lease does not reliably reach
    // this frame (lost once anything else ran an AsyncLocalStorage — e.g. a cold Nuxt build).
    return resolveBaseURL(harness ? await useHarness(harness) : getCurrentHarness());
  })
  .extend('page', async ({ baseURL, browser }, { onCleanup }) => {
    const context = await (await connectedBrowser(browser)).newContext({ baseURL });
    patchContextCookies(context, baseURL);
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
  }) as unknown as TestAPI<HarnessFixtures>;

let relaunching: Promise<Browser> | undefined;

/**
 * Worker browser crashed / disconnected → relaunch so the next test (or its infra retry)
 * gets a working page instead of "browser has been closed" for the rest of the worker.
 * One shared in-flight launch; the worker `browser` fixture cleanup closes it.
 */
async function connectedBrowser(browser: Browser): Promise<Browser> {
  if (browser.isConnected()) return browser;
  const launch = () => browserApi.launch(resolveBrowserNameFromInject());
  // Assigned synchronously, so concurrent callers share one launch.
  relaunching ??= launch();
  const pending = relaunching;
  const current = await pending.catch(() => undefined);
  if (current?.isConnected()) return current;
  if (relaunching === pending) relaunching = launch(); // replacement died too
  return relaunching;
}

/** @internal — `false` = lazy build in the first test; `undefined` = Vitest `hookTimeout`. */
export function resolveBuildTimeout(): number | false | undefined {
  const raw = process.env.UNTESTUTILS_BUILD_TIMEOUT?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (n === 0) return false;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** @internal — harness value from `override({ harness })` / `override('harness', v)`. */
export function overrideHarnessValue(args: unknown[]): string | Recipe | undefined {
  const [first, second, third] = args;
  let value: unknown;
  if (typeof first === 'string') {
    if (first !== 'harness') return undefined;
    value = third === undefined ? second : third;
  } else if (first && typeof first === 'object') {
    value = (first as { harness?: unknown }).harness;
  }
  if (Array.isArray(value)) value = value[0];
  if (
    typeof value === 'string' ||
    (value && typeof value === 'object' && typeof (value as Recipe).start === 'function')
  ) {
    return value as string | Recipe;
  }
  return undefined;
}

// Build/start the overridden harness in a suite `beforeAll` (timeout = buildTimeout), so a
// slow build is charged to the hook, not to the first test's `testTimeout`. The baseURL
// fixture then hits the in-process live target.
const baseOverride = (test as unknown as { override: (...args: unknown[]) => unknown }).override;
(test as unknown as { override: (...args: unknown[]) => unknown }).override = function (
  this: unknown,
  ...args: unknown[]
) {
  const result = baseOverride.apply(this, args);
  const harness = overrideHarnessValue(args);
  const timeout = resolveBuildTimeout();
  if (harness && timeout !== false) {
    beforeAll(async () => {
      await prepareOnce(harness);
    }, timeout);
  }
  return result;
};
