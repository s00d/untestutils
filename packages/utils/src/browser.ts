import type { Page, Response } from 'playwright-core';
import { forwardedHostHeaders } from './headers';

/**
 * Proxy browser requests from `emulatedOrigin` to `realBaseURL`, forwarding
 * `X-Forwarded-Host` / `X-Forwarded-Proto` so SSR sees the public domain.
 */
export async function emulateDomain(
  page: Page,
  emulatedOrigin: string,
  realBaseURL: string,
): Promise<void> {
  const realBase = realBaseURL.replace(/\/$/, '');
  const { hostname: fwdHost } = new URL(emulatedOrigin);

  await page.route(`${emulatedOrigin}/**`, async (route) => {
    const url = new URL(route.request().url());
    try {
      const response = await route.fetch({
        url: `${realBase}${url.pathname}${url.search}`,
        headers: {
          ...route.request().headers(),
          ...forwardedHostHeaders(fwdHost, url.protocol.replace(':', '')),
        },
      });
      await route.fulfill({ response });
    } catch {
      await route.abort();
    }
  });
}

export type TrackedResponse = { url: string; status: number; response: Response };

/** Collect HTTP responses for redirect assertions. Returns live array + disposer. */
export function trackResponses(page: Page): {
  responses: TrackedResponse[];
  stop: () => void;
  findByPath: (pathname: string) => TrackedResponse | undefined;
} {
  const responses: TrackedResponse[] = [];
  const onResponse = (response: Response) => {
    responses.push({ url: response.url(), status: response.status(), response });
  };
  page.on('response', onResponse);
  return {
    responses,
    stop: () => page.off('response', onResponse),
    findByPath: (pathname: string) =>
      responses.find((r) => {
        try {
          return new URL(r.url).pathname === pathname;
        } catch {
          return false;
        }
      }),
  };
}

export type ConsoleMatch = { type: string; text: string };

export type ConsoleCollector = { messages: ConsoleMatch[]; stop: () => void };

/**
 * Collect console messages matching a predicate (hydration warnings, etc.).
 * Call `stop()` when done; `messages` stays filled.
 */
export function collectConsole(
  page: Page,
  predicate: (msg: { type: () => string; text: () => string }) => boolean = () => true,
): ConsoleCollector {
  const messages: ConsoleMatch[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (predicate(msg)) messages.push({ type: msg.type(), text: msg.text() });
  };
  page.on('console', onConsole);
  return {
    messages,
    stop: () => page.off('console', onConsole),
  };
}

/** Collect hydration / mismatch console errors & warnings. */
export function collectHydrationIssues(page: Page): ConsoleCollector {
  return collectConsole(page, (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return false;
    const text = msg.text().toLowerCase();
    return text.includes('hydration') || text.includes('mismatch');
  });
}

/** Apply `Accept-Language` for subsequent navigations on this page. */
export async function setAcceptLanguage(page: Page, value: string): Promise<void> {
  await page.setExtraHTTPHeaders({ 'Accept-Language': value });
}
