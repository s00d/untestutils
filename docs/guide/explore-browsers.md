---
title: Explore — alternate browsers
description: Perf-oriented spike for Astral, Thirtyfour, Chromiumoxide — out of scope for 1.0.
outline: deep
---

# Explore — alternate browsers

One-time spike before 1.0: could a **faster** browser backend beat Playwright on mass recipe e2e (leased URL, many workers)?

**Decision for 1.0:** stay on Playwright. Revisit when real perf dogfood needs throughput beyond Node CDP bindings — not because Playwright “already has CDP.”

| Project | Perf angle | Why not in 1.0 |
|---------|------------|----------------|
| [Astral](https://github.com/lino-levan/astral) (Deno) | Lean Deno browser automation | No Node/Vitest dogfood path without a separate runner |
| [Thirtyfour](https://github.com/stevepryde/thirtyfour) (Rust / WebDriver) | Native Rust client | WebDriver stack + Node bridge; unclear win vs CDP for our recipe shape |
| [Chromiumoxide](https://github.com/mattsse/chromiumoxide) (Rust / CDP) | Low-level Rust CDP for raw throughput | Interesting **because** it is CDP — potentially faster than Playwright’s Node layer. Deferred for Node↔Rust integration cost in the Vitest/Playwright recipe path until there is concrete perf dogfood |

A thin recipe that only returns `{ url }` could sit under any browser client later. That is not worth a first-class adapter until something measures better than Playwright on real suites.

**Do not block 1.0** on shipping these.

Related: [Vitest Browser Mode](/guide/browser-mode) (component-in-browser track — also not recipe-e2e).
