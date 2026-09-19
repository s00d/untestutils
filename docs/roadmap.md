---
title: Roadmap
description: Path from 0.6 to a honest 1.0 — what is stable, what is missing, what stays optional.
outline: deep
---

# Roadmap

Current line: **0.6.x** (pre-1.0). Theme: **honest consumer path** — init → install → e2e, overrides in CI, peers match docs. **1.0** means a clear [support matrix](/guide/support-matrix) and no silent gaps between docs and CI.

## Stable now (0.6)

- Recipe contract: prepare → start → URL/dir, shared identity cache under `.untestutils`
- Vitest plugin + Playwright `createPlaywrightConfig`, same `recipes.ts`
- Drivers: `staticDir`, `command`, `nodeEntry`, `host`, `nuxt({ run })`
- Framework dogfood in CI: Vite, Next, Astro, SvelteKit, Remix, SolidStart (+ static)
- Typed config overrides in CI (`viteConfig` / `nextConfig` / `kitConfig` / …)
- Nuxt unit (`environment: 'untestutils'`) in playground CI (`test:playground:unit`)
- CLI `init` / `doctor` / `doctor --recipes` + temp-dir dogfood (`test:cli-dogfood`)
- Node **22** primary CI + **Node 20** smoke (`test:unit` + `test:pack`)
- Utils for live checks (cookies, SEO, redirects, poll)
- Scoped emit-only publish: `@untestutils/*` + thin `untestutils` facade; lockstep semver
- Docs site (this)

Use the **same version** for facade and any `@untestutils/*` adapter you install.

### Migration note (0.6)

`@untestutils/nuxt` and `vitest-environment-untestutils` are **optional peers** (no longer hard deps of the facade). Nuxt users:

```bash
pnpm add -D untestutils @untestutils/nuxt vitest-environment-untestutils nuxt
```

## Before 1.0

Ordered by impact. Full table: [Support matrix](/guide/support-matrix).

### 1. Support matrix (docs + CI)

Keep **stable** vs **experimental** vs **optional** honest as features land.

| Area | Today | 1.0 bar |
|------|--------|---------|
| Vitest / Playwright e2e | Stable, in CI | Keep |
| Nuxt server recipes | Stable, unit/driver covered | Keep |
| Vite / Next / Astro / SvelteKit / Remix / SolidStart | Dogfood in playground CI | Keep |
| Nuxt unit | Documented + `test:playground:unit` in CI | Keep |
| CLI scaffolding | Dogfood in CI | Keep |
| AI codegen | Optional, mock in CI | Stay optional (labeled) |
| Perf suite | Unit + optional `workflow_dispatch` dogfood | Stay optional (labeled) |

### 2. Package hygiene

- Clearer peer signal for Vitest as primary consumer (doctor checks majors 4\|5)
- Slimmer facade (optional peers for nuxt / ai / perf) — done in 0.6

### 3. Typecheck surface

Root `typecheck` should cover facade-critical packages (`nuxt` unit subpaths as needed) so published `.d.ts` do not drift.

### 4. Semver promise

Ship **1.0.0** with the matrix above, changelog that states stable vs optional, and no “documented as supported but untested in CI” drivers.

## After 1.0

- WebKit in Playwright CI (optional job)
- Richer framework fixtures as demand appears
- Live-LLM AI smoke (mock stays CI default)
- Vitest Browser Mode as a separate optional track (not recipe-e2e)

## Explore (pre-release — decided)

Spike: **faster** browser backends for mass recipe e2e. Out of scope for 1.0 — details: [Explore — alternate browsers](/guide/explore-browsers).

| Project | Verdict |
|---------|---------|
| Astral | Skip for 1.0 — Deno-only; no Node/Vitest path |
| Thirtyfour | Skip for 1.0 — WebDriver + Node bridge; unclear perf win |
| Chromiumoxide | Skip for 1.0 — Rust CDP is the interesting perf bet; deferred for integration cost (not “Playwright already does CDP”) |

Vitest Browser Mode is a **separate** optional track — not recipe-e2e. See [Browser Mode](/guide/browser-mode).

`@nuxt/test-utils` extras (`$fetchComponent`, full browser render API) stay deferred until real dogfood — not 1.0 goals.

## Not goals for 1.0

- Replacing Vitest or Playwright
- Drop-in compatibility with `@nuxt/test-utils`
- Shipping a second browser stack before Chromiumoxide proves a win

## Next

- [Support matrix](/guide/support-matrix)
- [Getting started](/guide/getting-started)
