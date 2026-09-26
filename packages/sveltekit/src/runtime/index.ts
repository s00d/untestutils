/**
 * Honest boundary: sveltekit unit-env is client DOM + soft reset/restart (no SSR / framework router).
 */
export type { ResetSharedAppOptions } from '@untestutils/vitest/unit-marker';
export {
  mountMarker,
  getUnitMarkerText,
  setupApp,
  tryUseApp,
  UNIT_MARKER,
  ROOT_ID,
  resetSharedApp,
  restartSharedApp,
} from '../marker';
