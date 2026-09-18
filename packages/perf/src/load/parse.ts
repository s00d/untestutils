import type { ArtilleryResult, AutocannonResult } from '../types';

/** Parse autocannon `-j` stdout into a typed result. */
export function parseAutocannonJson(raw: string): AutocannonResult {
  return JSON.parse(raw) as AutocannonResult;
}

/** Parse Artillery `--output` JSON into a typed result. */
export function parseArtilleryJson(raw: string): ArtilleryResult {
  return JSON.parse(raw) as ArtilleryResult;
}
