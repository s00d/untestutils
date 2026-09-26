import { bumpUnitBootCounter } from '@untestutils/vitest/unit-lifecycle';

/** Count real setupNuxt boots (not worker early-return). Tmpdir-only for CI safety. */
export function bumpSharedNuxtBootCounter(): void {
  bumpUnitBootCounter();
}
