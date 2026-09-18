function notImplemented(name: string): never {
  throw new Error(
    `[untestutils/${name}] not implemented yet — see docs/extending.md to add this framework module`,
  );
}

export function sveltekit(_opts?: unknown): never {
  return notImplemented('sveltekit');
}

export default sveltekit;
