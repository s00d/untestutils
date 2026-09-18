import { ofetch } from 'ofetch';
import type { Running } from './types';
import { debug } from './debug';

export interface ReadyOptions {
  timeoutMs?: number;
  path?: string;
  acceptStatuses?: number[];
  rejectBodyIncludes?: string[];
}

export async function waitForHttpReady(url: string, opts: ReadyOptions = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const path = opts.path ?? '/';
  const accept = new Set(opts.acceptStatuses ?? [200, 301, 302, 304, 307, 308]);
  const rejectBody = opts.rejectBodyIncludes ?? ['__NUXT_LOADING__'];
  const target = new URL(path, url).toString();
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  let lastBody = '';

  while (Date.now() < deadline) {
    try {
      const res = await ofetch.raw(target, {
        method: 'GET',
        redirect: 'manual',
        ignoreResponseError: true,
        responseType: 'text',
        timeout: 5_000,
      });
      lastStatus = res.status;
      lastBody = typeof res._data === 'string' ? res._data.slice(0, 500) : '';
      if (res.status === 503) {
        await sleep(200);
        continue;
      }
      if (rejectBody.some((s) => lastBody.includes(s))) {
        await sleep(200);
        continue;
      }
      if (accept.has(res.status)) {
        debug('ready', `ok ${target} status=${res.status}`);
        return;
      }
    } catch {
      /* retry */
    }
    await sleep(200);
  }

  throw new Error(
    `[untestutils] readiness failed for ${target} after ${timeoutMs}ms (lastStatus=${lastStatus}, body=${JSON.stringify(lastBody.slice(0, 200))})`,
  );
}

export async function defaultReady(running: Running, opts?: ReadyOptions): Promise<void> {
  if (running.kind === 'dir') return;
  const url = running.kind === 'url' || running.kind === 'url+dir' ? running.url : undefined;
  if (!url) return;
  await waitForHttpReady(url, opts);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
