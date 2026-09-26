import {
  createMarkerUnitFramework,
  type MarkerUnitFramework,
} from '@untestutils/vitest/unit-marker';

export const sveltekitUnit: MarkerUnitFramework = createMarkerUnitFramework({
  framework: 'sveltekit',
  marker: 'sveltekit-unit ok',
  runtimeEntryUrl: new URL('./runtime/entry.mjs', import.meta.url),
});
export const environment: MarkerUnitFramework["environment"] = sveltekitUnit.environment;
export const defineVitestProject: MarkerUnitFramework["defineVitestProject"] = sveltekitUnit.defineVitestProject;
export const mountMarker: MarkerUnitFramework["mountMarker"] = sveltekitUnit.mountMarker;
export const getUnitMarkerText: MarkerUnitFramework["getUnitMarkerText"] = sveltekitUnit.getUnitMarkerText;
export const setupApp: MarkerUnitFramework["setupApp"] = sveltekitUnit.setupApp;
export const tryUseApp: MarkerUnitFramework["tryUseApp"] = sveltekitUnit.tryUseApp;
export const UNIT_MARKER: MarkerUnitFramework["UNIT_MARKER"] = sveltekitUnit.UNIT_MARKER;
export const ROOT_ID: MarkerUnitFramework["ROOT_ID"] = sveltekitUnit.ROOT_ID;
export const resetSharedApp: MarkerUnitFramework["resetSharedApp"] = sveltekitUnit.resetSharedApp;
export const restartSharedApp: MarkerUnitFramework["restartSharedApp"] = sveltekitUnit.restartSharedApp;
export const registerEntry: MarkerUnitFramework["registerEntry"] = sveltekitUnit.registerEntry;
