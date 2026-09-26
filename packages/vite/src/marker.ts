import {
  counterSetupDom,
  createMarkerUnitFramework,
  type MarkerUnitFramework,
} from '@untestutils/vitest/unit-marker';

export const viteUnit: MarkerUnitFramework = createMarkerUnitFramework({
  framework: 'vite',
  marker: 'vite-unit ok',
  setupDom: counterSetupDom,
  runtimeEntryUrl: new URL('./runtime/entry.mjs', import.meta.url),
});
export const environment: MarkerUnitFramework['environment'] = viteUnit.environment;
export const defineVitestProject: MarkerUnitFramework['defineVitestProject'] =
  viteUnit.defineVitestProject;
export const mountMarker: MarkerUnitFramework['mountMarker'] = viteUnit.mountMarker;
export const getUnitMarkerText: MarkerUnitFramework['getUnitMarkerText'] =
  viteUnit.getUnitMarkerText;
export const setupApp: MarkerUnitFramework['setupApp'] = viteUnit.setupApp;
export const tryUseApp: MarkerUnitFramework['tryUseApp'] = viteUnit.tryUseApp;
export const UNIT_MARKER: MarkerUnitFramework['UNIT_MARKER'] = viteUnit.UNIT_MARKER;
export const ROOT_ID: MarkerUnitFramework['ROOT_ID'] = viteUnit.ROOT_ID;
export const resetSharedApp: MarkerUnitFramework['resetSharedApp'] = viteUnit.resetSharedApp;
export const restartSharedApp: MarkerUnitFramework['restartSharedApp'] = viteUnit.restartSharedApp;
export const registerEntry: MarkerUnitFramework['registerEntry'] = viteUnit.registerEntry;
