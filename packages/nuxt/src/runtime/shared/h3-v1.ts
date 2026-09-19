type H3V1FetchResult = {
  h3App: Awaited<ReturnType<(typeof import('h3'))['createApp']>>;
  registry: Set<string>;
  fetch: typeof fetch;
};

export async function createFetchForH3V1(): Promise<H3V1FetchResult> {
  const [{ createApp, toNodeListener, splitCookiesString }, { fetchNodeRequestHandler }] =
    await Promise.all([import('h3'), import('node-mock-http')]);
  const h3App = createApp();
  const nodeHandler = toNodeListener(h3App);
  const registry = new Set<string>();
  const _fetch = fetch;
  const h3Fetch = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    let url: string;
    let init = _init;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else {
      url = input.url;
      init = {
        method: init?.method ?? input.method,
        body: init?.body ?? input.body,
        headers: init?.headers ?? input.headers,
      };
    }
    const base = url.split('?')[0]!;
    if (registry.has(base) || registry.has(url)) url = '/_' + url;
    if (url.startsWith('/'))
      return normalizeFetchResponse(
        await fetchNodeRequestHandler(
          nodeHandler as unknown as Parameters<typeof fetchNodeRequestHandler>[0],
          url,
          init,
        ),
        splitCookiesString,
      );
    return _fetch(input, _init);
  };
  return {
    h3App,
    registry,
    fetch: h3Fetch,
  };
}

function normalizeFetchResponse(
  response: Response,
  splitCookiesString: (cookiesString: string | string[]) => string[],
): Response {
  if (!response.headers.has('set-cookie')) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers, splitCookiesString),
  });
}

function normalizeCookieHeaders(
  headers: Headers,
  splitCookiesString: (cookiesString: string | string[]) => string[],
): Headers {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === 'set-cookie') {
      for (const cookie of splitCookiesString(joinHeaders(header)))
        outgoingHeaders.append('set-cookie', cookie);
    } else outgoingHeaders.set(name, joinHeaders(header));
  }
  return outgoingHeaders;
}

function joinHeaders(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}
