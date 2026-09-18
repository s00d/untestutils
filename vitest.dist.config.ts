import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'dist',
    include: ['tests/dist/**/*.test.ts'],
    environment: 'node',
  },
});
