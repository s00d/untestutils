/**
 * Shared e2e / integration utilities (the “utils” in untestutils).
 * Browser helpers need optional peer `playwright-core`.
 */
export { pollUntil, runSequential, type PollUntilOptions } from './poll';
export { acceptLanguageHeaders, forwardedHostHeaders } from './headers';
export {
  parseSeoHead,
  extractSitemapLocs,
  extractJsonLd,
  readSeoHead,
  type SeoHead,
  type SeoAlternate,
  type PageLike,
} from './seo';
export {
  setLocaleCookie,
  getLocaleCookie,
  clearCookies,
  type CookiePage,
  type SetCookieOptions,
} from './cookies';
export {
  emulateDomain,
  trackResponses,
  collectConsole,
  collectHydrationIssues,
  setAcceptLanguage,
  type TrackedResponse,
  type ConsoleMatch,
} from './browser';
export { waitForUrlOk, waitForUrlIncludes, type WaitForUrlOptions } from './http';
