import { expect, test } from 'vitest';

test('solidstart-b boots', () => {
  expect(document.body.textContent).toContain('solidstart-unit ok');
});
