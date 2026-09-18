import { deepCopy, loadKit, applyEnv } from "./utils.mjs";
import { createDefu, defu as defu$1 } from "defu";
import { resolveModulePath } from "exsolve";
import process from "node:process";
import { version } from "vitest/node";
import { setupDotenv } from "c12";
import { getPackageInfoSync } from "local-pkg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";

function resolveRuntime(sub) {
	// Prefer the dedicated runtime package export (dist), then the published
	// facade, before falling back to the monorepo source tree.
	for (const id of [`@untestutils/runtime/${sub}`, `untestutils/runtime/${sub}`]) {
		const resolved = resolveModulePath(id, { from: import.meta.url, try: true });
		if (resolved) return resolved;
	}
	const local = join(dirname(fileURLToPath(import.meta.url)), "../../runtime/src", sub);
	const withExt = [local, `${local}.mjs`, `${local}.ts`, join(local, "index.mjs")];
	for (const candidate of withExt) {
		try {
			return resolveModulePath(candidate, { try: true }) || candidate;
		} catch {
			/* continue */
		}
	}
	return local.endsWith(".mjs") ? local : `${local}.mjs`;
}

/** Resolve Vitest custom environment to a concrete module path (works without a separate published package). */
function resolveVitestEnvironment() {
	const fromPkg = resolveModulePath("vitest-environment-untestutils", { from: import.meta.url, try: true });
	if (fromPkg) return fromPkg;
	const fromFacade = resolveModulePath("untestutils/vitest-environment", { from: import.meta.url, try: true });
	if (fromFacade) return fromFacade;
	try {
		return fileURLToPath(new URL("../../vitest-environment-untestutils/index.mjs", import.meta.url));
	} catch {
		return "untestutils";
	}
}

function warnIfE2ePluginMixed(config) {
	const plugins = config.plugins || [];
	// e2e harness vite plugin is named exactly `untestutils` (see packages/vitest/src/plugin.ts)
	const hasE2e = plugins.some((p) => p && typeof p === "object" && "name" in p && p.name === "untestutils");
	const env = config.test?.environment;
	const isUnit =
		env === "untestutils" ||
		(typeof env === "string" &&
			(env.includes("vitest-environment-untestutils") || env.endsWith("vitest-environment.mjs")));
	if (hasE2e && isUnit) {
		console.warn(
			"[untestutils] Do not mix `untestutils/vitest/plugin` (e2e harness) with `environment: 'untestutils'` (unit) in the same Vitest project. Use separate projects.",
		);
	}
}
//#region src/module/plugins/options.ts
const PLUGIN_NAME = "untestutils:vitest:environment-options";
const STUB_ID = "untestutils-vitest-environment-options";
function NuxtVitestEnvironmentOptionsPlugin(environmentOptions = {}) {
	return {
		name: PLUGIN_NAME,
		enforce: "pre",
		resolveId(id) {
			if (id.endsWith(STUB_ID)) return STUB_ID;
		},
		load(id) {
			if (id.endsWith(STUB_ID)) return `export default ${JSON.stringify(environmentOptions || {})}`;
		}
	};
}
//#endregion
//#region src/config.ts
async function startNuxtAndGetViteConfig(rootDir = process.cwd(), options = {}) {
	const { buildNuxt, loadNuxt } = await loadKit(rootDir);
	const nuxt = await loadNuxt({
		cwd: rootDir,
		dev: options.nitroEnvironment || (options.overrides?.dev ?? false),
		dotenv: defu$1(options.dotenv, {
			cwd: rootDir,
			fileName: ".env.test"
		}),
		defaults: { compatibilityDate: "2024-04-03" },
		overrides: defu$1({
			appId: "nuxt-app",
			buildId: "test",
			ssr: false,
			test: true,
			modules: ["untestutils/module"],
			// Avoid missing `#app-manifest` virtual when buildId/dev diverge from prepare
			experimental: { appManifest: false },
		}, options.overrides, options.nitroEnvironment ? {} : DISABLE_NITRO_ENVIRONMENT)
	});
	if (!nuxt.options._installedModules.find((i) => i?.meta?.name === "untestutils")) throw new Error("Failed to load `untestutils/module`. You may need to add it to your nuxt.config.");
	const nitro = options.nitroEnvironment ? {} : void 0;
	if (nitro) nuxt.hook("nitro:init", (instance) => {
		nitro.current = instance;
	});
	return new Promise((resolve, reject) => {
		nuxt.hook("vite:configResolved", (viteConfig, { isClient }) => {
			if (isClient) {
				resolve({
					nuxt,
					viteConfig,
					nitro
				});
				throw new Error("_stop_");
			}
		});
		buildNuxt(nuxt).catch((err) => {
			if (!err.toString().includes("_stop_")) reject(err);
		});
	}).finally(() => nuxt.close());
}
const DISABLE_NITRO_ENVIRONMENT = { experimental: { nitroViteEnvironment: false } };
function nitroTeardownPlugin(nitro) {
	let closed;
	return {
		name: "untestutils:nitro-teardown",
		async closeBundle() {
			closed ||= nitro.current?.hooks.callHook("close") ?? Promise.resolve();
			await closed;
		}
	};
}
const excludedPlugins = [
	"nuxt:import-protection",
	"nuxt:import-conditions",
	"nuxt:devtools:rpc",
	"nuxt:devtools:config-retriever",
	"vite-plugin-checker",
	"vite-plugin-inspect",
	"vite-plugin-vue-tracer"
];
async function getVitestConfigFromNuxt(options, loadNuxtOptions = {}) {
	const { rootDir = process.cwd(), ..._overrides } = loadNuxtOptions.overrides || {};
	if (!options) options = await startNuxtAndGetViteConfig(rootDir, {
		dotenv: loadNuxtOptions.dotenv,
		nitroEnvironment: loadNuxtOptions.nitroEnvironment,
		overrides: {
			test: true,
			..._overrides
		}
	});
	delete options.viteConfig.root;
	options.viteConfig.plugins = (options.viteConfig.plugins || []).filter((p) => !p || !("name" in p) || !excludedPlugins.includes(p.name));
	const nuxtServerIntegration = getPackageInfoSync("@nuxt/nitro-server", { paths: [options.nuxt.options.appDir] });
	let nitroPath;
	for (const nitroCandidate of [...nuxtServerIntegration?.packageJson.dependencies?.nitro ? ["nitro", "nitro-nightly"] : ["nitropack", "nitropack-nightly"]]) {
		nitroPath = resolveModulePath(nitroCandidate, {
			from: nuxtServerIntegration?.rootPath || options.nuxt.options.appDir,
			try: true
		});
		if (nitroPath) break;
	}
	const projectH3Path = resolveModulePath("h3/package.json", {
		from: rootDir,
		try: true
	});
	const h3Info = (projectH3Path ? getPackageInfoSync("h3", { paths: [projectH3Path] }) : void 0) || getPackageInfoSync("h3", { paths: nitroPath ? [nitroPath] : options.nuxt.options.modulesDir });
	const resolvedConfig = defu$1({
		define: {
			"process.env.NODE_ENV": "\"test\"",
			"__NUXT_VITEST_RESOLVED__": "true"
		},
		resolve: { alias: {
			"@vue/devtools-kit": resolveRuntime("mocks/vue-devtools"),
			"@vue/devtools-core": resolveRuntime("mocks/vue-devtools")
		} },
		optimizeDeps: { noDiscovery: true },
		test: {
			environmentOptions: {
				nuxtRuntimeConfig: applyEnv(deepCopy(options.nuxt.options.runtimeConfig), {
					prefix: "NUXT_",
					env: await setupDotenv(defu$1(loadNuxtOptions.dotenv, {
						cwd: rootDir,
						fileName: ".env.test"
					}))
				}),
				nuxtRouteRules: defu$1({}, options.nuxt.options.routeRules, options.nuxt.options.nitro?.routeRules),
				nuxtAppConfig: {
					rootAttrs: options.nuxt.options.app.rootAttrs,
					rootTag: options.nuxt.options.app.rootTag,
					teleportAttrs: options.nuxt.options.app.teleportAttrs,
					teleportTag: options.nuxt.options.app.teleportTag
				}
			},
			server: { deps: { inline: [
				/\/node_modules\/(.*\/)?(nuxt|nuxt3|nuxt-nightly)\//,
				/^#/,
				"untestutils",
				"@untestutils/runtime",
				"@untestutils/config",
				"@untestutils/module",
				"vitest-environment-untestutils",
				...options.nuxt.options.build.transpile.filter((r) => typeof r === "string" || r instanceof RegExp)
			] } },
			deps: { optimizer: { client: { enabled: false } } }
		}
	}, {
		server: { middlewareMode: false },
		plugins: [
			{
				name: "disable-auto-execute",
				enforce: "pre",
				transform(code, id) {
					if (id.match(/nuxt(3|-nightly)?\/.*\/entry\./)) return code.replace(/(?<!vueAppPromise = )entry\(\)/, "Promise.resolve()");
				}
			},
			...options.nitro ? [nitroTeardownPlugin(options.nitro)] : [],
			{
				name: "untestutils:browser-conditions",
				enforce: "pre",
				config() {
					return { resolve: { conditions: [
						"web",
						"import",
						"module",
						"default"
					] } };
				},
				configResolved(config) {
					if (config.ssr.resolve?.conditions) config.ssr.resolve.conditions = config.ssr.resolve.conditions.filter((x) => x !== "import");
				}
			}
		]
	}, options.viteConfig, { test: { environmentOptions: { nuxt: {
		rootId: options.nuxt.options.app.rootAttrs?.id || void 0,
		h3Version: h3Info?.version?.startsWith("2.") ? 2 : 1,
		mock: {
			intersectionObserver: true,
			indexedDb: false
		}
	} } } });
	delete resolvedConfig.define["process.browser"];
	delete resolvedConfig.customLogger;
	delete resolvedConfig.ssr;
	if (!Array.isArray(resolvedConfig.test.setupFiles)) resolvedConfig.test.setupFiles = [resolvedConfig.test.setupFiles].filter(Boolean);
	resolvedConfig.test.setupFiles.unshift(resolveRuntime("entry"));
	return resolvedConfig;
}
const vitestMajor = Number(version.split(".")[0]);
const optOutOfExtends = false;
async function defineVitestProject(config) {
	const resolvedConfig = await resolveConfig(defu$1({ test: { environment: resolveVitestEnvironment() } }, config));
	resolvedConfig.extends ??= optOutOfExtends;
	warnIfE2ePluginMixed(resolvedConfig);
	return resolvedConfig;
}
const defineViteConfig = (config) => config;
function defineVitestConfig(config = {}) {
	return defineViteConfig(async () => {
		const resolvedConfig = await resolveConfig(config);
		if (resolvedConfig.test.browser?.enabled) return resolvedConfig;
		if ("workspace" in resolvedConfig.test || "projects" in resolvedConfig.test) throw new Error("The `projects` option is not supported with `defineVitestConfig`. Instead, use `defineVitestProject` to define each workspace project that uses the Nuxt environment.");
		const unitEnvironment = resolveVitestEnvironment();
		const defaultEnvironment = resolvedConfig.test.environment || "node";
		const isUnitEnv = defaultEnvironment === "untestutils" || defaultEnvironment === unitEnvironment || String(defaultEnvironment).includes("vitest-environment-untestutils") || String(defaultEnvironment).includes("vitest-environment");
		if (!isUnitEnv) {
			const merge = createDefu((obj, key, value) => {
				if (Array.isArray(value) && Array.isArray(obj[key])) {
					obj[key] = [.../* @__PURE__ */ new Set([...value, ...obj[key]])];
					return true;
				}
			});
			const nuxtProject = merge({
				...resolvedConfig,
				extends: optOutOfExtends,
				test: {
					...resolvedConfig.test,
					name: "untestutils",
					environment: unitEnvironment,
					include: []
				}
			}, resolvedConfig);
			nuxtProject.test.include = ["**/*.{nuxt,untestutils}.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "{test,tests}/{nuxt,untestutils}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"];
			const defaultProject = merge({
				...resolvedConfig,
				extends: optOutOfExtends,
				test: {
					...resolvedConfig.test,
					name: defaultEnvironment,
					environment: defaultEnvironment,
					exclude: [
						"**/node_modules/**",
						"**/dist/**",
						"**/cypress/**",
						"**/.{idea,git,cache,output,temp}/**",
						"**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
						...nuxtProject.test.include
					]
				}
			}, resolvedConfig);
			delete resolvedConfig.test.name;
			delete resolvedConfig.test.environment;
			delete resolvedConfig.test.include;
			delete resolvedConfig.test.exclude;
			delete resolvedConfig.test.includeSource;
			delete defaultProject.test.includeSource;
			resolvedConfig.test.projects = [nuxtProject, defaultProject];
		} else {
			resolvedConfig.test.environment = unitEnvironment;
		}
		warnIfE2ePluginMixed(resolvedConfig);
		return resolvedConfig;
	});
}
function isCoverageEnabled(config) {
	if (config.test && "coverage" in config.test && config.test.coverage?.enabled) return true;
	return process.argv.some((arg) => arg === "--coverage" || arg === "--coverage.enabled" || arg === "--coverage=true" || arg === "--coverage.enabled=true");
}
async function resolveConfig(config) {
	const overrides = config.test?.environmentOptions?.nuxt?.overrides || {};
	overrides.rootDir = config.test?.environmentOptions?.nuxt?.rootDir;
	if (isCoverageEnabled(config)) {
		if (overrides.sourcemap === void 0) overrides.sourcemap = { client: true };
		else if (typeof overrides.sourcemap === "object" && overrides.sourcemap.client === void 0) overrides.sourcemap.client = true;
	}
	if (config.test?.setupFiles && !Array.isArray(config.test.setupFiles)) config.test.setupFiles = [config.test.setupFiles].filter(Boolean);
	const resolvedConfig = defu$1(config, await getVitestConfigFromNuxt(void 0, {
		dotenv: config.test?.environmentOptions?.nuxt?.dotenv,
		nitroEnvironment: config.test?.environmentOptions?.nuxt?.nitroEnvironment,
		overrides: deepCopy(overrides)
	}));
	resolvedConfig.plugins.push(NuxtVitestEnvironmentOptionsPlugin(resolvedConfig.test.environmentOptions));
	if (resolvedConfig.test.browser?.enabled) {
		if (vitestMajor >= 5) {
			delete resolvedConfig.optimizeDeps?.noDiscovery;
			resolvedConfig.optimizeDeps ??= {};
			resolvedConfig.optimizeDeps.include ??= [];
			resolvedConfig.optimizeDeps.include.push("@testing-library/vue", "h3-next/generic");
		}
		resolvedConfig.plugins.push({
			name: "untestutils:browser-client-environment",
			configEnvironment(name) {
				if (name === "client") return { dev: { moduleRunnerTransform: false } };
			}
		});
		if (resolvedConfig.test.environment === "untestutils") {
			resolvedConfig.test.setupFiles = Array.isArray(resolvedConfig.test.setupFiles) ? resolvedConfig.test.setupFiles : [resolvedConfig.test.setupFiles].filter(Boolean);
			try {
				resolvedConfig.test.setupFiles.unshift(resolveRuntime("browser-entry"));
			} catch { /* browser entry optional */ }
		}
	}
	return resolvedConfig;
}
//#endregion
export { defineVitestConfig, defineVitestProject, getVitestConfigFromNuxt };
