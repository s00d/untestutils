import { expect, test } from 'vitest';

test('astro-b boots', () => {
  expect(document.body.textContent).toContain('astro-unit ok');
});
