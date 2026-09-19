//#region src/runtime/shared/vue-wrapper-plugin.ts
import type { VueWrapper } from '@vue/test-utils';

const PLUGIN_NAME = 'nuxt-test-utils';
const config = await import('@vue/test-utils').then((r) => r.config).catch(() => void 0);
type VueWrapperPluginOptions = {
  _name: typeof PLUGIN_NAME;
  _instances: WeakRef<VueWrapper>[];
  readonly instances: VueWrapper[];
  addInstance: (instance: VueWrapper) => void;
  hasNuxtPage: () => boolean;
  _hasComponent: (componentName: string) => boolean;
};

function getVueWrapperPlugin(): Pick<VueWrapperPluginOptions, 'hasNuxtPage'> {
  if (!config) return { hasNuxtPage: () => false };
  const installed = config.plugins.VueWrapper.installedPlugins.find(
    ({ options }) => (options as Partial<VueWrapperPluginOptions> | undefined)?._name === PLUGIN_NAME,
  );
  if (installed) return installed.options as VueWrapperPluginOptions;
  const options = createPluginOptions();
  config.plugins.VueWrapper.install((instance, options) => {
    options.addInstance(instance);
    return {};
  }, options);
  return options;
}
function createPluginOptions(): VueWrapperPluginOptions {
  const options: VueWrapperPluginOptions = {
    _name: PLUGIN_NAME,
    _instances: [],
    get instances(): VueWrapper[] {
      const instances: VueWrapper[] = [];
      options._instances = options._instances.filter((ref) => {
        const instance = ref.deref();
        if (!instance) return false;
        instances.push(instance);
        return true;
      });
      return instances;
    },
    addInstance(instance: VueWrapper): void {
      if (options.instances.includes(instance)) return;
      options._instances.push(new WeakRef(instance));
    },
    hasNuxtPage(): boolean {
      return options._hasComponent('NuxtPage');
    },
    _hasComponent(componentName: string): boolean {
      return options.instances.some(
        (v) => v.exists() && v.findComponent({ name: componentName }).exists(),
      );
    },
  };
  return options;
}
//#endregion
export { getVueWrapperPlugin };
