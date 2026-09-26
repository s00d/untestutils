import {
  createMarkerUnitFramework,
  type MarkerUnitFramework,
} from '@untestutils/vitest/unit-marker';

export const nextUnit: MarkerUnitFramework = createMarkerUnitFramework({
  framework: 'next',
  marker: 'next-unit ok',
  runtimeEntryUrl: new URL('./runtime/entry.mjs', import.meta.url),
});
export const environment: MarkerUnitFramework['environment'] = nextUnit.environment;
export const defineVitestProject: MarkerUnitFramework['defineVitestProject'] =
  nextUnit.defineVitestProject;
export const mountMarker: MarkerUnitFramework['mountMarker'] = nextUnit.mountMarker;
export const getUnitMarkerText: MarkerUnitFramework['getUnitMarkerText'] =
  nextUnit.getUnitMarkerText;
export const setupApp: MarkerUnitFramework['setupApp'] = nextUnit.setupApp;
export const tryUseApp: MarkerUnitFramework['tryUseApp'] = nextUnit.tryUseApp;
export const UNIT_MARKER: MarkerUnitFramework['UNIT_MARKER'] = nextUnit.UNIT_MARKER;
export const ROOT_ID: MarkerUnitFramework['ROOT_ID'] = nextUnit.ROOT_ID;
export const resetSharedApp: MarkerUnitFramework['resetSharedApp'] = nextUnit.resetSharedApp;
export const restartSharedApp: MarkerUnitFramework['restartSharedApp'] = nextUnit.restartSharedApp;
export const registerEntry: MarkerUnitFramework['registerEntry'] = nextUnit.registerEntry;
