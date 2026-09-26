/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  outputFileTracingRoot: join(root, '../../..'),
};
export default nextConfig;
