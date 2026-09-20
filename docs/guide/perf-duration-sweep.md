---
title: Perf duration sweep
description: Artillery main-phase length vs ranking — pick 10s at arrival 40 / maxVU 40.
---

# Perf duration sweep

Earlier “stability” at RPS ~40 (maxVU 10) was noise. Sweep with **arrivalRate 40 / maxVusers 40**, warm 2s, 8 paths, 2 reps/fixture.

Autocannon baseline 10c×10s: plain **67** · i18n **101.5** · micro **195.3** (rank ok, micro/i18n gap **1.92**).

| Main s | plain | i18n | micro | rank | gap micro/i18n | Δ gap vs AC | min reqs |
|-------:|------:|-----:|------:|:----:|-------------:|------------:|---------:|
| 5 | 83.5 | 142 | 234.5 | ok | 1.65 | 14.2% | 784 |
| **10** | **84.5** | **140** | **241.5** | **ok** | **1.73** | **10.3%** | **1144** |
| 15 | 60 | 149 | 234.5 | ok | 1.57 | 18.2% | 1544 |
| 20 | 82 | 141.5 | 232.5 | ok | 1.64 | 14.6% | 1960 |
| 30 | 81.5 | 146.5 | 273 | ok | 1.86 | 3.2% | 2808 |

**Pick: main 10s** (arrival 40 / maxVU 40). Same rank as autocannon, gap within ~10%, enough requests; 30s only buys gap cosmetics for ~3× wall time. 5s works if knobs stay heavy — do not use maxVU 10.

Reproduce: `pnpm exec tsx scripts/perf-duration-sweep.ts` → `.untestutils/perf-duration-sweep/sweep.json`.
