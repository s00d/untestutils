// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['untestutils/module'],
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 },
  runtimeConfig: {
    public: {
      appName: 'unit-app',
    },
  },
});
