import { _t as FILENAME } from "../../chunks/server.js";
//#region ../../../node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.1_@sveltejs+vite-plugin-svelte@6.2.4_svelte_2b2babbf5ece9fe3066cfe4cc64131f7/node_modules/@sveltejs/kit/src/runtime/components/svelte-5/layout.svelte
Layout[FILENAME] = "/Users/s00d/Downloads/untestutils/node_modules/.pnpm/@sveltejs+kit@2.70.3_@opentelemetry+api@1.9.1_@sveltejs+vite-plugin-svelte@6.2.4_svelte_2b2babbf5ece9fe3066cfe4cc64131f7/node_modules/@sveltejs/kit/src/runtime/components/svelte-5/layout.svelte";
function Layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { children } = $$props;
		children($$renderer);
		$$renderer.push(`<!---->`);
	}, Layout);
}
Layout.render = function() {
	throw new Error("Component.render(...) is no longer valid in Svelte 5. See https://svelte.dev/docs/svelte/v5-migration-guide#Components-are-no-longer-classes for more information");
};
//#endregion
export { Layout as default };
