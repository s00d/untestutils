import { describe, expect, test } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { contentHash } from '../../packages/core/src/hash';
import { fileURLToPath } from 'node:url';
import { dirname } from 'pathe';

describe('workspace dogfood hash', () => {
  test('demo-lib change invalidates content hash', async () => {
    const root = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../playground/packages/demo-lib',
    );
    const h1 = await contentHash([root]);
    const tmp = await mkdtemp(join(tmpdir(), 'untestutils-ws-'));
    await mkdir(join(tmp, 'lib'), { recursive: true });
    await writeFile(join(tmp, 'lib', 'a.js'), 'export const v = 1');
    const a = await contentHash([join(tmp, 'lib')]);
    await writeFile(join(tmp, 'lib', 'a.js'), 'export const v = 2');
    const b = await contentHash([join(tmp, 'lib')]);
    expect(a).not.toBe(b);
    expect(h1).toBeTruthy();
    await rm(tmp, { recursive: true, force: true });
  });
});
