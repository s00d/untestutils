import { expect, test } from 'vitest';
import {
  getUnitMarkerText,
  mountMarker,
  resetSharedApp,
  restartSharedApp,
} from '@untestutils/vite/runtime';

test('vite unit marker is mounted', () => {
  const mounted = mountMarker();
  expect(mounted.text).toContain(getUnitMarkerText());
  expect(document.body.textContent).toContain('vite-unit ok');
});

test('soft reset clears counter state', async () => {
  const btn = document.getElementById('inc');
  const count = document.getElementById('count');
  expect(btn).toBeTruthy();
  expect(count?.textContent).toBe('0');
  btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(count?.textContent).toBe('1');
  await resetSharedApp();
  expect(document.getElementById('count')?.textContent).toBe('0');
  expect(document.body.textContent).toContain('vite-unit ok');
});

test('restartSharedApp remounts marker', async () => {
  await restartSharedApp();
  expect(document.body.textContent).toContain('vite-unit ok');
  expect(document.getElementById('count')?.textContent).toBe('0');
});
