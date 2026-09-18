#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '../packages/cli/src/templates');
const dest = join(root, '../packages/untestutils/templates');

if (!existsSync(src)) {
  console.warn('skip copy-cli-templates: missing', src);
  process.exit(0);
}
if (existsSync(dest)) rmSync(dest, { recursive: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('cli templates copied to untestutils/templates');
