import { expect, test } from 'vitest';
import { getUnitMarkerText, mountMarker } from '@untestutils/astro/runtime';

test('astro unit marker is mounted', () => {
  const mounted = mountMarker();
  expect(mounted.text).toContain(getUnitMarkerText());
  expect(document.body.textContent).toContain('astro-unit ok');
});
