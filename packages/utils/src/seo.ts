export type SeoAlternate = { hreflang: string; href: string };

export type SeoHead = {
  canonical: string | null;
  ogUrl: string | null;
  ogLocale: string | null;
  hreflangs: SeoAlternate[];
};

function attr(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}="([^"]*)"`, 'i'))?.[1] ?? null;
}

/** Parse common SEO tags from an HTML document string (SSR `$fetch` / `request.get().text()`). */
export function parseSeoHead(html: string): SeoHead {
  const canonical =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)?.[0] != null
      ? attr(html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)![0]!, 'href')
      : null;

  let ogUrl: string | null = null;
  let ogLocale: string | null = null;
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]!;
    const prop = attr(tag, 'property') ?? attr(tag, 'name');
    if (prop === 'og:url') ogUrl = attr(tag, 'content');
    if (prop === 'og:locale') ogLocale = attr(tag, 'content');
  }

  const hreflangs: SeoAlternate[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]!;
    if (!/\brel=["']alternate["']/i.test(tag)) continue;
    const hreflang = attr(tag, 'hreflang');
    const href = attr(tag, 'href');
    if (hreflang && href) hreflangs.push({ hreflang, href });
  }

  return { canonical, ogUrl, ogLocale, hreflangs };
}

/** `<loc>` values from a sitemap XML body. */
export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

/** JSON-LD objects from `<script type="application/ld+json">` blocks. */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      out.push(JSON.parse(m[1]!));
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

export type PageLike = {
  locator: (selector: string) => {
    getAttribute: (name: string) => Promise<string | null>;
    count: () => Promise<number>;
    nth: (i: number) => { getAttribute: (name: string) => Promise<string | null> };
  };
};

/** Read SEO tags from a live Playwright page (after goto). */
export async function readSeoHead(page: PageLike): Promise<SeoHead> {
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
  const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');

  const alt = page.locator('link[rel="alternate"][hreflang]');
  const n = await alt.count();
  const hreflangs: SeoAlternate[] = [];
  for (let i = 0; i < n; i++) {
    const el = alt.nth(i);
    const hreflang = await el.getAttribute('hreflang');
    const href = await el.getAttribute('href');
    if (hreflang && href) hreflangs.push({ hreflang, href });
  }

  return { canonical, ogUrl, ogLocale, hreflangs };
}
