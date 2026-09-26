export {
  resolveUnitFramework,
  UNIT_FRAMEWORK_PACKAGES,
  UNIT_FRAMEWORK_IDS,
} from '@untestutils/vitest/unit-dom';

declare const environment: {
  name: string;
  viteEnvironment: string;
  setup: (
    global: typeof globalThis,
    environmentOptions: Record<string, unknown>,
  ) => Promise<{ teardown?: () => void | Promise<void> } | void>;
};

export default environment;
