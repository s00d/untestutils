import { expect, test } from 'vitest';

test('next-b boots', () => {
  expect(document.body.textContent).toContain('next-unit ok');
});
