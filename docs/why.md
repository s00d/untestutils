---
title: Why untestutils
description: Live targets vs stubs, shared prepare for CI speed, and how this differs from helpers or @nuxt/test-utils.
outline: deep
---

# Why untestutils

## The problem

Shipping software is not “a component in happy-dom”. It is a **built** app, a **running** process on a real URL, and side effects that only appear after prepare/start (i18n merges, cookies, sitemap, Nitro routes, …).

If the suite never walks that path, you test a parallel universe. Failures show up in staging instead.

Most “test utils” help you write *more* tests. untestutils changes *what* you test: the same prepare → start → URL path users hit — shared across Vitest and Playwright.

## Contract

```text
Recipe  →  prepare?  →  start  →  { url } and/or { dir }
Harness →  useHarness('id')  /  Playwright test.use({ harness })
```

You describe **how the real target comes up**. Specs assert against that live target.

## Speed (CI)

“Test like production” only works if prepare is not paid on every file.

| Approach | Cost |
| --- | --- |
| Rebuild / remock per file | Slow; CI scales with file count |
| **Shared prepare** (identity hash → `.untestutils/builds`) | Prepare once, many specs / workers reuse |

That is the main time win vs per-file setup (including typical `@nuxt/test-utils` e2e patterns). Cache `.untestutils/` in CI when inputs are stable; use `prewarm` so cold start is not on the first test alone.

This is **not** “faster than Vitest/Playwright” — those are runners. untestutils makes *live* e2e affordable.

## Vs usual helpers

| Usual | untestutils |
| --- | --- |
| Restart / remock the app per file | One prepare, many files |
| Framework APIs that hide the URL | Same recipe ids in Vitest **and** Playwright |
| Assert on stubs only | Assert on live `$fetch`, `page`, SEO, cookies, redirects |
| Hand-rolled `globalSetup` / `webServer` | Drivers (`nuxt`, `staticDir`, `command`, `host`, …) |

Utils (`untestutils/utils`) help with **real-runtime** checks — they are not a second testing philosophy.

## Vs `@nuxt/test-utils`

Clean break, not a drop-in. Keep Vitest/Playwright skills; change how apps are prepared and shared. See [Migrate from @nuxt/test-utils](/migration/from-nuxt-test-utils).

## Next

- [Getting started](/guide/getting-started)
- [How it works](/guide/how-it-works)
- [Roadmap](/roadmap) — path to 1.0
