import { expect, test } from 'vitest';
import { getUnitMarkerText, mountMarker } from '@untestutils/solidstart/runtime';

test('solidstart unit marker is mounted', () => {
  const mounted = mountMarker();
  expect(mounted.text).toContain(getUnitMarkerText());
  expect(document.body.textContent).toContain('solidstart-unit ok');
});
