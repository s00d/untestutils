---
title: Support matrix
description: Stable vs experimental — every claimed mode/surface must have CI dogfood.
outline: deep
---

# Support matrix

Current line: **0.7.x**. Status is **Stable** only when recipe + playground spec + CI script exist. No silent Stable.

## E2e run modes

| Adapter | Run | Status | CI | Fixture / recipe |
|---------|-----|--------|-----|------------------|
| staticDir | (serve) | **Stable** | `test:playground` | `staticSite` |
| Vite | preview | **Stable** | `test:playground` | `viteSpa` |
| Vite | dev | **Stable** | `test:playground` | `viteSpaDev` |
| Next | static | **Stable** | `test:playground` | `nextStatic` (`fixtures/next-app`) |
| Next | server | **Stable** | `test:playground` | `nextServer` (`fixtures/next-server`) |
| Next | dev | **Stable** | `test:playground` | `nextDev` (`fixtures/next-dev`) |
| Astro | preview | **Stable** | `test:playground` | `astroSite` |
| Astro | server | **Stable** | `test:playground` | `astroServer` (`fixtures/astro-ssr`) |
| Astro | dev | **Stable** | `test:playground` | `astroDev` |
| SvelteKit | preview | **Stable** | `test:playground` | `sveltekitApp` |
| SvelteKit | server | **Stable** | `test:playground` | `sveltekitServer` (`fixtures/sveltekit-node`) |
| SvelteKit | dev | **Stable** | `test:playground` | `sveltekitDev` |
| Remix | server | **Stable** | `test:playground` | `remixApp` |
| Remix | dev | **Stable** | `test:playground` | `remixDev` |
| SolidStart | preview | **Stable** | `test:playground` | `solidApp` |
| SolidStart | server | **Experimental** | — | Concurrent vinxi / SSR entry fragile; use preview |
| SolidStart | dev | **Stable** | `test:playground` | `solidDev` |
| Nuxt | server | **Stable** | `test:playground` | `nuxtServer` (`fixtures/unit-app`) |
| Nuxt | static | **Stable** | `test:playground` | `nuxtStatic` |
| Nuxt | dev | **Stable** | `test:playground` | `nuxtDev` |
| host / command / nodeEntry | — | **Stable** | unit + playground | — |

Matrix assert: `pnpm test:e2e-matrix` (`assert-e2e-mode-matrix.mjs` ↔ `E2E_MODE_MARKERS`).

## Unit env

| Adapter | Status | CI | Notes |
|---------|--------|-----|-------|
| Nuxt | **Stable** | `test:playground:unit` (`test:unit-nuxt`, worker asserts) | Full VTU / `#imports`; `resetSharedApp` / `restartSharedApp` aliases |
| Vite | **Stable** | `test:unit-vite` | Client DOM + soft reset / boot counts |
| Next | **Stable** | `test:unit-next` | Client DOM only — no RSC/SSR |
| Astro | **Stable** | `test:unit-astro` | Island/container marker — no full content SSR |
| SvelteKit | **Stable** | `test:unit-sveltekit` | No load/actions SSR |
| Remix | **Stable** | `test:unit-remix` | Client DOM — no loader/SSR |
| SolidStart | **Stable** | `test:unit-solidstart` | DOM marker — no Vinxi SSR |

Router: `environment: 'untestutils'` + `environmentOptions.untestutils.framework` (or exactly one top-level `environmentOptions.<fw>` key; ambiguous → throw; default Nuxt). Shared DOM: `@untestutils/vitest/unit-dom`. Marker factory: `@untestutils/vitest/unit-marker`. Lifecycle: `@untestutils/vitest/unit-lifecycle`.

Warm cache: adapters that serve fixture builds expose `verifyArtifact` (see [Troubleshooting — Warm cache](/guide/troubleshooting#warm-cache--stale-artifacts)).

## Teardown / process handles

| Area | Status | CI |
|------|--------|-----|
| `spawnManaged` / `ManagedProcess` | **Stable** | `tests/unit/process-managed.test.ts` |
| Orchestrator reclaim / orphan registry | **Stable** | `orchestrator-teardown` + `test:e2e-teardown` |

## Other surfaces

| Area | Status | CI |
|------|--------|-----|
| Vitest e2e plugin + fixtures | **Stable** | `test:playground` |
| Playwright `createPlaywrightConfig` | **Stable** | `test:playwright` |
| `matrix()` / `defineDriver` / `workspaceDeps` | **Stable** | unit |
| Typed config overrides | **Stable** | unit + playground override specs |
| CLI scaffolding | **Stable** | `test:cli-dogfood` |
| AI codegen (`@untestutils/ai`) | **Optional peer** | `test:ai` (mock) |
| Perf (`@untestutils/perf`) | **Optional peer** | unit + optional workflow |
| Vitest Browser Mode (real `@vitest/browser` job) | **Experimental** | Mocks only until dedicated job — see [Browser Mode](/guide/browser-mode) |
| Astral / Thirtyfour | **Out of scope** | — |
| Node | `engines >=20`; CI **22** + smoke **20** | Yes |

See [Roadmap](/roadmap) · [Drivers](/guide/drivers) · [Vitest](/guide/vitest).
