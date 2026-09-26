import { expect, test } from 'vitest';

test('next-a boots', () => {
  expect(document.body.textContent).toContain('next-unit ok');
});
