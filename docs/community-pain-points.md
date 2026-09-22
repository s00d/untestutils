---
title: Community pain points
description: Upstream issues that motivated untestutils, how we address them, and where we reply.
outline: deep
---

# Community pain points

Tracked while designing untestutils. Status: `addressed` (first-class in the harness), `documented` (clear docs / escape hatches), `out-of-scope` (unit-env / framework bugs we do not claim to replace).

Proof dogfood (external consumer): [nuxt-i18n-micro CI](https://github.com/s00d/nuxt-i18n-micro/actions/runs/35586385667/job/106290602444) — **265 e2e** tests in **~4 minutes** (`test:e2e` step), shared prepare via untestutils.

## @nuxt/test-utils — e2e speed / reuse

| Pain | Issue | Status | How untestutils handles it |
| --- | --- | --- | --- |
| Slow `setup` on every rerun | [#314](https://github.com/nuxt/test-utils/issues/314) | addressed | Shared prepare + content-hash cache + `prewarm` |
| Opt-in Nuxt app reuse across workers | [#1750](https://github.com/nuxt/test-utils/issues/1750) | addressed | Target registry + lock-by-identity; one prepare, many workers |
| Shared server faster in CI | [#925](https://github.com/nuxt/test-utils/issues/925) | addressed | First-class shared serve / recipe identity |
| Vitest workspaces | [#664](https://github.com/nuxt/test-utils/issues/664) | documented | Absolute recipe roots; e2e vs unit as separate Vitest projects |
| Playwright fixture timeout | [#861](https://github.com/nuxt/test-utils/issues/861) | documented | Readiness HTTP + sane hook timeouts |
| Firefox hydration `waitUntil` | [#1671](https://github.com/nuxt/test-utils/issues/1671) | out-of-scope | Browser-specific; Chromium dogfood first |
| Cookies in context | [#325](https://github.com/nuxt/test-utils/issues/325) | documented | Live target + Playwright context; utils for cookie asserts |
| Nitro Azure preset e2e | [#908](https://github.com/nuxt/test-utils/issues/908) | out-of-scope | v1: `node` / `static` / Nuxt server modes |
| `setup()` clobbers `console.log` | [#350](https://github.com/nuxt/test-utils/issues/350) | addressed | Child stdout passthrough by default; opt-in capture |
| `multiApp` breaks test-utils | [#1521](https://github.com/nuxt/test-utils/issues/1521) | addressed | Explicit recipe `root` / id per app |

## @nuxt/test-utils — unit / Nuxt environment

Mostly **out-of-scope** for the recipe e2e core. Optional `@untestutils/nuxt` + `vitest-environment-untestutils` cover a separate unit surface — not a drop-in for every mock/`mountSuspended` request.

| Pain | Issue | Status |
| --- | --- | --- |
| Server environment for unit | [#531](https://github.com/nuxt/test-utils/issues/531) | documented (partial; optional package) |
| Server-only `setup()` | [#921](https://github.com/nuxt/test-utils/issues/921) | out-of-scope |
| `useRuntimeConfig` without Nuxt instance | [#949](https://github.com/nuxt/test-utils/issues/949) | out-of-scope |
| `mockNuxtImport` expose mocks | [#541](https://github.com/nuxt/test-utils/issues/541) | out-of-scope |
| Mock already-loaded `#app/nuxt` | [#693](https://github.com/nuxt/test-utils/issues/693) | out-of-scope |
| `setupFiles` before Nuxt env | [#577](https://github.com/nuxt/test-utils/issues/577) | documented |
| Middleware in component tests | [#526](https://github.com/nuxt/test-utils/issues/526) | out-of-scope |
| msw + Nuxt env | [#1222](https://github.com/nuxt/test-utils/issues/1222) | documented |
| Browser mode + projects | [#1322](https://github.com/nuxt/test-utils/issues/1322), [#984](https://github.com/nuxt/test-utils/issues/984) | documented (e2e ≠ browser mode) |
| Vitest 4 environment stub | [#1482](https://github.com/nuxt/test-utils/issues/1482), [#1656](https://github.com/nuxt/test-utils/issues/1656), [#1452](https://github.com/nuxt/test-utils/issues/1452) | addressed (own env package) |
| Pinia / blank router path | [#523](https://github.com/nuxt/test-utils/issues/523), [#513](https://github.com/nuxt/test-utils/issues/513) | documented |

## Vitest platform

| Pain | Issue | Status | How untestutils handles it |
| --- | --- | --- | --- |
| Monorepo first-class | [#256](https://github.com/vitest-dev/vitest/issues/256) | documented | Recipe map + abs paths (workspaces exist; harness stays root-safe) |
| `cwd` = workspace root in subprojects | [#5277](https://github.com/vitest-dev/vitest/issues/5277) | addressed | Resolve recipe / fixture roots via absolute paths |
| Vite `root` ignored on workspace | [#6855](https://github.com/vitest-dev/vitest/issues/6855) | addressed | Same — never rely on process cwd alone |
| Timeout abort → orphan processes | [#3077](https://github.com/vitest-dev/vitest/issues/3077) | addressed | PID teardown + stale lock cleanup |
| Hangs / close timed out | [#2008](https://github.com/vitest-dev/vitest/issues/2008) | addressed | Teardown budgets + force-kill path |
| Forks runner timeout (v4) | [#8968](https://github.com/vitest-dev/vitest/issues/8968) | documented | Pool / isolate defaults for e2e |
| `isolate: false` mock bleed | [#11152](https://github.com/vitest-dev/vitest/issues/11152) | documented | Prefer isolate for e2e |
| Isolate + workspace quirks | [#6258](https://github.com/vitest-dev/vitest/issues/6258) | documented | Dogfood matrix |
| Sharding docs / CI | [#4269](https://github.com/vitest-dev/vitest/issues/4269) | documented | CI shard guidance |

## Playwright (adjacent)

| Pain | Issue | Status | How untestutils handles it |
| --- | --- | --- | --- |
| Multiple web servers | [#8206](https://github.com/microsoft/playwright/issues/8206) | addressed | Multi-recipe / multi-target registry |
| Locks vs concurrent tests | [#21484](https://github.com/microsoft/playwright/issues/21484) | addressed | File locks per build identity |
| Teardown vs test timeout | [#15019](https://github.com/microsoft/playwright/issues/15019) | addressed | Separate teardown budgets |
| Global beforeEach hooks | [#9468](https://github.com/microsoft/playwright/issues/9468) | documented | Vitest + Playwright fixtures over shared recipes |

## Links

- [Why untestutils](/why)
- [Migrate from @nuxt/test-utils](/migration/from-nuxt-test-utils)
- [Demo](/guide/demo)
- Docs site: https://s00d.github.io/untestutils/
- Repo: https://github.com/s00d/untestutils
