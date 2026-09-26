import {
  createMarkerUnitFramework,
  type MarkerUnitFramework,
} from '@untestutils/vitest/unit-marker';

export const astroUnit: MarkerUnitFramework = createMarkerUnitFramework({
  framework: 'astro',
  marker: 'astro-unit ok',
  runtimeEntryUrl: new URL('./runtime/entry.mjs', import.meta.url),
});
export const environment: MarkerUnitFramework['environment'] = astroUnit.environment;
export const defineVitestProject: MarkerUnitFramework['defineVitestProject'] =
  astroUnit.defineVitestProject;
export const mountMarker: MarkerUnitFramework['mountMarker'] = astroUnit.mountMarker;
export const getUnitMarkerText: MarkerUnitFramework['getUnitMarkerText'] =
  astroUnit.getUnitMarkerText;
export const setupApp: MarkerUnitFramework['setupApp'] = astroUnit.setupApp;
export const tryUseApp: MarkerUnitFramework['tryUseApp'] = astroUnit.tryUseApp;
export const UNIT_MARKER: MarkerUnitFramework['UNIT_MARKER'] = astroUnit.UNIT_MARKER;
export const ROOT_ID: MarkerUnitFramework['ROOT_ID'] = astroUnit.ROOT_ID;
export const resetSharedApp: MarkerUnitFramework['resetSharedApp'] = astroUnit.resetSharedApp;
export const restartSharedApp: MarkerUnitFramework['restartSharedApp'] = astroUnit.restartSharedApp;
export const registerEntry: MarkerUnitFramework['registerEntry'] = astroUnit.registerEntry;
