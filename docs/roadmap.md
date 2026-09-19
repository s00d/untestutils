---
title: Roadmap
description: Path from 0.4 to a honest 1.0 — what is stable, what is missing, what stays optional.
outline: deep
---

# Roadmap

Current line: **0.4.x** (pre-1.0). The core harness works in production dogfood (e.g. large Nuxt e2e suites). **1.0** means a clear support matrix and no silent gaps between docs and CI.

## Stable now (0.4)

- Recipe contract: prepare → start → URL/dir, shared identity cache under `.untestutils`
- Vitest plugin + Playwright `createPlaywrightConfig`, same `recipes.ts`
- Drivers: `staticDir`, `command`, `nodeEntry`, `host`, `nuxt({ run })`
- Framework dogfood in CI: Vite, Next, Astro, SvelteKit (+ static)
- Utils for live checks (cookies, SEO, redirects, poll)
- Docs site (this)

## Packaging (toward 0.5)

- **Scoped emit-only publish**: `@untestutils/*` + thin `untestutils` facade (no Vite bundle)
- **Lockstep versions**: root + every package share one semver; scoped peers are exact (no `*`)
- **Nuxt unit** lives under `@untestutils/nuxt` (`./runtime`, `./config`, `./module`, `./environment`); drivers live in `@untestutils/core`
- Framework adapters stay separate (`@untestutils/vite`, `next`, …) — install only what you need
- Release: `bumpp -r` + changelogen + `pnpm -r publish` (`tsx scripts/release.ts`)

Use the **same version** for facade and any `@untestutils/*` adapter you install.

## Before 1.0

Ordered by impact.

### 1. Support matrix (docs + CI)

Explicit **stable** vs **experimental** vs **not in CI**.

| Area | Today | 1.0 bar |
|------|--------|---------|
| Vitest / Playwright e2e | Stable, in CI | Keep |
| Nuxt server recipes | Stable, dogfood’d | Keep |
| Vite / Next / Astro / SvelteKit | Dogfood in playground CI | Keep |
| Remix / SolidStart | Exports exist; fixtures thin; not in playground e2e | Full fixtures + e2e **or** mark experimental / demote |
| Nuxt unit (`environment: 'untestutils'`) | Documented; `test:playground:unit` not in CI | Wire into CI **or** label experimental |
| AI codegen | Optional, mock in CI | Stay optional (labeled) |
| Perf suite | Unit coverage; no CI dogfood | Stay optional (labeled) |

### 2. Package hygiene

- Node floor: smoke Node 20 or raise `engines` to match CI (22)
- Clearer peer signal for Vitest as primary consumer

### 3. Typecheck surface

Root `typecheck` should cover facade-critical packages (`nuxt` unit subpaths as needed) so published `.d.ts` do not drift.

### 4. Semver promise

Ship **1.0.0** with the matrix above, changelog that states stable vs optional, and no “documented as supported but untested in CI” drivers.

## After 1.0

- WebKit in Playwright CI (optional job)
- Richer framework fixtures as demand appears
- Live-LLM AI smoke (mock stays CI default)
- Perf dogfood job when thresholds have an owner

## Explore (pre-release — maybe skip)

Not committed work. Before a major cut, **spike once** whether any of these belong as optional adapters / drivers. Likely outcome: document “out of scope” and move on.

| Project | Stars (approx.) | Notes |
|---------|-----------------|--------|
| [Astral](https://github.com/lino-levan/astral) | Deno ~354⭐ | High-level browser automation for Deno |
| [Thirtyfour](https://github.com/stevepryde/thirtyfour) | Rust ~1.4k⭐ | Selenium WebDriver client |
| [Chromiumoxide](https://github.com/mattsse/chromiumoxide) | Rust ~1.4k⭐ | CDP / Chromium control |

Check fit vs Playwright (primary), maintenance cost, and whether a thin recipe `start`/`URL` bridge is enough. **Do not** block 1.0 on shipping them.

## Not goals for 1.0

- Replacing Vitest or Playwright
- Drop-in compatibility with `@nuxt/test-utils`
- Guaranteed AI output quality
- Fake “X ms faster” numbers — speed = [shared prepare](/why)

## Next

- [Why](/why)
- [Getting started](/guide/getting-started)
- [CONTRIBUTING](https://github.com/s00d/untestutils/blob/master/CONTRIBUTING.md)
