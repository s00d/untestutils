function notImplemented(name: string): never {
  throw new Error(
    `[untestutils/${name}] not implemented yet — see docs/extending.md to add this framework module`,
  );
}

export function astro(_opts?: unknown): never {
  return notImplemented('astro');
}

export default astro;
