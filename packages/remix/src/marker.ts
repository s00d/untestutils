import {
  createMarkerUnitFramework,
  type MarkerUnitFramework,
} from '@untestutils/vitest/unit-marker';

export const remixUnit: MarkerUnitFramework = createMarkerUnitFramework({
  framework: 'remix',
  marker: 'remix-unit ok',
  runtimeEntryUrl: new URL('./runtime/entry.mjs', import.meta.url),
});
export const environment: MarkerUnitFramework['environment'] = remixUnit.environment;
export const defineVitestProject: MarkerUnitFramework['defineVitestProject'] =
  remixUnit.defineVitestProject;
export const mountMarker: MarkerUnitFramework['mountMarker'] = remixUnit.mountMarker;
export const getUnitMarkerText: MarkerUnitFramework['getUnitMarkerText'] =
  remixUnit.getUnitMarkerText;
export const setupApp: MarkerUnitFramework['setupApp'] = remixUnit.setupApp;
export const tryUseApp: MarkerUnitFramework['tryUseApp'] = remixUnit.tryUseApp;
export const UNIT_MARKER: MarkerUnitFramework['UNIT_MARKER'] = remixUnit.UNIT_MARKER;
export const ROOT_ID: MarkerUnitFramework['ROOT_ID'] = remixUnit.ROOT_ID;
export const resetSharedApp: MarkerUnitFramework['resetSharedApp'] = remixUnit.resetSharedApp;
export const restartSharedApp: MarkerUnitFramework['restartSharedApp'] = remixUnit.restartSharedApp;
export const registerEntry: MarkerUnitFramework['registerEntry'] = remixUnit.registerEntry;
