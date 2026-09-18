import type { Page } from 'playwright-core';

export type CookiePage = Pick<Page, 'context'>;

export type SetCookieOptions = {
  /** Cookie name (default `user-locale`) */
  name?: string;
  /** Clear all cookies before setting */
  clear?: boolean;
};

/**
 * Set a locale cookie on the browser context (common i18n e2e pattern).
 * `baseURL` must be an absolute origin (harness `baseURL` fixture).
 */
export async function setLocaleCookie(
  page: CookiePage,
  baseURL: string,
  locale: string,
  options: SetCookieOptions = {},
): Promise<void> {
  const name = options.name ?? 'user-locale';
  if (options.clear !== false) {
    await page.context().clearCookies();
  }
  await page.context().addCookies([{ name, value: locale, url: baseURL }]);
}

/** Read a named cookie value from the context (or `undefined`). */
export async function getLocaleCookie(
  page: CookiePage,
  name: string = 'user-locale',
): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === name)?.value;
}

export async function clearCookies(page: CookiePage): Promise<void> {
  await page.context().clearCookies();
}
