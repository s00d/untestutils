---
title: Release
description: How to bump versions, generate CHANGELOG.md, and publish untestutils to npm.
outline: deep
---

# Release

Canonical version lives in the **root** `package.json`. Every `packages/*/package.json` is kept in sync on release so workspace members never drift.

On npm only the facade **`untestutils`** is published (internals + `@untestutils/cli` stay private and are bundled into the facade).

## Commands

```bash
pnpm release:patch   # 0.1.0 → 0.1.1
pnpm release:minor   # 0.1.0 → 0.2.0  (while on 0.x, changelogen may treat major as minor)
pnpm release:major   # 0.1.0 → 1.0.0 when past 0.x

# Preview only (build + changelog to stdout, no file writes / git / npm)
pnpm release:patch -- --dry-run

# Local commit + tag, skip npm publish / push / gh release
pnpm release:patch -- --no-publish
```

## What the script does

1. Asserts a clean git tree and branch `master` or `main`
2. Checks `npm whoami` and `gh auth` (unless `--dry-run` / `--no-publish`)
3. `pnpm run build`
4. Resolves changelog `--from` (latest `vX.Y.Z` ancestor, or the initial commit)
5. `changelogen --bump --{patch|minor|major}` → root version + `CHANGELOG.md`
6. Syncs that version to all `packages/*/package.json`
7. Commit `chore(release): vX.Y.Z` + annotated lightweight tag `vX.Y.Z`
8. `pnpm publish` for `untestutils` (`--access public`)
9. `git push` + `git push origin vX.Y.Z`
10. `gh release create vX.Y.Z --generate-notes --latest`

## Prerequisites

- Clean working tree on `master`/`main`
- `npm login` (or a usable npm auth token)
- Authenticated [GitHub CLI](https://cli.github.com/): `gh auth login`
- Push access to `github.com/s00d/untestutils`

## First publish

`release:*` always bumps. To put **exactly `0.1.0`** on npm once:

```bash
git tag v0.1.0
git push origin v0.1.0
pnpm run build
pnpm --filter untestutils publish --access public --no-git-checks
gh release create v0.1.0 --title v0.1.0 --generate-notes --latest
```

After that, use only `pnpm release:patch|minor|major`.

## Changelog only

```bash
pnpm changelog
# or
pnpm exec changelogen --from v0.1.0
```
