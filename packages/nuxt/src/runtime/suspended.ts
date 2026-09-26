import {
  Suspense,
  effectScope,
  type App,
  type Component,
  type ComponentInternalInstance,
  type ComponentOptions,
  type SetupContext,
  type Slots,
  type VNode,
  getCurrentInstance,
  h,
  nextTick,
  onErrorCaptured,
  reactive,
} from 'vue';
import { vi } from 'vitest';
import { defineComponent, tryUseNuxtApp, useNuxtApp, useRouter } from '#imports';
import NuxtRoot from '#build/root-component.mjs';
import { addCleanup, cleanupAll, removeCleanup } from './shared/cleanup';

type SetupState = Record<string, unknown>;
type Cleanup = () => void;
type MountGlobalOptions = NonNullable<
  import('@vue/test-utils').MountingOptions<Component>['global']
>;
type MountingLikeOptions = import('@vue/test-utils').MountingOptions<Component> & {
  route?: import('vue-router').RouteLocationRaw | false;
  scoped?: boolean;
  spy?: boolean;
};
type WrapperFn = (component: Component, options?: unknown) => unknown;
type WrapperSuspendedConfig = {
  wrapperFn: WrapperFn;
  wrappedRender?: (render: () => VNode) => () => VNode;
  suspendedHelperName: string;
  clonedComponentName: string;
  stubRouterLink?: boolean;
};
type WrapperSuspendedResult<TWrapper> = {
  wrapper: TWrapper & { setupState: SetupState };
  setProps: (props: Record<string, unknown>) => void;
  cleanup: Cleanup;
};
type VueAppWithInternals = App<Element> & Record<string, unknown>;
type ComponentWithSetup = ComponentOptions & {
  __cssModules?: Record<string, unknown>;
  setup?: (props: Record<string, unknown>, ctx: SetupContext) => Promise<unknown> | unknown;
};
type NuxtUnctx = {
  get: (name: 'nuxt-app') => { tryUse: () => { vueApp: VueAppWithInternals } };
};

declare global {
  interface Window {
    __cleanup?: Cleanup[];
  }

  // Nuxt's unctx global exists only after the app entry has been loaded.
  // eslint-disable-next-line no-var
  var __unctx__: NuxtUnctx;
}

//#region src/runtime-utils/components/RouterLink.ts
function getUseLink(nuxtApp: ReturnType<typeof useNuxtApp>):
  | ((props: Record<string, unknown>) => {
      route: { value: { href: string } };
      href: { value: string };
      isActive: { value: boolean };
      isExactActive: { value: boolean };
      navigate: (event?: MouseEvent) => Promise<void> | void;
    })
  | undefined {
  const linkComponent = nuxtApp.vueApp._context.components.RouterLink;
  if (!linkComponent || typeof linkComponent !== 'object') return void 0;
  if (typeof linkComponent.useLink !== 'function') return void 0;
  return linkComponent.useLink.bind(linkComponent);
}
const RouterLink = defineComponent({
  functional: true,
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
    custom: Boolean,
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
    ariaCurrentValue: String,
  },
  setup: (props, { slots }) => {
    const useLink = getUseLink(useNuxtApp());
    if (!useLink) {
      const navigate = () => {};
      const router = useRouter();
      return () => {
        const route = router.resolve(props.to);
        return props.custom
          ? slots.default?.({
              href: route.href,
              navigate,
              route,
            })
          : h(
              'a',
              {
                href: route.href,
                onClick: (e) => {
                  e.preventDefault();
                },
              },
              slots,
            );
      };
    }
    const link = useLink(props);
    return () => {
      const route = link.route.value;
      const href = link.href.value;
      const isActive = link.isActive.value;
      const isExactActive = link.isExactActive.value;
      return props.custom
        ? slots.default?.({
            href,
            navigate: link.navigate,
            route,
            isActive,
            isExactActive,
          })
        : h(
            'a',
            {
              href,
              onClick: (e) => {
                e.preventDefault();
                return link.navigate(e);
              },
            },
            slots,
          );
    };
  },
});
//#endregion
//#region src/runtime-utils/utils/suspended.ts
function resolveVueApp(): VueAppWithInternals {
  return (tryUseNuxtApp()?.vueApp ||
    globalThis.__unctx__.get('nuxt-app').tryUse().vueApp) as VueAppWithInternals;
}
/**
 * `wrapper.setProps` delegates to this `@vue/test-utils` internal when the wrapper is the mount
 * root, which is the case for the component we mount around the suspended component.
 */
function patchWrapperSetProps(
  wrapper: object,
  setProps: (props: Record<string, unknown>) => void,
): void {
  Object.assign(wrapper, { __setProps: setProps });
}
function runEffectScope<T>(fn: () => T, register: (fn: Cleanup) => void): T | undefined {
  const scope = effectScope();
  register(() => scope.stop());
  return scope.run(fn);
}
function wrapperSuspended<TWrapper>(
  component: Component,
  options: MountingLikeOptions | undefined = {},
  {
    wrapperFn,
    wrappedRender = (fn: () => VNode) => fn,
    suspendedHelperName,
    clonedComponentName,
    stubRouterLink = true,
  }: WrapperSuspendedConfig,
): Promise<WrapperSuspendedResult<TWrapper>> {
  const vueApp = resolveVueApp();
  const globalProperties = makeAllPropertiesEnumerable(
    vueApp.config.globalProperties as Record<string, unknown>,
  ) as NonNullable<NonNullable<MountGlobalOptions['config']>['globalProperties']>;
  const resolvedOptions = options ?? {};
  const ownCleanups: Cleanup[] = [];
  function registerCleanup(fn: Cleanup): void {
    ownCleanups.push(fn);
    addCleanup(fn);
  }
  function cleanup(): void {
    for (const fn of ownCleanups.splice(0)) {
      removeCleanup(fn);
      fn();
    }
  }
  const { props = {}, attrs = {} } = resolvedOptions;
  const { route = '/', scoped = false, spy = false, ...wrapperFnOptions } = resolvedOptions;
  const componentOptions = component as ComponentWithSetup;
  const { setup: componentSetup, ...componentRest } = componentOptions;
  let wrappedInstance: ComponentInternalInstance | null = null;
  let setupContext: SetupContext | undefined;
  let setupState: SetupState = {};
  const setProps = reactive<Record<string, unknown>>({});
  function patchInstanceAppContext(): void {
    const app = getCurrentInstance()?.appContext.app as VueAppWithInternals | undefined;
    if (!app) return;
    for (const [key, value] of Object.entries(vueApp)) {
      if (key in app) continue;
      app[key] = value;
    }
  }
  const ClonedComponent = {
    components: {},
    ...(component as Record<string, unknown>),
    name: clonedComponentName,
    async setup(props: Record<string, unknown>, instanceContext: SetupContext): Promise<unknown> {
      const currentInstance = getCurrentInstance();
      if (currentInstance)
        currentInstance.emit = (event: string, ...args: unknown[]) => {
          setupContext?.emit(event, ...args);
        };
      if (!componentSetup) return;
      let result = scoped
        ? await runEffectScope(() => componentSetup(props, setupContext!), registerCleanup)
        : await componentSetup(props, setupContext!);
      if (wrappedInstance?.exposed) instanceContext.expose(wrappedInstance.exposed);
      if (result && typeof result === 'object') {
        if (spy) result = vi.mockObject(result as Record<string, unknown>, { spy: true });
        setupState = result as SetupState;
      } else setupState = {};
      return result;
    },
  } satisfies ComponentOptions;
  const SuspendedHelper = {
    name: suspendedHelperName,
    render: () => '',
    async setup(): Promise<() => VNode> {
      if (route) await useRouter().replace(route);
      return () =>
        h(
          ClonedComponent,
          {
            ...props,
            ...setProps,
            ...attrs,
          },
          setupContext?.slots as Slots,
        );
    },
  } satisfies ComponentOptions;
  return new Promise<WrapperSuspendedResult<TWrapper>>((resolve, reject) => {
    let isMountSettled = false;
    const wrapper = wrapperFn(
      {
        inheritAttrs: false,
        __cssModules: componentRest.__cssModules,
        setup: (props: Record<string, unknown>, ctx: SetupContext) => {
          patchInstanceAppContext();
          wrappedInstance = getCurrentInstance();
          setupContext = ctx;
          const nuxtRootSetupResult = runEffectScope(
            () =>
              typeof NuxtRoot === 'object' &&
              'setup' in NuxtRoot &&
              typeof NuxtRoot.setup === 'function'
                ? NuxtRoot.setup(props, {
                    ...ctx,
                    expose: () => {},
                  })
                : undefined,
            registerCleanup,
          );
          onErrorCaptured((error, ...args) => {
            if (isMountSettled) return;
            isMountSettled = true;
            try {
              wrappedInstance?.appContext.config.errorHandler?.(error, ...args);
              reject(error);
            } catch (error) {
              reject(error);
            }
            return false;
          });
          return nuxtRootSetupResult;
        },
        render: wrappedRender(() =>
          h(
            Suspense,
            {
              onResolve: () =>
                nextTick().then(() => {
                  if (isMountSettled) return;
                  isMountSettled = true;
                  const typedWrapper = wrapper as TWrapper & { setupState: SetupState };
                  typedWrapper.setupState = setupState;
                  const maybeUnmount = typedWrapper as { unmount?: () => void };
                  if (typeof maybeUnmount.unmount === 'function') {
                    registerCleanup(() => {
                      try {
                        maybeUnmount.unmount?.();
                      } catch {
                        /* already unmounted */
                      }
                    });
                  }
                  resolve({
                    wrapper: typedWrapper,
                    setProps: (props: Record<string, unknown>) => {
                      Object.assign(setProps, props);
                    },
                    cleanup,
                  });
                }),
            },
            { default: () => h(SuspendedHelper) },
          ),
        ),
      },
      {
        ...wrapperFnOptions,
        global: mergeComponentMountingGlobalOptions(wrapperFnOptions.global, {
          config: { globalProperties },
          directives: vueApp._context.directives,
          provide: vueApp._context.provides,
          stubs: {
            Suspense: false,
            [SuspendedHelper.name]: false,
            [ClonedComponent.name]: false,
          },
          components: {
            ...vueApp._context.components,
            ...(stubRouterLink ? { RouterLink } : {}),
          },
        }),
      },
    );
  });
}
function mergeComponentMountingGlobalOptions(
  options: MountGlobalOptions = {},
  defaults: MountGlobalOptions = {},
): MountGlobalOptions {
  const compilerOptions = {
    ...defaults.config?.compilerOptions,
    ...options.config?.compilerOptions,
  };
  return {
    ...options,
    mixins: [...(defaults.mixins || []), ...(options.mixins || [])],
    stubs: {
      ...defaults.stubs,
      ...(Array.isArray(options.stubs)
        ? Object.fromEntries(options.stubs.map((n) => [n, true]))
        : options.stubs),
    },
    plugins: [...(defaults.plugins || []), ...(options.plugins || [])],
    components: {
      ...defaults.components,
      ...options.components,
    },
    provide: {
      ...defaults.provide,
      ...options.provide,
    },
    mocks: {
      ...defaults.mocks,
      ...options.mocks,
    },
    config: {
      ...defaults.config,
      ...options.config,
      ...(Object.keys(compilerOptions).length ? { compilerOptions } : void 0),
      globalProperties: {
        ...defaults.config?.globalProperties,
        ...options.config?.globalProperties,
      } as NonNullable<NonNullable<MountGlobalOptions['config']>['globalProperties']>,
    },
    directives: {
      ...defaults.directives,
      ...options.directives,
    },
  };
}
function makeAllPropertiesEnumerable(target: Record<string, unknown>): Record<string, unknown> {
  return {
    ...target,
    ...Object.fromEntries(Object.getOwnPropertyNames(target).map((key) => [key, target[key]])),
  };
}
//#endregion
export { cleanupAll, patchWrapperSetProps, wrapperSuspended };
