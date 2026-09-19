import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { staticDir } from '../../packages/core/src/drivers/static-dir';
import { ensurePrepared, stopAllTargets } from '../../packages/core/src/orchestrator';
import { clearRegisteredRecipes } from '../../packages/core/src/recipes';
import { resetRecipeBindings } from '../../packages/core/src/identity';
import { ofetch } from 'ofetch';

describe('staticDir recipe', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('serves index.html and shares prepare across two ensures', async () => {
    const site = await mkdtemp(join(tmpdir(), 'untestutils-site-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'untestutils-art-'));
    await writeFile(join(site, 'index.html'), '<html><body>hello-untestutils</body></html>');

    const recipe = staticDir({ id: 'static-demo', root: site });
    const a = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    const b = await ensurePrepared(recipe, { artifactsRoot: artifacts });

    expect(a.identity).toBe(b.identity);
    expect(a.running.kind === 'url' || a.running.kind === 'url+dir').toBe(true);
    const url = 'url' in a.running ? a.running.url : '';
    const html = await ofetch(url);
    expect(html).toContain('hello-untestutils');

    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });
});
