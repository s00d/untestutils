import { expect, test } from 'vitest';

test('vite-a boots', () => {
  expect(document.body.textContent).toContain('vite-unit ok');
});
