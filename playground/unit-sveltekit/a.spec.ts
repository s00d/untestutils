import { expect, test } from 'vitest';

test('sveltekit-a boots', () => {
  expect(document.body.textContent).toContain('sveltekit-unit ok');
});
