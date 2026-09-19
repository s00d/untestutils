---
title: Vitest Browser Mode
description: Why recipe e2e stays on Node + Playwright — Browser Mode is a separate optional track.
outline: deep
---

# Vitest Browser Mode

**Not part of recipe e2e.** Vitest [Browser Mode](https://vitest.dev/guide/browser/) runs component tests inside a real browser via Vite. That is a different product surface from untestutils recipes (`prepare` → `start` → live URL).

| Track | Runner | Target |
|-------|--------|--------|
| Recipe e2e (primary) | Vitest Node + Playwright / Playwright Test | Live URL from `leaseTarget` / harness |
| Nuxt unit | `environment: 'untestutils'` | In-process Vue/Nuxt |
| Browser Mode (optional, later) | Vitest browser provider | In-Vite UI components |

## 1.0 stance

- Classic **Node + Playwright** against a leased URL remains the primary e2e path.
- A dedicated Browser Mode package/helpers may appear **after** 1.0 if dogfood appears — it will not replace recipes.
- Do not mix Browser Mode config with the e2e `untestutils()` plugin in one project.

See [Support matrix](/guide/support-matrix) · [Roadmap](/roadmap).
