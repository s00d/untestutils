/**
 * Vitest environment for Nuxt unit tests.
 * DOM bootstrap via `@untestutils/vitest/unit-dom`; Nuxt window wiring stays local.
 * Important: `setupWindow` must run before `populateGlobal` (deferPopulate).
 */
import { joinURL } from 'ufo';
import { setupUnitDom, type UnitDomGlobal } from '@untestutils/vitest/unit-dom';
import {
  setupWindow,
  type EnvironmentOptions,
  type NuxtRuntimeWindow,
} from '../runtime/shared/environment';

type DomEnvironmentOptions = EnvironmentOptions & {
  happyDom?: ConstructorParameters<typeof import('happy-dom').Window>[0];
  jsdom?: ConstructorParameters<typeof import('jsdom').JSDOM>[1] & {
    html?: string;
    userAgent?: string;
    console?: boolean;
    cookieJar?: boolean;
  };
};

const environment = {
  name: 'untestutils',
  viteEnvironment: 'client' as const,
  async setup(
    global: UnitDomGlobal,
    environmentOptions: DomEnvironmentOptions,
  ): Promise<{ teardown: () => void }> {
    const url = joinURL(
      environmentOptions.nuxt?.url ?? 'http://localhost:3000',
      environmentOptions.nuxtRuntimeConfig?.app?.baseURL || '/',
    );
    const {
      window: win,
      teardown,
      populate,
    } = await setupUnitDom(global, {
      url,
      domEnvironment: environmentOptions.nuxt?.domEnvironment,
      happyDom: environmentOptions.happyDom,
      jsdom: environmentOptions.jsdom,
      mock: {
        // Nuxt opt-in stubs (legacy): only when explicitly enabled
        intersectionObserver: environmentOptions.nuxt?.mock?.intersectionObserver === true,
        indexedDb: environmentOptions.nuxt?.mock?.indexedDb === true,
      },
      deferPopulate: true,
    });

    const teardownWindow = await setupWindow(win as NuxtRuntimeWindow, {
      ...environmentOptions,
      nuxt: {
        rootId: environmentOptions.nuxt?.rootId,
        h3Version: environmentOptions.nuxt?.h3Version,
        url: environmentOptions.nuxt?.url,
        domEnvironment: environmentOptions.nuxt?.domEnvironment,
        appIsolation: environmentOptions.nuxt?.appIsolation,
        resetBetweenTests: environmentOptions.nuxt?.resetBetweenTests,
        mock: environmentOptions.nuxt?.mock,
      },
    });

    populate();

    // Mirror isolation flags onto Vitest global (populateGlobal may rebind window).
    const g = global as UnitDomGlobal & {
      __UNTESTUTILS_ENVIRONMENT__?: boolean;
      __UNTESTUTILS_FRAMEWORK__?: string;
      __UNTESTUTILS_APP_ISOLATION__?: 'file' | 'worker';
      __UNTESTUTILS_RESET_BETWEEN_TESTS__?: boolean;
      __NUXT_VITEST_ENVIRONMENT__?: boolean;
    };
    g.__UNTESTUTILS_ENVIRONMENT__ = true;
    g.__UNTESTUTILS_FRAMEWORK__ = 'nuxt';
    g.__NUXT_VITEST_ENVIRONMENT__ = true;
    if (environmentOptions.nuxt?.appIsolation) {
      g.__UNTESTUTILS_APP_ISOLATION__ = environmentOptions.nuxt.appIsolation;
    }
    if (environmentOptions.nuxt?.resetBetweenTests !== undefined) {
      g.__UNTESTUTILS_RESET_BETWEEN_TESTS__ = environmentOptions.nuxt.resetBetweenTests;
    }

    return {
      teardown(): void {
        teardownWindow();
        teardown();
      },
    };
  },
};

export default environment;
