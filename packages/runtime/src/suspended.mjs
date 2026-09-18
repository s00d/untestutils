import { Suspense, effectScope, getCurrentInstance, h, nextTick, onErrorCaptured, reactive } from "vue";
import { vi } from "vitest";
import { defineComponent, h as h$1, tryUseNuxtApp, useNuxtApp, useRouter } from "#imports";
import NuxtRoot from "#build/root-component.mjs";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/runtime-utils/components/RouterLink.ts
function getUseLink(nuxtApp) {
	const linkComponent = nuxtApp.vueApp._context.components.RouterLink;
	if (!linkComponent || typeof linkComponent !== "object") return void 0;
	if (typeof linkComponent.useLink !== "function") return void 0;
	return linkComponent.useLink.bind(linkComponent);
}
const RouterLink = defineComponent({
	functional: true,
	props: {
		to: {
			type: [String, Object],
			required: true
		},
		custom: Boolean,
		replace: Boolean,
		activeClass: String,
		exactActiveClass: String,
		ariaCurrentValue: String
	},
	setup: (props, { slots }) => {
		const useLink = getUseLink(useNuxtApp());
		if (!useLink) {
			const navigate = () => {};
			const router = useRouter();
			return () => {
				const route = router.resolve(props.to);
				return props.custom ? slots.default?.({
					href: route.href,
					navigate,
					route
				}) : h$1("a", {
					href: route.href,
					onClick: (e) => {
						e.preventDefault();
					}
				}, slots);
			};
		}
		const link = useLink(props);
		return () => {
			const route = link.route.value;
			const href = link.href.value;
			const isActive = link.isActive.value;
			const isExactActive = link.isExactActive.value;
			return props.custom ? slots.default?.({
				href,
				navigate: link.navigate,
				route,
				isActive,
				isExactActive
			}) : h$1("a", {
				href,
				onClick: (e) => {
					e.preventDefault();
					return link.navigate(e);
				}
			}, slots);
		};
	}
});
//#endregion
//#region src/runtime-utils/utils/suspended.ts
var suspended_exports = /* @__PURE__ */ __exportAll({
	cleanupAll: () => cleanupAll,
	patchWrapperSetProps: () => patchWrapperSetProps,
	wrapperSuspended: () => wrapperSuspended
});
function resolveVueApp() {
	return tryUseNuxtApp()?.vueApp || globalThis.__unctx__.get("nuxt-app").tryUse().vueApp;
}
/**
* `wrapper.setProps` delegates to this `@vue/test-utils` internal when the wrapper is the mount
* root, which is the case for the component we mount around the suspended component.
*/
function patchWrapperSetProps(wrapper, setProps) {
	Object.assign(wrapper, { __setProps: setProps });
}
function cleanupAll() {
	for (const fn of (window.__cleanup || []).splice(0)) fn();
}
function addCleanup(fn) {
	window.__cleanup ||= [];
	window.__cleanup.push(fn);
}
function removeCleanup(fn) {
	const index = window.__cleanup?.indexOf(fn) ?? -1;
	if (index !== -1) window.__cleanup.splice(index, 1);
}
function runEffectScope(fn, register) {
	const scope = effectScope();
	register(() => scope.stop());
	return scope.run(fn);
}
function wrapperSuspended(component, options, { wrapperFn, wrappedRender = (fn) => fn, suspendedHelperName, clonedComponentName, stubRouterLink = true }) {
	const vueApp = resolveVueApp();
	const ownCleanups = [];
	function registerCleanup(fn) {
		ownCleanups.push(fn);
		addCleanup(fn);
	}
	function cleanup() {
		for (const fn of ownCleanups.splice(0)) {
			removeCleanup(fn);
			fn();
		}
	}
	const { props = {}, attrs = {} } = options;
	const { route = "/", scoped = false, spy = false, ...wrapperFnOptions } = options;
	const { render: componentRender, setup: componentSetup, ...componentRest } = component;
	let wrappedInstance = null;
	let setupContext;
	let setupState = {};
	const setProps = reactive({});
	function patchInstanceAppContext() {
		const app = getCurrentInstance()?.appContext.app;
		if (!app) return;
		for (const [key, value] of Object.entries(vueApp)) {
			if (key in app) continue;
			app[key] = value;
		}
	}
	const ClonedComponent = {
		components: {},
		...component,
		name: clonedComponentName,
		async setup(props, instanceContext) {
			const currentInstance = getCurrentInstance();
			if (currentInstance) currentInstance.emit = (event, ...args) => {
				setupContext.emit(event, ...args);
			};
			if (!componentSetup) return;
			let result = scoped ? await runEffectScope(() => componentSetup(props, setupContext), registerCleanup) : await componentSetup(props, setupContext);
			if (wrappedInstance?.exposed) instanceContext.expose(wrappedInstance.exposed);
			if (result && typeof result === "object") {
				if (spy) result = vi.mockObject(result, { spy: true });
				setupState = result;
			} else setupState = {};
			return result;
		}
	};
	const SuspendedHelper = {
		name: suspendedHelperName,
		render: () => "",
		async setup() {
			if (route) await useRouter().replace(route);
			return () => h(ClonedComponent, {
				...props,
				...setProps,
				...attrs
			}, setupContext.slots);
		}
	};
	return new Promise((resolve, reject) => {
		let isMountSettled = false;
		const wrapper = wrapperFn({
			inheritAttrs: false,
			__cssModules: componentRest.__cssModules,
			setup: (props, ctx) => {
				patchInstanceAppContext();
				wrappedInstance = getCurrentInstance();
				setupContext = ctx;
				const nuxtRootSetupResult = runEffectScope(() => NuxtRoot.setup(props, {
					...ctx,
					expose: () => {}
				}), registerCleanup);
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
			render: wrappedRender(() => h(Suspense, { onResolve: () => nextTick().then(() => {
				if (isMountSettled) return;
				isMountSettled = true;
				wrapper.setupState = setupState;
				resolve({
					wrapper,
					setProps: (props) => {
						Object.assign(setProps, props);
					},
					cleanup
				});
			}) }, { default: () => h(SuspendedHelper) }))
		}, {
			...wrapperFnOptions,
			global: mergeComponentMountingGlobalOptions(wrapperFnOptions.global, {
				config: { globalProperties: makeAllPropertiesEnumerable(vueApp.config.globalProperties) },
				directives: vueApp._context.directives,
				provide: vueApp._context.provides,
				stubs: {
					Suspense: false,
					[SuspendedHelper.name]: false,
					[ClonedComponent.name]: false
				},
				components: {
					...vueApp._context.components,
					...stubRouterLink ? { RouterLink } : {}
				}
			})
		});
	});
}
function mergeComponentMountingGlobalOptions(options = {}, defaults = {}) {
	const compilerOptions = {
		...defaults.config?.compilerOptions,
		...options.config?.compilerOptions
	};
	return {
		...options,
		mixins: [...defaults.mixins || [], ...options.mixins || []],
		stubs: {
			...defaults.stubs,
			...Array.isArray(options.stubs) ? Object.fromEntries(options.stubs.map((n) => [n, true])) : options.stubs
		},
		plugins: [...defaults.plugins || [], ...options.plugins || []],
		components: {
			...defaults.components,
			...options.components
		},
		provide: {
			...defaults.provide,
			...options.provide
		},
		mocks: {
			...defaults.mocks,
			...options.mocks
		},
		config: {
			...defaults.config,
			...options.config,
			...Object.keys(compilerOptions).length ? { compilerOptions } : void 0,
			globalProperties: {
				...defaults.config?.globalProperties,
				...options.config?.globalProperties
			}
		},
		directives: {
			...defaults.directives,
			...options.directives
		}
	};
}
function makeAllPropertiesEnumerable(target) {
	return {
		...target,
		...Object.fromEntries(Object.getOwnPropertyNames(target).map((key) => [key, target[key]]))
	};
}
//#endregion
export { wrapperSuspended as i, patchWrapperSetProps as n, suspended_exports as r, cleanupAll as t };
