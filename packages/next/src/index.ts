function notImplemented(name: string): never {
  throw new Error(
    `[untestutils/${name}] not implemented yet — see docs/extending.md to add this framework module`,
  );
}

export function next(_opts?: unknown): never {
  return notImplemented('next');
}

export default next;
