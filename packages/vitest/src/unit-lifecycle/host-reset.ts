import { vi } from 'vitest';
import { clearUnitDomCookies } from '../unit-dom/index';

export type HostResetOptions = {
  /** Clear cookies + localStorage + sessionStorage. Default `true`. */
  host?: boolean;
  /** `vi.clearAllTimers` + `useRealTimers`. Default `true`. */
  timers?: boolean;
  /** `vi.unstubAllEnvs` / `unstubAllGlobals`. Default `true`. */
  stubs?: boolean;
};

type CookieJar = { removeAllCookiesSync?: () => void };

function tryClearJsdomCookies(win: Window): boolean {
  try {
    const candidates: Array<CookieJar | undefined> = [
      (win as Window & { cookieJar?: CookieJar }).cookieJar,
      (win.document as Document & { cookieJar?: CookieJar }).cookieJar,
      (win.document as Document & { _cookieJar?: CookieJar })._cookieJar,
    ];
    for (const jar of candidates) {
      if (jar?.removeAllCookiesSync) {
        jar.removeAllCookiesSync();
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Fallback: expire cookies visible in `document.cookie` (with and without Path). */
function clearDocumentCookiesFallback(doc: Document): void {
  const raw = doc.cookie;
  if (!raw) return;
  const paths = new Set<string>(['/']);
  try {
    const pathname = doc.defaultView?.location?.pathname || '/';
    let acc = '';
    for (const seg of pathname.split('/').filter(Boolean)) {
      acc += `/${seg}`;
      paths.add(acc);
    }
  } catch {
    /* ignore */
  }
  for (const part of raw.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (!name) continue;
    // happy-dom: cookies set without Path expire only without path=.
    doc.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    for (const path of paths) {
      doc.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
    }
  }
}

async function clearDocumentCookies(win: Window): Promise<void> {
  // Tracker may clear some cookies; never treat "tracker present" as jar-complete.
  await clearUnitDomCookies(win);
  if (tryClearJsdomCookies(win)) return;
  clearDocumentCookiesFallback(win.document);
}

/** Clear cookies + web storage on the shared window. */
export async function clearHostState(win: Window = window): Promise<void> {
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
    await clearDocumentCookies(win);
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
export async function applyHostResetLayers(
  opts: HostResetOptions = {},
  win: Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window),
): Promise<void> {
  if (!win) return;
  if (opts.host !== false) await clearHostState(win);
  clearTimersAndStubs({
    timers: opts.timers !== false,
    stubs: opts.stubs !== false,
  });
}
