---
title: AI API
description: Codegen helpers.
outline: deep
---

# AI API

```ts
import {
  aiTest,
  convertTestFile,
  fixBrokenTests,
  coverMissingTests,
  createAgentToolkit,
} from 'untestutils/ai'
```

| Export | Role |
|--------|------|
| `aiTest` / `aiTestFromFile` | Generate spec |
| `convertTestFile` | Migrate file |
| `fixBrokenTests` | Repair failing test |
| `coverMissingTests` | Author missing e2e |
| `createAgentToolkit` / `createFsTools` / `createBrowserTools` | Shared tools |

Env: `UNTESTUTILS_AI`, `UNTESTUTILS_AI_MOCK`, `UNTESTUTILS_AI_PROVIDER`, `UNTESTUTILS_AI_MODEL`.

See [AI guide](/guide/ai) · [CLI](/cli/).
