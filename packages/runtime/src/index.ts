/**
 * untestutils Nuxt in-process runtime utilities.
 *
 * Hybrid port of `@nuxt/test-utils/runtime`. These helpers run inside the
 * `untestutils` vitest environment (see `vitest-environment-untestutils`) with
 * the `untestutils/module` Nuxt module enabled so that `mockNuxtImport`,
 * `mockComponent` and friends are transformed at build time.
 *
 * `suspended.mjs` is loaded dynamically (same as upstream) because it imports
 * Nuxt virtual modules (`#imports`, `#build/root-component.mjs`) that only
 * resolve inside the test environment — not at package load time.
 */
import { h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

interface NuxtTestWindow extends Window {
  __app?: any;
  __registry: Set<string>;
}

declare const window: NuxtTestWindow;

/** Lazy-load Nuxt-virtual suspended helpers (must not be a static top-level import). */
function importSuspended() {
  return import('./suspended.mjs');
}

//#region registerEndpoint
function getEndpointRegistry(): Record<string, any[]> {
  const app = window.__app ?? {};
  return (app._registeredEndpointRegistry ||= {});
}

function findEndpointRegistryHandlers(url: string): any[] | undefined {
  const endpointRegistry = getEndpointRegistry();
  const pathname = url.replace(/[?#].*$/, '');
  for (const [key, handlers] of Object.entries(endpointRegistry)) {
    if (key === url || key === pathname) {
      if (handlers?.length) return handlers;
    }
  }
}

export interface RegisterEndpointOptions {
  handler: (event: any) => any;
  method?: string;
  once?: boolean;
}

/**
 * `registerEndpoint` lets you create a Nitro endpoint that returns mocked data.
 * Handy when a component fetches data from an API.
 *
 * @param url endpoint name (e.g. `/test/`)
 * @param options factory that returns mocked data, or an object with
 *   `handler`, `method` and `once`.
 */
export function registerEndpoint(
  url: string,
  options: RegisterEndpointOptions | ((event: any) => any),
): () => void {
  const app =
    typeof globalThis !== 'undefined' && 'window' in globalThis
      ? (globalThis as any).window?.__app
      : undefined;
  if (!app) {
    throw new Error('registerEndpoint() can only be used in an `untestutils` runtime environment');
  }
  const config: any =
    typeof options === 'function'
      ? { url, handler: options, method: undefined, once: false }
      : { ...options, url };
  config.handler = Object.assign(config.handler, { __is_handler__: true });
  const endpointRegistry = getEndpointRegistry();
  endpointRegistry[url] ||= [];
  endpointRegistry[url].push(config);
  window.__registry.add(url);
  app._registered ||= registerGlobalHandler(app);
  return () => {
    endpointRegistry[url]?.splice(endpointRegistry[url].indexOf(config), 1);
    if (endpointRegistry[url]?.length === 0) window.__registry.delete(url);
  };
}

const handler = Object.assign(
  async (event: any) => {
    const registeredHandlers = findEndpointRegistryHandlers(
      'url' in event && event.url
        ? (event.url.pathname + event.url.search).replace(/^\/_/, '')
        : event.path.replace(/^\/_/, ''),
    );
    const latestHandler = [...(registeredHandlers || [])]
      .reverse()
      .find((config) => (config.method ? event.method === config.method : true));
    if (!latestHandler) return;
    const result = await latestHandler.handler(event);
    if (!latestHandler.once) return result;
    const index = registeredHandlers?.indexOf(latestHandler);
    if (index === undefined || index === -1) return result;
    registeredHandlers?.splice(index, 1);
    if (registeredHandlers?.length === 0) window.__registry.delete(latestHandler.url);
    return result;
  },
  { __is_handler__: true },
);

function registerGlobalHandler(app: any): boolean {
  app.use(handler, {
    match: (...args: any[]) => {
      const [eventOrPath, _event = eventOrPath] = args;
      const url =
        typeof eventOrPath === 'string'
          ? eventOrPath.replace(/^\/_/, '')
          : (eventOrPath.url.pathname + eventOrPath.url.search).replace(/^\/_/, '');
      const event = _event;
      return (
        findEndpointRegistryHandlers(url)?.some((config) =>
          config.method ? event?.method === config.method : true,
        ) ?? false
      );
    },
  });
  return true;
}
//#endregion

//#region mock macros
/**
 * `mockNuxtImport` mocks Nuxt's auto-import functionality. This is a macro that
 * is transformed to `vi.mock()` by `untestutils/module`.
 */
export function mockNuxtImport<T = unknown>(
  _target: string | T,
  _factory: (original?: T) => T,
): void {
  throw new Error(
    'mockNuxtImport() is a macro and it did not get transpiled. Ensure `untestutils/module` is enabled in your Nuxt test config.',
  );
}

/**
 * `unmockNuxtImport` reverts a previous `mockNuxtImport`. This is a macro that
 * is transformed by `untestutils/module`.
 */
export function unmockNuxtImport<T = unknown>(_target: string | T): void {
  throw new Error(
    'unmockNuxtImport() is a macro and it did not get transpiled. Ensure `untestutils/module` is enabled in your Nuxt test config.',
  );
}

/**
 * `mockComponent` replaces a component with a mock. This is a macro that is
 * transformed by `untestutils/module`.
 */
export function mockComponent(_path: string, _component: unknown): void {
  throw new Error(
    'mockComponent() is a macro and it did not get transpiled. Ensure `untestutils/module` is enabled in your Nuxt test config.',
  );
}
//#endregion

//#region mountSuspended
/**
 * `mountSuspended` mounts any Vue component within the Nuxt environment,
 * allowing async setup and access to injections from your Nuxt plugins.
 */
export async function mountSuspended(component: any, options: any = {}): Promise<any> {
  const { cleanupAll, patchWrapperSetProps, wrapperSuspended } = await importSuspended();
  const suspendedHelperName = 'MountSuspendedHelper';
  const clonedComponentName = 'MountSuspendedComponent';
  cleanupAll();
  const { wrapper, setProps } = await wrapperSuspended(component, options, {
    wrapperFn: mount,
    suspendedHelperName,
    clonedComponentName,
  });
  patchWrapperSetProps(wrapper, setProps);
  return wrappedMountedWrapper(wrapper, wrapper.findComponent({ name: clonedComponentName }));
}

function wrappedMountedWrapper(wrapper: any, component: any): any {
  const wrapperProps = ['setProps', 'emitted', 'setupState', 'unmount'];
  return new Proxy(wrapper, {
    get: (_, prop, receiver) => {
      if (prop === 'getCurrentComponent') return getCurrentComponentPatchedProxy;
      const target = wrapperProps.includes(prop as string)
        ? wrapper
        : Reflect.has(component, prop)
          ? component
          : wrapper;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  function getCurrentComponentPatchedProxy() {
    const currentComponent = component.getCurrentComponent();
    return new Proxy(currentComponent, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (prop === 'proxy' && value)
          return new Proxy(value, {
            get(o, p, r) {
              if (!Reflect.has(currentComponent.props, p)) {
                const setupState = wrapper.setupState;
                if (setupState && typeof setupState === 'object') {
                  if (Reflect.has(setupState, p)) return Reflect.get(setupState, p, r);
                }
              }
              return Reflect.get(o, p, r);
            },
          });
        return value;
      },
    });
  }
}
//#endregion

//#region renderSuspended
/**
 * `renderSuspended` renders any Vue component within the Nuxt environment using
 * `@testing-library/vue`'s `render`. Requires `@testing-library/vue`.
 */
export async function renderSuspended(component: any, options: any = {}): Promise<any> {
  const { cleanupAll, wrapperSuspended } = await importSuspended();
  const wrapperId = 'test-wrapper';
  const suspendedHelperName = 'RenderHelper';
  const clonedComponentName = 'RenderSuspendedComponent';
  // Optional peer — dynamic import matches upstream `@nuxt/test-utils`.
  const { render: wrapperFn } = await import('@testing-library/vue');
  cleanupAll();
  document.getElementById(wrapperId)?.remove();
  const { wrapper, setProps } = await wrapperSuspended(component, options, {
    wrapperFn,
    wrappedRender: (render: any) => () =>
      h({
        inheritAttrs: false,
        render: () => h('div', { id: wrapperId }, render()),
      }),
    suspendedHelperName,
    clonedComponentName,
  });
  wrapper.rerender = async (props: any) => {
    setProps(props);
    await nextTick();
  };
  return wrapper;
}
//#endregion
