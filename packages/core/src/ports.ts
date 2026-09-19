import net from 'node:net';
import { LOOPBACK_HOST } from './paths';

/** @internal injectable for port allocation edge cases */
export const portNet = {
  createServer: (...args: Parameters<typeof net.createServer>) => net.createServer(...args),
};

export function getFreePort(host: string = LOOPBACK_HOST): Promise<number> {
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
