/**
 * Vitest Browser Mode setup entry (real Chromium window).
 * Node DOM unit env uses `./entry` instead (skipped when this flag is set).
 */
import environmentOptions from 'untestutils-vitest-environment-options';
import { runBrowserNuxtEntry } from './shared/browser-entry';
import type { SetupEntryWindow } from './shared/setup-entry';
import type { EnvironmentOptions } from './shared/environment';

const win = globalThis.window as SetupEntryWindow | undefined;
if (win) {
  await runBrowserNuxtEntry(win, environmentOptions as EnvironmentOptions);
}

export { runBrowserNuxtEntry } from './shared/browser-entry';
