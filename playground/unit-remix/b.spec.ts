import { expect, test } from 'vitest';

test('remix-b boots', () => {
  expect(document.body.textContent).toContain('remix-unit ok');
});
