import { expect, test } from 'vitest';

test('remix-a boots', () => {
  expect(document.body.textContent).toContain('remix-unit ok');
});
