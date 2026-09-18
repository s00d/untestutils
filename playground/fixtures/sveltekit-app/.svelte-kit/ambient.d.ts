
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SVELTEKIT_FORK: string;
	export const UNTESTUTILS_DIR_NEXTSTATIC: string;
	export const UNTESTUTILS_HOST_NEXTSTATIC: string;
	export const MODE: string;
	export const FORCE_TTY: string;
	export const UNTESTUTILS_DIR_STATICSITE: string;
	export const UNTESTUTILS_RECIPES_MODULE: string;
	export const UNTESTUTILS_ARTIFACTS_DIR: string;
	export const UNTESTUTILS_DIR_ASTROSITE: string;
	export const UNTESTUTILS_BROWSER: string;
	export const UNTESTUTILS_BROWSERS: string;
	export const BASE_URL: string;
	export const UNTESTUTILS_PREWARM: string;
	export const VSCODE_CWD: string;
	export const VSCODE_L10N_BUNDLE_LOCATION: string;
	export const HF_TOKEN: string;
	export const rvm_bin_flag: string;
	export const MGFXC_WINE_PATH: string;
	export const AGENT_TRANSCRIPTS: string;
	export const rvm_ruby_bits: string;
	export const DISPLAY: string;
	export const SSR: string;
	export const rvm_delete_flag: string;
	export const ANDROID_NDK_HOME: string;
	export const INFOPATH: string;
	export const SHARP_IGNORE_GLOBAL_LIBVIPS: string;
	export const rvm_ruby_make_install: string;
	export const npm_config_user_agent: string;
	export const OSLogRateLimit: string;
	export const APPLE_API_KEY: string;
	export const VITEST_MODE: string;
	export const GEM_PATH: string;
	export const VSCODE_IPC_HOOK: string;
	export const npm_config_only_built_dependencies: string;
	export const rvm_only_path_flag: string;
	export const SDKMAN_DIR: string;
	export const rvm_alias_expanded: string;
	export const DEV: string;
	export const LESS: string;
	export const LOGNAME: string;
	export const APPLE_DEVELOPMENT_TEAM: string;
	export const UNTESTUTILS_HOST_VITESPA: string;
	export const rvm_ruby_url: string;
	export const rvm_ruby_configure: string;
	export const HOMEBREW_PREFIX: string;
	export const THEOS: string;
	export const OUT_DIR: string;
	export const rvm_ruby_mode: string;
	export const SHLVL: string;
	export const npm_lifecycle_event: string;
	export const rvm_pretty_print_flag: string;
	export const rvm_version: string;
	export const XPC_SERVICE_NAME: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const CURSOR_REQUEST_ID: string;
	export const rvm_sdk: string;
	export const rvm_script_name: string;
	export const rvm_system_flag: string;
	export const JAVA_HOME: string;
	export const UV_THREADPOOL_SIZE: string;
	export const rvm_nightly_flag: string;
	export const npm_config_node_gyp: string;
	export const CURSOR_SPAWN_CHAIN: string;
	export const npm_config__jsr_registry: string;
	export const UNTESTUTILS_HOST_ASTROSITE: string;
	export const npm_config_shamefully_hoist: string;
	export const PWD: string;
	export const COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
	export const UNTESTUTILS_HOST_STATICSITE: string;
	export const npm_lifecycle_script: string;
	export const npm_package_json: string;
	export const PATH: string;
	export const rvm_ruby_make: string;
	export const __CURSOR_SANDBOX_ENV_RESTORE: string;
	export const rvm_docs_type: string;
	export const SSH_AUTH_SOCK: string;
	export const npm_config_frozen_lockfile: string;
	export const APPLE_TEAM_ID: string;
	export const rvm_prefix: string;
	export const GEM_HOME: string;
	export const LANG: string;
	export const COMMAND_MODE: string;
	export const npm_config_catalog: string;
	export const HOMEBREW_CELLAR: string;
	export const FORCE_COLOR: string;
	export const rvm_silent_flag: string;
	export const npm_config_verify_deps_before_run: string;
	export const N_PREFIX: string;
	export const MACH_PORT_RENDEZVOUS_PEER_VALDATION: string;
	export const CURSOR_WORKSPACE_LABEL: string;
	export const APPLE_API_ISSUER: string;
	export const ANDROID_HOME: string;
	export const PAGER: string;
	export const rvm_ruby_file: string;
	export const MallocNanoZone: string;
	export const APPLE_API_KEY_PATH: string;
	export const LSCOLORS: string;
	export const npm_execpath: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_config__buf_registry: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const npm_config_strict_peer_dependencies: string;
	export const rvm_niceness: string;
	export const rvm_path: string;
	export const npm_config_registry: string;
	export const rvm_ruby_string: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const FPATH: string;
	export const CURSOR_AGENT_DISABLE_DEBUG_LOG: string;
	export const LS_COLORS: string;
	export const npm_config_recursive: string;
	export const __CFBundleIdentifier: string;
	export const USER: string;
	export const NODE_ENV: string;
	export const MY_RUBY_HOME: string;
	export const UNTESTUTILS_DIR_VITESPA: string;
	export const CURSOR_CONVERSATION_ID: string;
	export const APPLE_SIGNING_IDENTITY: string;
	export const TERM: string;
	export const npm_config_progress: string;
	export const VSCODE_PID: string;
	export const GOOGLE_CLOUD_PROJECT: string;
	export const NO_COLOR: string;
	export const rvm_ruby_global_gems_path: string;
	export const PROD: string;
	export const rvm_gemstone_package_file: string;
	export const rvm_hook: string;
	export const npm_config_auto_install_peers: string;
	export const rvm_sticky_flag: string;
	export const IRBRC: string;
	export const npm_package_name: string;
	export const npm_command: string;
	export const CURSOR_AGENT_STORE_SHARED_PATHS: string;
	export const PKG_CONFIG_PATH: string;
	export const HOMEBREW_REPOSITORY: string;
	export const CURSOR_LAYOUT: string;
	export const SHELL: string;
	export const NODE: string;
	export const RUBY_VERSION: string;
	export const TMPDIR: string;
	export const HOME: string;
	export const rvm_user_flag: string;
	export const npm_node_execpath: string;
	export const CURSOR_RIPGREP_PATH: string;
	export const CURSOR_AGENT: string;
	export const VSCODE_PROCESS_TITLE: string;
	export const VSCODE_NLS_CONFIG: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const OPENSSL_DIR: string;
	export const rvm_bin_path: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const rvm_quiet_flag: string;
	export const XPC_FLAGS: string;
	export const rvm_ruby_alias: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const CURSOR_SPAWNED_BY_EXTENSION_ID: string;
	export const CURSOR_AGENT_STORE_FILES_DIR: string;
	export const ZSH: string;
	export const rvm_file_name: string;
	export const INIT_CWD: string;
	export const rvm_use_flag: string;
	export const rvm_gemstone_url: string;
	export const COREPACK_ROOT: string;
	export const NODE_PATH: string;
	export const _ZO_DOCTOR: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SVELTEKIT_FORK: string;
		UNTESTUTILS_DIR_NEXTSTATIC: string;
		UNTESTUTILS_HOST_NEXTSTATIC: string;
		MODE: string;
		FORCE_TTY: string;
		UNTESTUTILS_DIR_STATICSITE: string;
		UNTESTUTILS_RECIPES_MODULE: string;
		UNTESTUTILS_ARTIFACTS_DIR: string;
		UNTESTUTILS_DIR_ASTROSITE: string;
		UNTESTUTILS_BROWSER: string;
		UNTESTUTILS_BROWSERS: string;
		BASE_URL: string;
		UNTESTUTILS_PREWARM: string;
		VSCODE_CWD: string;
		VSCODE_L10N_BUNDLE_LOCATION: string;
		HF_TOKEN: string;
		rvm_bin_flag: string;
		MGFXC_WINE_PATH: string;
		AGENT_TRANSCRIPTS: string;
		rvm_ruby_bits: string;
		DISPLAY: string;
		SSR: string;
		rvm_delete_flag: string;
		ANDROID_NDK_HOME: string;
		INFOPATH: string;
		SHARP_IGNORE_GLOBAL_LIBVIPS: string;
		rvm_ruby_make_install: string;
		npm_config_user_agent: string;
		OSLogRateLimit: string;
		APPLE_API_KEY: string;
		VITEST_MODE: string;
		GEM_PATH: string;
		VSCODE_IPC_HOOK: string;
		npm_config_only_built_dependencies: string;
		rvm_only_path_flag: string;
		SDKMAN_DIR: string;
		rvm_alias_expanded: string;
		DEV: string;
		LESS: string;
		LOGNAME: string;
		APPLE_DEVELOPMENT_TEAM: string;
		UNTESTUTILS_HOST_VITESPA: string;
		rvm_ruby_url: string;
		rvm_ruby_configure: string;
		HOMEBREW_PREFIX: string;
		THEOS: string;
		OUT_DIR: string;
		rvm_ruby_mode: string;
		SHLVL: string;
		npm_lifecycle_event: string;
		rvm_pretty_print_flag: string;
		rvm_version: string;
		XPC_SERVICE_NAME: string;
		pnpm_config_verify_deps_before_run: string;
		CURSOR_REQUEST_ID: string;
		rvm_sdk: string;
		rvm_script_name: string;
		rvm_system_flag: string;
		JAVA_HOME: string;
		UV_THREADPOOL_SIZE: string;
		rvm_nightly_flag: string;
		npm_config_node_gyp: string;
		CURSOR_SPAWN_CHAIN: string;
		npm_config__jsr_registry: string;
		UNTESTUTILS_HOST_ASTROSITE: string;
		npm_config_shamefully_hoist: string;
		PWD: string;
		COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
		UNTESTUTILS_HOST_STATICSITE: string;
		npm_lifecycle_script: string;
		npm_package_json: string;
		PATH: string;
		rvm_ruby_make: string;
		__CURSOR_SANDBOX_ENV_RESTORE: string;
		rvm_docs_type: string;
		SSH_AUTH_SOCK: string;
		npm_config_frozen_lockfile: string;
		APPLE_TEAM_ID: string;
		rvm_prefix: string;
		GEM_HOME: string;
		LANG: string;
		COMMAND_MODE: string;
		npm_config_catalog: string;
		HOMEBREW_CELLAR: string;
		FORCE_COLOR: string;
		rvm_silent_flag: string;
		npm_config_verify_deps_before_run: string;
		N_PREFIX: string;
		MACH_PORT_RENDEZVOUS_PEER_VALDATION: string;
		CURSOR_WORKSPACE_LABEL: string;
		APPLE_API_ISSUER: string;
		ANDROID_HOME: string;
		PAGER: string;
		rvm_ruby_file: string;
		MallocNanoZone: string;
		APPLE_API_KEY_PATH: string;
		LSCOLORS: string;
		npm_execpath: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_config__buf_registry: string;
		VSCODE_CODE_CACHE_PATH: string;
		npm_config_strict_peer_dependencies: string;
		rvm_niceness: string;
		rvm_path: string;
		npm_config_registry: string;
		rvm_ruby_string: string;
		PNPM_SCRIPT_SRC_DIR: string;
		FPATH: string;
		CURSOR_AGENT_DISABLE_DEBUG_LOG: string;
		LS_COLORS: string;
		npm_config_recursive: string;
		__CFBundleIdentifier: string;
		USER: string;
		NODE_ENV: string;
		MY_RUBY_HOME: string;
		UNTESTUTILS_DIR_VITESPA: string;
		CURSOR_CONVERSATION_ID: string;
		APPLE_SIGNING_IDENTITY: string;
		TERM: string;
		npm_config_progress: string;
		VSCODE_PID: string;
		GOOGLE_CLOUD_PROJECT: string;
		NO_COLOR: string;
		rvm_ruby_global_gems_path: string;
		PROD: string;
		rvm_gemstone_package_file: string;
		rvm_hook: string;
		npm_config_auto_install_peers: string;
		rvm_sticky_flag: string;
		IRBRC: string;
		npm_package_name: string;
		npm_command: string;
		CURSOR_AGENT_STORE_SHARED_PATHS: string;
		PKG_CONFIG_PATH: string;
		HOMEBREW_REPOSITORY: string;
		CURSOR_LAYOUT: string;
		SHELL: string;
		NODE: string;
		RUBY_VERSION: string;
		TMPDIR: string;
		HOME: string;
		rvm_user_flag: string;
		npm_node_execpath: string;
		CURSOR_RIPGREP_PATH: string;
		CURSOR_AGENT: string;
		VSCODE_PROCESS_TITLE: string;
		VSCODE_NLS_CONFIG: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		OPENSSL_DIR: string;
		rvm_bin_path: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		rvm_quiet_flag: string;
		XPC_FLAGS: string;
		rvm_ruby_alias: string;
		VSCODE_ESM_ENTRYPOINT: string;
		CURSOR_SPAWNED_BY_EXTENSION_ID: string;
		CURSOR_AGENT_STORE_FILES_DIR: string;
		ZSH: string;
		rvm_file_name: string;
		INIT_CWD: string;
		rvm_use_flag: string;
		rvm_gemstone_url: string;
		COREPACK_ROOT: string;
		NODE_PATH: string;
		_ZO_DOCTOR: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
