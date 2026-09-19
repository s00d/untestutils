import type { Recipe, SharePolicy } from '../types';

/** Framework/app adapter → Recipe. Core never imports frameworks. */
export type Driver<Opts = unknown> = (opts: Opts) => Recipe;

const SHARE_POLICIES = new Set<SharePolicy>(['always', 'never', 'prepare-only']);

/**
 * Wrap a driver so every produced recipe has a non-empty `id` and a valid `share`.
 * Missing `share` defaults to `always` (same as most built-in drivers).
 */
export function defineDriver<Opts>(impl: Driver<Opts>): Driver<Opts> {
  return (opts: Opts): Recipe => {
    const recipe = impl(opts);
    if (!recipe || typeof recipe !== 'object') {
      throw new Error('[untestutils] defineDriver: driver must return a Recipe');
    }
    const id = typeof recipe.id === 'string' ? recipe.id.trim() : '';
    if (!id) {
      throw new Error('[untestutils] defineDriver: recipe.id is required');
    }
    const share = recipe.share ?? 'always';
    if (!SHARE_POLICIES.has(share)) {
      throw new Error(
        `[untestutils] defineDriver: invalid share "${String(recipe.share)}" (use always|never|prepare-only)`,
      );
    }
    if (recipe.id === id && recipe.share === share) return recipe;
    return { ...recipe, id, share };
  };
}
