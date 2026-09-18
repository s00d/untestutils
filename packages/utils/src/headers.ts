/** Build an `Accept-Language` header map for Playwright `request` / `setExtraHTTPHeaders`. */
export function acceptLanguageHeaders(value: string): Record<string, string> {
  return { 'Accept-Language': value };
}

/** Headers for SSR that should resolve the public host (domain strategies / SEO). */
export function forwardedHostHeaders(
  host: string,
  proto: string = 'http',
): Record<string, string> {
  return {
    'x-forwarded-host': host,
    'x-forwarded-proto': proto.replace(/:$/, ''),
  };
}
