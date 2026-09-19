import { ofetch } from 'ofetch';
import type { Running } from './types';
import { debug } from './debug';
import { LOOPBACK_HOST } from './paths';
import { waitForPort } from './ports';

export interface ReadyOptions {
  timeoutMs?: number;
  path?: string;
  acceptStatuses?: number[];
  rejectBodyIncludes?: string[];
  /** Skip TCP probe (default: skip for non-loopback hosts). */
  skipTcp?: boolean;
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
  let lastError = '';
  let phase: 'tcp' | 'http' = 'http';

  const endpoint = parseHostPort(target);
  const skipTcp = opts.skipTcp ?? (endpoint ? !isLoopbackHost(endpoint.host) : true);

  if (endpoint && !skipTcp) {
    phase = 'tcp';
    const tcpBudget = Math.max(0, deadline - Date.now());
    if (tcpBudget <= 0) {
      throw readinessError(target, timeoutMs, {
        phase,
        lastStatus,
        lastBody,
        lastError: 'timeout before tcp probe',
      });
    }
    try {
      await waitForPort(endpoint.port, endpoint.host, tcpBudget);
      debug('ready', `tcp open ${endpoint.host}:${endpoint.port}`);
    } catch (e) {
      lastError = errMessage(e);
      throw readinessError(target, timeoutMs, {
        phase: 'tcp',
        lastStatus: 0,
        lastBody: '',
        lastError,
        hint: `Nothing accepted TCP on ${endpoint.host}:${endpoint.port}. Check the server binds that host (set HOST / --host, or UNTESTUTILS_BIND_HOST).`,
      });
    }
  }

  phase = 'http';
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
      lastError = '';
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
      lastError = `unexpected status ${res.status} (accept ${[...accept].join(',')})`;
    } catch (e) {
      lastError = errMessage(e);
    }
    await sleep(200);
  }

  throw readinessError(target, timeoutMs, {
    phase,
    lastStatus,
    lastBody,
    lastError,
    hint: httpReadyHint(endpoint, skipTcp),
  });
}

export async function defaultReady(running: Running, opts?: ReadyOptions): Promise<void> {
  if (running.kind === 'dir') return;
  const url = running.kind === 'url' || running.kind === 'url+dir' ? running.url : undefined;
  if (!url) return;
  await waitForHttpReady(url, opts);
}

function httpReadyHint(
  endpoint: { host: string; port: number } | null,
  skippedTcp: boolean,
): string | undefined {
  if (!endpoint) return undefined;
  if (skippedTcp) {
    return `Remote/non-loopback probe timed out. Raise readyTimeoutMs, set readyPath, or skipReady: true for host().`;
  }
  return `HTTP never became ready on ${endpoint.host}:${endpoint.port}. Confirm the process binds HOST (see UNTESTUTILS_BIND_HOST) and readyPath returns an accepted status.`;
}

function parseHostPort(href: string): { host: string; port: number } | null {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    let port = u.port ? Number(u.port) : NaN;
    if (!Number.isFinite(port) || port <= 0) {
      if (u.protocol === 'https:') port = 443;
      else if (u.protocol === 'http:') port = 80;
      else return null;
    }
    if (!host) return null;
    return { host, port };
  } catch {
    return null;
  }
}

function isLoopbackHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === LOOPBACK_HOST || h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function readinessError(
  target: string,
  timeoutMs: number,
  detail: {
    phase: 'tcp' | 'http';
    lastStatus: number;
    lastBody: string;
    lastError: string;
    hint?: string;
  },
): Error {
  const parts = [
    `[untestutils] readiness failed for ${target} after ${timeoutMs}ms`,
    `phase=${detail.phase}`,
    `lastStatus=${detail.lastStatus}`,
  ];
  if (detail.lastError) parts.push(`lastError=${JSON.stringify(detail.lastError)}`);
  if (detail.lastBody) parts.push(`body=${JSON.stringify(detail.lastBody.slice(0, 200))}`);
  if (detail.hint) parts.push(detail.hint);
  return new Error(parts.join(' · '));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
