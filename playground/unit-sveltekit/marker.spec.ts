import { expect, test } from 'vitest';
import { getUnitMarkerText, mountMarker } from '@untestutils/sveltekit/runtime';

test('sveltekit unit marker is mounted', () => {
  const mounted = mountMarker();
  expect(mounted.text).toContain(getUnitMarkerText());
  expect(document.body.textContent).toContain('sveltekit-unit ok');
});
