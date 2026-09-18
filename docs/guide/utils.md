---
title: Utils
description: Shared e2e helpers — cookies, SEO head, poll, domain emulation, redirects.
outline: deep
---

# Utils

Import from `untestutils/utils` (optional peer: `playwright-core` for browser helpers).

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

## Cookies

```ts
await setLocaleCookie(page, baseURL!, 'de') // clears then sets `user-locale`
await setLocaleCookie(page, baseURL!, 'en', { name: 'i18n_redirected', clear: false })
const locale = await getLocaleCookie(page)
await clearCookies(page)
```

## Headers

```ts
await page.setExtraHTTPHeaders(acceptLanguageHeaders('de-DE,de;q=0.9'))
await request.get('/', { headers: {
  ...acceptLanguageHeaders('fr'),
  ...forwardedHostHeaders('example.com', 'https'),
}})
```

Or `await setAcceptLanguage(page, 'de')`.

## SEO head

```ts
const html = await (await request.get('/en')).text()
const head = parseSeoHead(html)
// head.canonical, head.ogUrl, head.ogLocale, head.hreflangs

const live = await readSeoHead(page)
extractSitemapLocs(xml)
extractJsonLd(html)
```

## Browser

```ts
await emulateDomain(page, 'https://en.example.com', baseURL!)

const { responses, findByPath, stop } = trackResponses(page)
await goto('/')
expect(findByPath('/')?.status).toBe(302)
stop()

const { messages, stop: stopConsole } = collectHydrationIssues(page)
await goto('/')
expect(messages).toHaveLength(0)
stopConsole()
```

## Poll / HTTP

```ts
await pollUntil(async () => (await fetch(url)).ok)
await waitForUrlOk(url)
await waitForUrlIncludes(url, 'ready')
await runSequential(items, async (item) => { … })
```
