import { pollUntil, type PollUntilOptions } from './poll';

export type WaitForUrlOptions = PollUntilOptions & {
  /** Expected HTTP status (default: any 2xx) */
  status?: number | ((status: number) => boolean);
  init?: RequestInit;
};

/** Poll until `url` responds OK (or custom status). */
export async function waitForUrlOk(
  url: string,
  options: WaitForUrlOptions = {},
): Promise<Response> {
  let last: Response | undefined;
  await pollUntil(
    async () => {
      try {
        last = await fetch(url, options.init);
        if (typeof options.status === 'function') return options.status(last.status);
        if (typeof options.status === 'number') return last.status === options.status;
        return last.ok;
      } catch {
        return false;
      }
    },
    {
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs,
      message: options.message ?? `Timed out waiting for OK response from ${url}`,
    },
  );
  return last!;
}

/** Poll until response body includes `needle`. */
export async function waitForUrlIncludes(
  url: string,
  needle: string,
  options: PollUntilOptions & { init?: RequestInit } = {},
): Promise<string> {
  let body = '';
  await pollUntil(
    async () => {
      try {
        const res = await fetch(url, options.init);
        body = await res.text();
        return body.includes(needle);
      } catch {
        return false;
      }
    },
    {
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs,
      message: options.message ?? `Timed out waiting for "${needle}" from ${url}`,
    },
  );
  return body;
}
