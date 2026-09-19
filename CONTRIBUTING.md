# Contributing

## Develop

```bash
pnpm install
pnpm run build          # emit-only: all packages/** via obuild+tsc (CLI is src+tsx, no emit)
pnpm run test:unit
pnpm run test:playground
```

Published packages are **scoped** `@untestutils/*` plus the thin facade `untestutils`. Libraries ship `dist/*.mjs` + `.d.ts` (no bundling). Versions are **lockstep** with the root `package.json`.

## Docs

Site: `docs/` (`pnpm run docs:dev` / `docs:build`). Keep pages short; why/speed only in `docs/why.md`; release path in `docs/roadmap.md`.

Demo page (`docs/guide/demo.md`) shows measured shared vs naive Nuxt browser e2e (`examples/mass-nuxt`). After changing that example, refresh artifacts:

```bash
pnpm run demo:capture   # runs shared + naive, writes docs/public/demo/* — not part of preflight
```

## Release

Canonical version: root `package.json`. `tsx scripts/release.ts` runs `bumpp -r`, syncs nested facade env shims + exact scoped peers, regenerates `CHANGELOG.md` via changelogen, then `pnpm -r publish` (pnpm rewrites `workspace:*` on pack). Tag format: `vX.Y.Z`. Always create a GitHub Release for the tag.

```bash
pnpm release:patch          # build, bumpp, changelog, commit, tag, publish, push, gh release
pnpm release:patch -- --dry-run
pnpm release:patch -- --no-publish   # local commit + tag only
```

Requires clean tree on `master`/`main`, `npm login`, `gh auth login`.

Monorepo-only tooling lives under `scripts/` (`pack-test`, `preflight`, `api-surface`) — not in the published CLI.

## PR checklist

- [ ] Tests green locally for touched area
- [ ] Docs updated if public API/behavior changed
- [ ] No secrets in commits
