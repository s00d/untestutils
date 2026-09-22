import type { ArtilleryLoadKnobs, ArtilleryScript } from '../types';

/** Defaults for generic knobs when a consumer does not override. */
export const ARTILLERY_LOAD_DEFAULTS = {
  durationSec: 10,
  arrivalRate: 40,
  maxVusers: 40,
  warmUpSec: 2,
  warmUpArrivalRate: 10,
  paths: ['/'] as readonly string[],
} as const;

export type { ArtilleryLoadKnobs };

/**
 * Build an in-process Artillery script from knobs — no YAML file.
 * Prefer this over `artillery: { config: '…yml' }`.
 *
 * Set `maxVusers: undefined` with `'maxVusers' in knobs` (explicit key) to omit
 * the cap — same as the historical uncapped YAML phases.
 */
export function buildArtilleryScript(knobs: ArtilleryLoadKnobs = {}): ArtilleryScript {
  const durationSec = knobs.durationSec ?? ARTILLERY_LOAD_DEFAULTS.durationSec;
  const arrivalRate = knobs.arrivalRate ?? ARTILLERY_LOAD_DEFAULTS.arrivalRate;
  const maxVusers = 'maxVusers' in knobs ? knobs.maxVusers : ARTILLERY_LOAD_DEFAULTS.maxVusers;
  const warmUpSec = knobs.warmUpSec ?? ARTILLERY_LOAD_DEFAULTS.warmUpSec;
  const warmUpArrivalRate = knobs.warmUpArrivalRate ?? ARTILLERY_LOAD_DEFAULTS.warmUpArrivalRate;
  const paths = knobs.paths?.length ? knobs.paths : [...ARTILLERY_LOAD_DEFAULTS.paths];
  const name = knobs.name ?? 'load';

  const withVu = (phase: Record<string, unknown>, vu: number | undefined) => {
    if (vu !== undefined && vu !== null && vu > 0) phase.maxVusers = vu;
    return phase;
  };

  const phases: Array<Record<string, unknown>> = [];
  if (warmUpSec > 0) {
    phases.push(
      withVu(
        {
          name: 'warm-up',
          duration: warmUpSec,
          arrivalRate: warmUpArrivalRate,
        },
        maxVusers !== undefined && maxVusers !== null
          ? Math.min(maxVusers, Math.max(1, warmUpArrivalRate))
          : undefined,
      ),
    );
  }
  phases.push(
    withVu(
      {
        name: 'main',
        duration: durationSec,
        arrivalRate,
      },
      maxVusers,
    ),
  );

  return {
    config: {
      phases,
      http: { timeout: 30 },
    },
    scenarios: [
      {
        name,
        flow: paths.map((url) => ({ get: { url } })),
        ...(paths.length > 1 ? { 'parallel-requests': Math.min(paths.length, 8) } : {}),
      },
    ],
  };
}

export function describeArtilleryLoad(knobs: ArtilleryLoadKnobs = {}): string {
  const durationSec = knobs.durationSec ?? ARTILLERY_LOAD_DEFAULTS.durationSec;
  const arrivalRate = knobs.arrivalRate ?? ARTILLERY_LOAD_DEFAULTS.arrivalRate;
  const maxVusers = 'maxVusers' in knobs ? knobs.maxVusers : ARTILLERY_LOAD_DEFAULTS.maxVusers;
  const warmUpSec = knobs.warmUpSec ?? ARTILLERY_LOAD_DEFAULTS.warmUpSec;
  const paths = knobs.paths?.length ? knobs.paths : ARTILLERY_LOAD_DEFAULTS.paths;
  const warm =
    warmUpSec > 0
      ? `warm ${warmUpSec}s@${knobs.warmUpArrivalRate ?? ARTILLERY_LOAD_DEFAULTS.warmUpArrivalRate} + `
      : '';
  const vu =
    maxVusers !== undefined && maxVusers !== null && maxVusers > 0
      ? ` maxVU ${maxVusers}`
      : ' uncapped VU';
  return `${warm}${durationSec}s @${arrivalRate}/s${vu} · ${paths.length} path(s)`;
}

/** True when value is knobs (not `{ config }` / `{ script }`). */
export function isArtilleryKnobs(value: unknown): value is ArtilleryLoadKnobs {
  if (!value || typeof value !== 'object') return false;
  if ('config' in value || 'script' in value) return false;
  return true;
}
