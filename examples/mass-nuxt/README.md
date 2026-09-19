# Mass Nuxt demo (shared vs naive)

**150 Playwright browser scenarios** across **10 files** (goto + Nuxt hydration + clicks/cookies).

Two measured modes:

| Script | Meaning |
| --- | --- |
| `pnpm test:shared` | One Nuxt recipe, prepare once |
| `pnpm test:naive` | One Nuxt recipe **id per file** — ordinary per-file boot |

```bash
# from monorepo root
pnpm install
cd examples/mass-nuxt
pnpm generate:e2e
pnpm test:shared
pnpm test:naive    # slow — for the docs comparison
```

Docs: [Demo](https://s00d.github.io/untestutils/guide/demo). Refresh timings:

```bash
pnpm run demo:capture   # from monorepo root — runs both, measured
```
