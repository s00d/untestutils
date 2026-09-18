/** Supported Playwright browser engines for harness fixtures. */
export type HarnessBrowserName = 'chromium' | 'firefox' | 'webkit';

export const HARNESS_BROWSER_NAMES: HarnessBrowserName[] = ['chromium', 'firefox', 'webkit'];

export function normalizeHarnessBrowsers(
  browsers: HarnessBrowserName[] | undefined,
): HarnessBrowserName[] {
  if (!browsers?.length) return ['chromium'];
  const out: HarnessBrowserName[] = [];
  for (const b of browsers) {
    if (!HARNESS_BROWSER_NAMES.includes(b)) {
      throw new Error(
        `[untestutils] unknown browser "${b}". Expected one of: ${HARNESS_BROWSER_NAMES.join(', ')}`,
      );
    }
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

/** Resolve active browser for this worker (env wins). */
export function resolveHarnessBrowserName(
  fallback: HarnessBrowserName = 'chromium',
): HarnessBrowserName {
  const fromEnv = process.env.UNTESTUTILS_BROWSER as HarnessBrowserName | undefined;
  if (fromEnv && HARNESS_BROWSER_NAMES.includes(fromEnv)) return fromEnv;
  return fallback;
}
