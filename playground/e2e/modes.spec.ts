import { describe, test } from 'untestutils/vitest';
import { assertHarnessHtml } from './_helpers.ts';

/**
 * Marker-only e2e modes — keep recipe ids as string literals for assert-e2e-mode-matrix.
 * Override / special recipes stay in separate specs when added.
 */
const MARKER_MODE_IDS = [
  'staticSite',
  'viteSpa',
  'viteSpaDev',
  'nextStatic',
  'nextServer',
  'nextDev',
  'astroSite',
  'astroServer',
  'astroDev',
  'sveltekitApp',
  'sveltekitServer',
  'sveltekitDev',
  'remixApp',
  'remixDev',
  'solidApp',
  'solidDev',
  'nuxtServer',
  'nuxtStatic',
  'nuxtDev',
] as const;

describe('e2e mode markers', () => {
  test.each(MARKER_MODE_IDS)('%s serves expected html', async (id) => {
    await assertHarnessHtml(id);
  });
});
