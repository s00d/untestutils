#!/usr/bin/env node
/**
 * Live orphan reclaim: detached server stays alive after crash simulation;
 * stopAllTargets must stop it and drain the registry.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const artifacts = mkdtempSync(join(tmpdir(), 'ut-e2e-teardown-'));

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
    probe.once('error', reject);
  });
}

function waitReady(child, ms = 5_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('child ready timeout')), ms);
    child.stdout.on('data', (buf) => {
      if (String(buf).includes('ready')) {
        clearTimeout(t);
        resolve();
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`child exited early ${code}`)));
  });
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const port = await freePort();
const serverChild = spawn(
  process.execPath,
  [
    '-e',
    `require('node:http').createServer((_q,res)=>res.end('orphan-ok')).listen(${port},'127.0.0.1',()=>process.stdout.write('ready\\n'))`,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
);

await waitReady(serverChild);
const pid = serverChild.pid;
if (!pid) throw new Error('no child pid');
serverChild.unref();

const coreDist = require.resolve('@untestutils/core');
const { stopAllTargets, TargetRegistry, detachLiveTargetsForTests } = await import(
  pathToFileURL(coreDist).href
);

const url = `http://127.0.0.1:${port}/`;
const reg = new TargetRegistry(artifacts);
await reg.set({ id: 'e2e-static', identity: 'e2e', url, pid });

if (!isAlive(pid)) throw new Error('child dead before reclaim');

// Crash simulation: forget in-process stops; leave registry + live pid.
detachLiveTargetsForTests();

await stopAllTargets(artifacts, { keepEventLoop: true });

if (isAlive(pid)) {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* */
  }
  rmSync(artifacts, { recursive: true, force: true });
  throw new Error('orphan still alive after reclaim');
}

if (Object.keys(await reg.read()).length) {
  rmSync(artifacts, { recursive: true, force: true });
  throw new Error('registry not drained after reclaim');
}

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(500) });
  rmSync(artifacts, { recursive: true, force: true });
  throw new Error(`url still reachable after reclaim (status ${res.status})`);
} catch (err) {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    String(err.message).includes('reachable')
  ) {
    throw err;
  }
  /* expected: connection refused */
}

rmSync(artifacts, { recursive: true, force: true });
console.log(JSON.stringify({ ok: true, pid, url, liveStop: true }));
