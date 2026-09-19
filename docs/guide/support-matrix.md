---
title: Support matrix
description: Stable vs experimental vs optional — what CI dogfoods and what stays labeled.
outline: deep
---

# Support matrix

Current line: **0.6.x**. **1.0** means this table matches CI and docs with no silent gaps.

| Area | Status | CI |
|------|--------|-----|
| Vitest e2e plugin + fixtures | **Stable** | Yes (`test:playground`) |
| Playwright `createPlaywrightConfig` | **Stable** | Yes (`test:playwright`) |
| Drivers: `staticDir`, `command`, `nodeEntry`, `host` | **Stable** | Yes (unit + playground) |
| Nuxt recipes `nuxt({ run })` | **Stable** | Unit + driver tests |
| Vite / Next / Astro / SvelteKit / Remix / SolidStart adapters | **Stable** | Yes (playground e2e) |
| Framework `matrix()` / `defineDriver` / `workspaceDeps` | **Stable** | Yes (unit) |
| Typed config overrides (`viteConfig` / `nextConfig` / `kitConfig` / …) | **Stable** | Yes (unit + playground override smoke) |
| Nuxt unit (`environment: 'untestutils'`) | **Stable** | Yes (`test:playground:unit`); install `@untestutils/nuxt` + `vitest-environment-untestutils` |
| CLI scaffolding (`init` / `doctor`) | **Stable** | Yes (`test:cli-dogfood`) |
| AI codegen (`@untestutils/ai`) | **Optional peer** | Mock only (`test:ai`) — no live LLM |
| Perf suite (`@untestutils/perf`) | **Optional peer** | Unit + optional `workflow_dispatch` dogfood |
| Vitest Browser Mode helpers | **Not in 1.0** | Separate track — see [Browser Mode](/guide/browser-mode) |
| Astral / Thirtyfour / Chromiumoxide | **Out of scope for 1.0** | Perf spike — see [Explore](/guide/explore-browsers) |
| Node | `engines >=20`; CI primary **22** + smoke **20** | Yes |

See also [Roadmap](/roadmap) and [Drivers](/guide/drivers).
