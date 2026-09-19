---
title: Utils
description: Cookies, SEO head, poll, domain emulation, redirects — for live targets.
outline: deep
---

# Utils

`untestutils/utils` — helpers for **real-runtime** checks (optional peer: `playwright-core`).

```ts
import {
  setLocaleCookie,
  parseSeoHead,
  emulateDomain,
  trackResponses,
  pollUntil,
  acceptLanguageHeaders,
} from 'untestutils/utils'
```

## Cookies / headers

```ts
await setLocaleCookie(page, baseURL!, 'de')
await clearCookies(page)
await page.setExtraHTTPHeaders(acceptLanguageHeaders('de-DE,de;q=0.9'))
await setAcceptLanguage(page, 'de')
```

## SEO

```ts
const head = parseSeoHead(await (await request.get('/en')).text())
// head.canonical, head.ogUrl, head.hreflangs
await readSeoHead(page)
extractSitemapLocs(xml)
extractJsonLd(html)
```

## Browser / redirects

```ts
await emulateDomain(page, 'https://en.example.com', baseURL!)
const { findByPath, stop } = trackResponses(page)
await goto('/')
expect(findByPath('/')?.status).toBe(302)
stop()
```

## Poll

```ts
await pollUntil(async () => (await fetch(url)).ok)
await waitForUrlOk(url)
```

## Next

- [Vitest](/guide/vitest)
- [Why](/why) — utils are not a second philosophy
