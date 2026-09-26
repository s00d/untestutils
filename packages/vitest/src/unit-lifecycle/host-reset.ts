import { vi } from 'vitest';

export type HostResetOptions = {
  /** Clear cookies + localStorage + sessionStorage. Default `true`. */
  host?: boolean;
  /** `vi.clearAllTimers` + `useRealTimers`. Default `true`. */
  timers?: boolean;
  /** `vi.unstubAllEnvs` / `unstubAllGlobals`. Default `true`. */
  stubs?: boolean;
};

function clearDocumentCookies(doc: Document): void {
  const raw = doc.cookie;
  if (!raw) return;
  for (const part of raw.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (!name) continue;
    doc.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
}

export function clearHostState(win: Window = window): void {
  try {
    win.localStorage?.clear();
  } catch {
    /* ignore */
  }
  try {
    win.sessionStorage?.clear();
  } catch {
    /* ignore */
  }
  try {
    clearDocumentCookies(win.document);
  } catch {
    /* ignore */
  }
}

export function clearTimersAndStubs(opts: { timers: boolean; stubs: boolean }): void {
  if (opts.timers) {
    try {
      vi.clearAllTimers();
      vi.useRealTimers();
    } catch {
      /* ignore */
    }
  }
  if (opts.stubs) {
    try {
      vi.unstubAllEnvs?.();
    } catch {
      /* ignore */
    }
    try {
      vi.unstubAllGlobals?.();
    } catch {
      /* ignore */
    }
  }
}

/** Apply host/timers/stubs layers (framework-agnostic part of soft reset). */
export function applyHostResetLayers(
  opts: HostResetOptions = {},
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): void {
  if (!win) return;
  if (opts.host !== false) clearHostState(win);
  clearTimersAndStubs({
    timers: opts.timers !== false,
    stubs: opts.stubs !== false,
  });
}
