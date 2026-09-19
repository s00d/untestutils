/**
 * untestutils Nuxt in-process runtime utilities.
 *
 * Hybrid port of `@nuxt/test-utils/runtime`. These helpers run inside the
 * `untestutils` vitest environment (see `vitest-environment-untestutils`) with
 * the `untestutils/module` Nuxt module enabled so that `mockNuxtImport`,
 * `mockComponent` and friends are transformed at build time.
 *
 * `suspended` is loaded dynamically because it imports Nuxt virtual modules
 * (`#imports`, `#build/root-component.mjs`) that only resolve inside the test environment.
 */
import { h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { Component, VNode } from 'vue';
import type { MountingOptions, VueWrapper } from '@vue/test-utils';
import type { render as testingLibraryRender } from '@testing-library/vue';

interface NuxtTestWindow extends Window {
  __app?: RuntimeH3App;
  __registry: Set<string>;
}

declare const window: NuxtTestWindow;

type Awaitable<T> = T | Promise<T>;
type RuntimeH3Event = {
  method?: string;
  path: string;
  url?: URL;
};
type RuntimeEndpointHandler<T = unknown> = ((event: RuntimeH3Event) => Awaitable<T>) & {
  __is_handler__?: true;
};
type EndpointConfig = {
  url: string;
  handler: RuntimeEndpointHandler;
  method?: string;
  once?: boolean;
};
type RuntimeH3App = {
  _registered?: boolean;
  _registeredEndpointRegistry?: EndpointRegistry;
  use: (
    handler: RuntimeEndpointHandler,
    options: { match: (eventOrPath: string | RuntimeH3Event, event?: RuntimeH3Event) => boolean },
  ) => void;
};
type EndpointRegistry = Record<string, EndpointConfig[]>;
type MountSuspendedOptions<T extends Component> = MountingOptions<T> & {
  route?: import('vue-router').RouteLocationRaw | false;
  scoped?: boolean;
  spy?: boolean;
};
type TestingLibraryRender = typeof testingLibraryRender;
type RenderSuspendedOptions<T extends Component> = Parameters<TestingLibraryRender>[1] &
  MountSuspendedOptions<T>;
type RenderSuspendedResult<T extends Component> = ReturnType<TestingLibraryRender> & {
  rerender: (props?: Record<string, unknown>) => Promise<void>;
};
type MountedWrapper = VueWrapper & { setupState: Record<string, unknown> };

export type SuspendedHelpers = {
  cleanupAll: () => void;
  patchWrapperSetProps: (
    wrapper: object,
    setProps: (props: Record<string, unknown>) => void,
  ) => void;
  wrapperSuspended: <TWrapper>(
    component: Component,
    options: MountingOptions<Component> & {
      route?: import('vue-router').RouteLocationRaw | false;
      scoped?: boolean;
      spy?: boolean;
    },
    config: {
      wrapperFn: (component: Component, options?: unknown) => TWrapper;
      wrappedRender?: (render: () => VNode) => () => VNode;
      suspendedHelperName: string;
      clonedComponentName: string;
    },
  ) => Promise<{
    wrapper: TWrapper & { setupState: Record<string, unknown> };
    setProps: (props: Record<string, unknown>) => void;
  }>;
};

/** Lazy-load Nuxt-virtual suspended helpers (must not be a static top-level import). */
function importSuspended(): Promise<SuspendedHelpers> {
  return import('./suspended') as Promise<SuspendedHelpers>;
}

//#region registerEndpoint
function getEndpointRegistry(): EndpointRegistry {
  const app = window.__app ?? (window.__app = {} as RuntimeH3App);
  return (app._registeredEndpointRegistry ||= {});
}

function findEndpointRegistryHandlers(url: string): EndpointConfig[] | undefined {
  const endpointRegistry = getEndpointRegistry();
  const pathname = url.replace(/[?#].*$/, '');
  for (const [key, handlers] of Object.entries(endpointRegistry)) {
    if (key === url || key === pathname) {
      if (handlers?.length) return handlers;
    }
  }
}

export interface RegisterEndpointOptions {
  handler: RuntimeEndpointHandler;
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
  options: RegisterEndpointOptions | RuntimeEndpointHandler,
): () => void {
  const app =
    typeof globalThis !== 'undefined' && 'window' in globalThis
      ? (globalThis.window as unknown as NuxtTestWindow | undefined)?.__app
      : undefined;
  if (!app) {
    throw new Error('registerEndpoint() can only be used in an `untestutils` runtime environment');
  }
  const config: EndpointConfig =
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
  async (event: RuntimeH3Event): Promise<unknown> => {
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
  { __is_handler__: true as const },
);

function registerGlobalHandler(app: RuntimeH3App): boolean {
  app.use(handler, {
    match: (eventOrPath: string | RuntimeH3Event, _event?: RuntimeH3Event): boolean => {
      const url =
        typeof eventOrPath === 'string'
          ? eventOrPath.replace(/^\/_/, '')
          : eventOrPath.url
            ? (eventOrPath.url.pathname + eventOrPath.url.search).replace(/^\/_/, '')
            : eventOrPath.path.replace(/^\/_/, '');
      const event = _event ?? (typeof eventOrPath === 'string' ? undefined : eventOrPath);
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
export async function mountSuspended<T extends Component>(
  component: T,
  options: MountSuspendedOptions<T> = {},
): Promise<VueWrapper> {
  const { cleanupAll, patchWrapperSetProps, wrapperSuspended } = await importSuspended();
  const suspendedHelperName = 'MountSuspendedHelper';
  const clonedComponentName = 'MountSuspendedComponent';
  cleanupAll();
  const { wrapper, setProps } = await wrapperSuspended<MountedWrapper>(
    component,
    options as MountSuspendedOptions<Component>,
    {
    wrapperFn: (component, options) =>
      mount(component, options as Parameters<typeof mount>[1]) as MountedWrapper,
    suspendedHelperName,
    clonedComponentName,
    },
  );
  patchWrapperSetProps(wrapper, setProps);
  return wrappedMountedWrapper(wrapper, wrapper.findComponent({ name: clonedComponentName }));
}

function wrappedMountedWrapper(wrapper: MountedWrapper, component: VueWrapper): VueWrapper {
  const wrapperProps: (string | symbol)[] = ['setProps', 'emitted', 'setupState', 'unmount'];
  return new Proxy(wrapper, {
    get: (_, prop: string | symbol, receiver) => {
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
  function getCurrentComponentPatchedProxy(): object {
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
export async function renderSuspended<T extends Component>(
  component: T,
  options: RenderSuspendedOptions<T> = {},
): Promise<RenderSuspendedResult<T>> {
  const { cleanupAll, wrapperSuspended } = await importSuspended();
  const wrapperId = 'test-wrapper';
  const suspendedHelperName = 'RenderHelper';
  const clonedComponentName = 'RenderSuspendedComponent';
  // Optional peer — dynamic import matches upstream `@nuxt/test-utils`.
  const { render: wrapperFn } = await import('@testing-library/vue');
  cleanupAll();
  document.getElementById(wrapperId)?.remove();
  const { wrapper, setProps } = await wrapperSuspended<ReturnType<TestingLibraryRender>>(
    component,
    options as RenderSuspendedOptions<Component>,
    {
    wrapperFn: (component, options) =>
      wrapperFn(component, options as Parameters<TestingLibraryRender>[1]),
    wrappedRender: (render: () => VNode) => () =>
      h({
        inheritAttrs: false,
        render: () => h('div', { id: wrapperId }, render()),
      }),
    suspendedHelperName,
    clonedComponentName,
    },
  );
  const renderResult = wrapper as RenderSuspendedResult<T>;
  renderResult.rerender = async (props: object = {}) => {
    setProps(props as Record<string, unknown>);
    await nextTick();
  };
  return renderResult;
}
//#endregion
