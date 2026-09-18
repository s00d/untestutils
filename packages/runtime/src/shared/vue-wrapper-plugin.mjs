//#region src/runtime/shared/vue-wrapper-plugin.ts
const PLUGIN_NAME = "nuxt-test-utils";
const config = await import("@vue/test-utils").then((r) => r.config).catch(() => void 0);
function getVueWrapperPlugin() {
	if (!config) return { hasNuxtPage: () => false };
	const installed = config.plugins.VueWrapper.installedPlugins.find(({ options }) => options?._name === PLUGIN_NAME);
	if (installed) return installed.options;
	const options = createPluginOptions();
	config.plugins.VueWrapper.install((instance, options) => {
		options.addInstance(instance);
		return {};
	}, options);
	return options;
}
function createPluginOptions() {
	const options = {
		_name: PLUGIN_NAME,
		_instances: [],
		get instances() {
			const instances = [];
			options._instances = options._instances.filter((ref) => {
				const instance = ref.deref();
				if (!instance) return false;
				instances.push(instance);
				return true;
			});
			return instances;
		},
		addInstance(instance) {
			if (options.instances.includes(instance)) return;
			options._instances.push(new WeakRef(instance));
		},
		hasNuxtPage() {
			return options._hasComponent("NuxtPage");
		},
		_hasComponent(componentName) {
			return options.instances.some((v) => v.exists() && v.findComponent({ name: componentName }).exists());
		}
	};
	return options;
}
//#endregion
export { getVueWrapperPlugin };
