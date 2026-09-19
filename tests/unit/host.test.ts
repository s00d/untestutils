import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createServer } from 'node:http';
import { ofetch } from 'ofetch';
import { host } from '../../packages/core/src/drivers/host';
import { ensurePrepared, stopAllTargets } from '../../packages/core/src/orchestrator';
import { clearRegisteredRecipes } from '../../packages/core/src/recipes';
import { resetRecipeBindings } from '../../packages/core/src/identity';
import { getFreePort } from '../../packages/core/src/ports';

describe('host driver (remote URL)', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('attaches to existing HTTP server without prepare', async () => {
    const port = await getFreePort();
    const server = createServer((_req, res) => {
      res.end('remote-ok');
    });
    await new Promise<void>((resolve, reject) => {
      server.listen(port, '127.0.0.1', () => resolve());
      server.once('error', reject);
    });
    const url = `http://127.0.0.1:${port}/`;
    const artifacts = await mkdtemp(join(tmpdir(), 'untestutils-host-'));
    try {
      const recipe = host({ id: 'remote-demo', url });
      const prepared = await ensurePrepared(recipe, { artifactsRoot: artifacts });
      expect(prepared.running.kind).toBe('url');
      if ('url' in prepared.running) {
        const body = await ofetch(prepared.running.url);
        expect(body).toContain('remote-ok');
      }
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});
