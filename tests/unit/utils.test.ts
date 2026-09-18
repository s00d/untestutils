import { describe, expect, test } from 'vitest';
import {
  acceptLanguageHeaders,
  extractJsonLd,
  extractSitemapLocs,
  forwardedHostHeaders,
  parseSeoHead,
  pollUntil,
  runSequential,
} from '../../packages/utils/src/index';

describe('utils/poll', () => {
  test('pollUntil resolves when check passes', async () => {
    let n = 0;
    await pollUntil(async () => ++n >= 2, { intervalMs: 1, timeoutMs: 1000 });
    expect(n).toBe(2);
  });

  test('pollUntil times out', async () => {
    await expect(pollUntil(async () => false, { intervalMs: 1, timeoutMs: 30 })).rejects.toThrow(
      /Timed out/,
    );
  });

  test('runSequential preserves order', async () => {
    const out: number[] = [];
    await runSequential([1, 2, 3], async (n) => {
      out.push(n);
    });
    expect(out).toEqual([1, 2, 3]);
  });
});

describe('utils/headers', () => {
  test('acceptLanguage + forwardedHost', () => {
    expect(acceptLanguageHeaders('de')).toEqual({ 'Accept-Language': 'de' });
    expect(forwardedHostHeaders('ex.com', 'https:')).toEqual({
      'x-forwarded-host': 'ex.com',
      'x-forwarded-proto': 'https',
    });
  });
});

describe('utils/seo', () => {
  test('parseSeoHead extracts tags', () => {
    const html = `
      <link rel="canonical" href="https://a/en">
      <meta property="og:url" content="https://a/en">
      <meta property="og:locale" content="en_US">
      <link rel="alternate" hreflang="de" href="https://a/de">
    `;
    const head = parseSeoHead(html);
    expect(head.canonical).toBe('https://a/en');
    expect(head.ogUrl).toBe('https://a/en');
    expect(head.ogLocale).toBe('en_US');
    expect(head.hreflangs).toEqual([{ hreflang: 'de', href: 'https://a/de' }]);
  });

  test('sitemap + jsonld', () => {
    expect(extractSitemapLocs('<urlset><url><loc>https://x/</loc></url></urlset>')).toEqual([
      'https://x/',
    ]);
    expect(extractJsonLd('<script type="application/ld+json">{"@type":"WebSite"}</script>')).toEqual([
      { '@type': 'WebSite' },
    ]);
  });
});
