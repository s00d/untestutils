---
title: Support matrix
description: Stable vs experimental vs optional — what CI dogfoods and what stays labeled.
outline: deep
---

# Support matrix

Current line: **0.5.x**. **1.0** means this table matches CI and docs with no silent gaps.

| Area | Status | CI |
|------|--------|-----|
| Vitest e2e plugin + fixtures | **Stable** | Yes (`test:playground`) |
| Playwright `createPlaywrightConfig` | **Stable** | Yes (`test:playwright`) |
| Drivers: `staticDir`, `command`, `nodeEntry`, `host` | **Stable** | Yes (unit + playground) |
| Nuxt recipes `nuxt({ run })` | **Stable** | Unit + driver tests |
| Vite / Next / Astro / SvelteKit / Remix / SolidStart adapters | **Stable** | Yes (playground e2e) |
| Framework `matrix()` / `defineDriver` / `workspaceDeps` | **Stable** | Yes (unit) |
| Typed config overrides (`viteConfig` / `nextConfig` / …) | **Stable** | Yes (unit) |
| Nuxt unit (`environment: 'untestutils'`) | **Stable** | Yes (`test:playground:unit`) |
| AI codegen (`@untestutils/ai`) | **Optional peer** | Mock only |
| Perf suite (`@untestutils/perf`) | **Optional peer** | Unit only |
| Vitest Browser Mode helpers | **Not in 1.0** | Separate track — see [Browser Mode](/guide/browser-mode) |
| Astral / Thirtyfour / Chromiumoxide | **Out of scope for 1.0** | Perf spike — see [Explore](/guide/explore-browsers) |
| CLI scaffolding | **Stable** | Pack / surface checks |
| Node | `engines >=20`; CI on **22** | Yes |

See also [Roadmap](/roadmap) and [Drivers](/guide/drivers).
