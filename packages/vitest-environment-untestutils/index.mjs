export default {
  name: 'untestutils',
  async setup() {
    throw new Error(
      '[vitest-environment-untestutils] Nuxt vitest environment ships in untestutils v0.2. Use a harness e2e project for now.',
    );
  },
  async teardown() {},
};
