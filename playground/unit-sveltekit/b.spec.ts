import { expect, test } from 'vitest';

test('sveltekit-b boots', () => {
  expect(document.body.textContent).toContain('sveltekit-unit ok');
});
