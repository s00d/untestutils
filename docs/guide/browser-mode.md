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

## Nuxt unit in Browser Mode

When `test.browser.enabled` is on and `environment: 'untestutils'`, setup uses `runtime/browser-entry` (not the Node DOM `entry`):

1. Sets `__NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__` so the Node entry skips
2. Calls `setupWindow` only if the env is not already prepared
3. Registers the same worker-aware boot path as Node (`registerNuxtSetupEntry` / `appIsolation`)

This matches the [nuxt/test-utils#1821](https://github.com/nuxt/test-utils/pull/1821) browser-entry shape, with untestutils’ opt-in `appIsolation: 'worker'` (see [Vitest — appIsolation](/guide/vitest#appisolation-worker-opt-in)) instead of always-memoize.

Default CI does **not** run a real `@vitest/browser` job — Browser Mode stays **Experimental** in the [Support matrix](/guide/support-matrix) until that job exists. Enable Browser Mode in a dedicated project when you need real Chromium; Nuxt helpers remain mock-friendly without it.

## 1.0 stance

- Classic **Node + Playwright** against a leased URL remains the primary e2e path.
- A dedicated Browser Mode package/helpers may appear **after** 1.0 if dogfood appears — it will not replace recipes.
- Do not mix Browser Mode config with the e2e `untestutils()` plugin in one project.

See [Support matrix](/guide/support-matrix) · [Roadmap](/roadmap).
