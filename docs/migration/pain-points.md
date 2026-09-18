---
title: Pain points covered
description: How untestutils addresses common @nuxt/test-utils, Vitest, and Playwright issues.
outline: deep
---

# Pain points covered

Tracking map against community issues. Status: **addressed** · **document** · **later**.

| Pain | Upstream | Status | How untestutils helps |
|------|----------|--------|------------------------|
| Slow setup every rerun | nuxt/test-utils#314 | addressed | Recipe prepare cache + TargetRegistry |
| Opt-in Nuxt reuse | nuxt/test-utils#1750 | addressed | share policy + prewarm |
| Shared server in CI | nuxt/test-utils#925 | addressed | prewarm + global teardown |
| Vitest workspaces / cwd | nuxt/test-utils#664, vitest#5277 | document | absolute `recipesModule` + `resolveArtifactsRoot` |
| Playwright fixture timeout | nuxt/test-utils#861 | addressed | HTTP readiness gates |
| Hydration wait Firefox | nuxt/test-utils#1671 | later | browser matrix |
| Cookies context | nuxt/test-utils#325 | document | use Playwright context APIs |
| Nitro azure preset | nuxt/test-utils#908 | later | deploy presets |
| console.log clobbered | nuxt/test-utils#350 | addressed | default passthrough logs |
| Server unit environment | nuxt/test-utils#531 | later | v0.2+ |
| mockNuxtImport | nuxt/test-utils#541 | later | v0.2 |
| setupFiles ordering | nuxt/test-utils#577 | document | injected setup file list |
| Orphan processes on timeout | vitest#3077 | addressed | process tree kill with pid guards |
| Multiple web servers | playwright#8206 | addressed | multi recipe ids |

Update this table when closing items. For migration steps see [From @nuxt/test-utils](/migration/from-nuxt-test-utils).

## Next

- [Extending](/guide/extending)
- [Sharing & cache](/guide/sharing-and-cache)
- [Troubleshooting](/guide/troubleshooting)
