export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.B60LGspD.js",app:"_app/immutable/entry/app.D116SCPh.js",imports:["_app/immutable/entry/start.B60LGspD.js","_app/immutable/chunks/BRDlt21X.js","_app/immutable/chunks/2-zpBAky.js","_app/immutable/entry/app.D116SCPh.js","_app/immutable/chunks/2-zpBAky.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
