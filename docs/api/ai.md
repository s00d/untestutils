---
title: AI API
description: Generate, convert, fix, cover, and shared agent toolkit helpers.
outline: deep
---

# AI API

```ts
import {
  aiTest,
  aiTestFromFile,
  convertTestFile,
  fixBrokenTests,
  coverMissingTests,
  createAgentToolkit,
  createBrowserTools,
  createFsTools,
  buildFileTree,
  fingerprint,
  loadSystemPrompt,
  loadConvertPrompt,
  loadFixPrompt,
  loadCoverPrompt,
  AI_PROMPT_VERSION,
  CONVERT_PROMPT_VERSION,
} from 'untestutils/ai'
```

## aiTest(options)

| Field | Description |
|-------|-------------|
| `id` | Cache / artifact id |
| `prompt` | User scenario |
| `root` | Project root for tools |
| `recipes?` | Hint recipe ids |
| `focus?` | File path hints |
| `baseURL?` / `browser?` | Enable Playwright page tools |
| `maxFilesRead?` / `maxBytesTotal?` / `maxExploreSteps?` | Tool limits |

Returns `{ code, genPath, fingerprint, readPaths }`.

## aiTestFromFile(path, defaults?)

Parses optional YAML frontmatter (`id`, `root`, `recipes`, `focus`) then calls `aiTest`.

## convertTestFile(options)

| Field | Description |
|-------|-------------|
| `path` | Existing test file |
| `root` | Project root |

Rewrites toward untestutils APIs using the convert system prompt.

## fixBrokenTests(options)

Repair a failing test from its source + failure log (same toolkit as CLI `fix`).

| Field | Description |
|-------|-------------|
| `path` | Failing test file |
| `root` | Project root |
| `failureLog` | Vitest / Playwright output |
| `recipes?` | Recipe ids |
| `baseURL?` / `browser?` | Live page tools |
| `write?` | Overwrite `path` |

## coverMissingTests(options)

Author missing high-value e2e tests (same toolkit as CLI `cover`).

| Field | Description |
|-------|-------------|
| `root` | Project root |
| `recipes?` / `focus?` | Hints |
| `outDir?` | Where to write (default `tests/e2e`) |
| `baseURL?` / `browser?` | Live page tools |
| `write?` | Write files into the project |

Returns `{ files, fingerprint, readPaths, genDir }`.

## createAgentToolkit(options)

Shared fs (+ optional browser) tools used by all AI workflows.

```ts
const toolkit = createAgentToolkit({
  root: process.cwd(),
  browser: { baseURL: 'http://127.0.0.1:3000' },
})
// toolkit.tools → list_dir, read_file, grep, browser_*
await toolkit.dispose?.()
```

Lower-level: `createFsTools(root, limits)`, `createBrowserTools({ baseURL })`.

## Env

See [AI guide](/guide/ai).

## Next

- [AI guide](/guide/ai)
- [CLI](/cli/)
