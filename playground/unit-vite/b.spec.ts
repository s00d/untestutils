import { expect, test } from 'vitest';

test('vite-b boots', () => {
  expect(document.body.textContent).toContain('vite-unit ok');
});
