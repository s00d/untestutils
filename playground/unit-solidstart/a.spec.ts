import { expect, test } from 'vitest';

test('solidstart-a boots', () => {
  expect(document.body.textContent).toContain('solidstart-unit ok');
});
