import { expect, test } from 'vitest';
import { getUnitMarkerText, mountMarker } from '@untestutils/next/runtime';

test('next unit marker is mounted', () => {
  const mounted = mountMarker();
  expect(mounted.text).toContain(getUnitMarkerText());
  expect(document.body.textContent).toContain('next-unit ok');
});
