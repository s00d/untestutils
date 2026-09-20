---
title: Perf calibration
description: Why the default load duration is 5s — measured rank stability vs longer runs.
outline: deep
---

# Perf calibration

Question: does hammering a fixture for 10–60s change **ranking** vs a short autocannon run?

Measured on existing `nuxt-i18n-next` fixture builds (`plain-nuxt` / `i18n` / `i18n-micro`), same machine, sequential loads:

| Fixture | autocannon 5s RPS | autocannon 10s RPS | Δ | Artillery 2s+8s RPS |
|---------|-------------------:|-------------------:|---:|--------------------:|
| plain-nuxt | 64.0 | 65.2 | 1.9% | 68 |
| i18n | 98.8 | 97.1 | 1.7% | 100 |
| i18n-micro | 173.8 | 187.4 | 7.3% | 112 |

**Rank** `micro > i18n > plain` holds for 5s and 10s.

**micro/i18n ratio:** 1.76 (5s) vs 1.93 (10s) — relative gap change ≈ 9% (under the 15% budget). Absolute RPS for a single fixture still jitters; use the same duration every time and compare ratios/ranks, not one-off absolutes against an old report.

Published long Artillery (6s+60s) historically showed the same rank with a larger micro/i18n gap (~1.69 Artillery RPS). Short Artillery was noisier on absolute micro RPS in this pass — so the **single default** is autocannon **10 connections × 5 seconds**, not a separate “quick” profile.

Reproduce:

```bash
pnpm exec tsx scripts/perf-calibrate.ts
```

Artifact: `.untestutils/perf-calibrate/calibration.json`.
