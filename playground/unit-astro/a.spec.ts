import { expect, test } from 'vitest';

test('astro-a boots', () => {
  expect(document.body.textContent).toContain('astro-unit ok');
});
