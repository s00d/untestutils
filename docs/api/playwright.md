---
title: Playwright API
description: createPlaywrightConfig and fixtures.
outline: deep
---

# Playwright API

```ts
import { createPlaywrightConfig, test, expect } from 'untestutils/playwright'
```

## createPlaywrightConfig

| Option | Description |
|--------|-------------|
| `recipes` / `recipesModule` | Recipe map / path |
| `prewarm` | Ids to prepare |
| `session` / `artifactsRoot` | Artifact namespace |
| `browsers` | Auto `projects` if `projects` omitted |
| `workers` / `fullyParallel` | Playwright pool |
| `…` | Other Playwright config fields |

Fixtures: `harness`, `baseURL`, `page`, … via `test` from this entry.

See [Playwright guide](/guide/playwright) · [Drivers](/guide/drivers) (`host`).
