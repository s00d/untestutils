---
title: AI codegen
description: Optional AI workflows — generate, convert, fix, cover.
outline: deep
---

# AI codegen

::: tip
**Optional** — not part of the 1.0 stability bar. Mock works in CI; live LLM is best-effort. See [Roadmap](/roadmap).
:::

Optional. Package: `untestutils/ai`. CLI shares one toolkit (fs + optional browser tools).

| CLI / API | Role |
|-----------|------|
| `untestutils ai` / `aiTest` | Spec from a prompt |
| `untestutils convert` / `convertTestFile` | Migrate an existing file |
| `untestutils fix` / `fixBrokenTests` | Repair failing test (+ log / browser) |
| `untestutils cover` / `coverMissingTests` | Author missing e2e |

```bash
UNTESTUTILS_AI=1 untestutils fix tests/e2e/home.test.ts \
  --run "pnpm exec vitest run tests/e2e/home.test.ts" \
  --base-url http://127.0.0.1:3000
```

| Env | Meaning |
|-----|---------|
| `UNTESTUTILS_AI=1` | Allow live LLM on cache miss |
| `UNTESTUTILS_AI_MOCK=1` | Mock for CI |
| `UNTESTUTILS_AI_PROVIDER` | `openai` \| `anthropic` \| `google` \| `xai` |
| `UNTESTUTILS_AI_MODEL` | Model id |

See [API: AI](/api/ai) · [CLI](/cli/).
