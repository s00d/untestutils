---
title: Artillery verification (before dropping autocannon)
description: Measured — do not drop autocannon until ranking is proven.
---

# Artillery verification (2026-09-20)

**Conclusion: do not switch to Artillery-only yet.** Fields exist and single-fixture repeats are stable, but cross-fixture ranking with the current knobs is wrong.

## Completeness (i18n-micro, 3× 5s)

All headline metrics present: RPS, latency avg/min/max/p50/p95/p99, durationSec, errorRate.

Counters/rates/summaries include `http.request_rate`, `http.response_time`, `http.codes.*`, `vusers.*`.

## Stability (same fixture, same knobs)

| Run | RPS | p50 | p95 |
|-----|----:|----:|----:|
| 1 | 39 | 6 | 7 |
| 2 | 41 | 6 | 7 |
| 3 | 41 | 6 | 10.1 |

Max RPS deviation ≈ **3.3%** (pass).

## Ranking 5s vs 10s (multi-URL, arrivalRate 10 / maxVusers 10)

| Fixture | Artillery 5s | Artillery 10s |
|---------|-------------:|--------------:|
| plain-nuxt | 29 | 41 |
| i18n | 41 | 32 |
| i18n-micro | 41 | 36 |

- 5s: micro **ties** i18n (41) — no winner signal.
- 10s: plain **beats** micro — inverted vs known autocannon rank `micro > i18n > plain`.

Reproduce:

```bash
pnpm exec tsx scripts/perf-verify-artillery.ts
pnpm exec tsx scripts/perf-calibrate.ts
```

Artifacts: `.untestutils/perf-verify/verify.json`, `.untestutils/perf-calibrate/calibration.json`.
