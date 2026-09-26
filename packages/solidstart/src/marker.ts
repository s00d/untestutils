import {
  createMarkerUnitFramework,
  type MarkerUnitFramework,
} from '@untestutils/vitest/unit-marker';

export const solidstartUnit: MarkerUnitFramework = createMarkerUnitFramework({
  framework: 'solidstart',
  marker: 'solidstart-unit ok',
  runtimeEntryUrl: new URL('./runtime/entry.mjs', import.meta.url),
});
export const environment: MarkerUnitFramework['environment'] = solidstartUnit.environment;
export const defineVitestProject: MarkerUnitFramework['defineVitestProject'] =
  solidstartUnit.defineVitestProject;
export const mountMarker: MarkerUnitFramework['mountMarker'] = solidstartUnit.mountMarker;
export const getUnitMarkerText: MarkerUnitFramework['getUnitMarkerText'] =
  solidstartUnit.getUnitMarkerText;
export const setupApp: MarkerUnitFramework['setupApp'] = solidstartUnit.setupApp;
export const tryUseApp: MarkerUnitFramework['tryUseApp'] = solidstartUnit.tryUseApp;
export const UNIT_MARKER: MarkerUnitFramework['UNIT_MARKER'] = solidstartUnit.UNIT_MARKER;
export const ROOT_ID: MarkerUnitFramework['ROOT_ID'] = solidstartUnit.ROOT_ID;
export const resetSharedApp: MarkerUnitFramework['resetSharedApp'] = solidstartUnit.resetSharedApp;
export const restartSharedApp: MarkerUnitFramework['restartSharedApp'] =
  solidstartUnit.restartSharedApp;
export const registerEntry: MarkerUnitFramework['registerEntry'] = solidstartUnit.registerEntry;
