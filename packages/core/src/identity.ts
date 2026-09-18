import { resolve } from 'pathe';
import { contentHash, hashString } from './hash';
import { SCHEMA_VERSION, type HashCtx, type Recipe } from './types';

export async function computeIdentity(
  recipe: Recipe,
  artifactsRoot: string,
  root?: string,
): Promise<{
  identity: string;
  hash: string;
  id: string;
}> {
  const id = recipe.id;
  if (!id) {
    throw new Error('[untestutils] Recipe.id is required for sharing and registry');
  }

  const ctx: HashCtx = {
    root: root ? resolve(root) : undefined,
    outDir: '',
    artifactsRoot,
  };

  const inputParts: string[] = [];
  if (recipe.hashInputs) {
    const inputs = await recipe.hashInputs(ctx);
    inputParts.push(...inputs.map((p) => resolve(p)));
  } else if (root) {
    inputParts.push(resolve(root));
  }

  const content = inputParts.length ? await contentHash(inputParts) : hashString(id);
  const hash = hashString(`${SCHEMA_VERSION}|${id}|${content}|${recipe.share ?? 'always'}`);
  const identity = `${sanitize(id)}-${hash.slice(0, 12)}`;
  return { identity, hash, id };
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 64);
}

const registryIds = new Map<string, string>();

/** Detect colliding Recipe.id pointing at different identity hashes in-process. */
export function assertUniqueRecipeBinding(id: string, identity: string): void {
  const prev = registryIds.get(id);
  if (prev && prev !== identity) {
    throw new Error(
      `[untestutils] Recipe id "${id}" is bound to conflicting identities (${prev} vs ${identity}). Use distinct ids.`,
    );
  }
  registryIds.set(id, identity);
}

export function resetRecipeBindings(): void {
  registryIds.clear();
}
