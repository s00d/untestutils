import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __UT_MARK__: JSON.stringify('ut-mark-default'),
  },
  preview: { strictPort: true },
  server: { strictPort: true },
});
