import net from 'node:net';
import { LOOPBACK_HOST } from './paths';

/** @internal injectable for port allocation edge cases */
export const portNet: {
  createServer: (
    ...args: Parameters<typeof net.createServer>
  ) => ReturnType<typeof net.createServer>;
} = {
  createServer: (
    ...args: Parameters<typeof net.createServer>
  ): ReturnType<typeof net.createServer> => net.createServer(...args),
};

/** Ports handed out by this process recently — a closed probe port can come back from the OS. */
const recentlyIssued = new Map<number, number>();
const REISSUE_AFTER_MS = 60_000;

/**
 * Ask the OS for a free port. The probe socket is closed before the caller binds, so
 * another process can still take it (orchestrator retries a start on EADDRINUSE); within
 * this process the same port is never handed out twice in a row.
 */
export async function getFreePort(host: string = LOOPBACK_HOST): Promise<number> {
  const now = Date.now();
  for (const [port, at] of recentlyIssued) {
    if (now - at > REISSUE_AFTER_MS) recentlyIssued.delete(port);
  }
  let port = await probeFreePort(host);
  for (let i = 0; i < 10 && recentlyIssued.has(port); i++) port = await probeFreePort(host);
  recentlyIssued.set(port, Date.now());
  return port;
}

function probeFreePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = portNet.createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('failed to allocate port'));
        return;
      }
      const { port } = addr;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

export function waitForPort(
  port: number,
  host: string = LOOPBACK_HOST,
  timeoutMs: number = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() > deadline) reject(new Error(`port ${port} not ready after ${timeoutMs}ms`));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}
