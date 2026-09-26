import { expect, test } from 'vitest';
import { getUnitMarkerText, mountMarker } from '@untestutils/remix/runtime';

test('remix unit marker is mounted', () => {
  const mounted = mountMarker();
  expect(mounted.text).toContain(getUnitMarkerText());
  expect(document.body.textContent).toContain('remix-unit ok');
});
