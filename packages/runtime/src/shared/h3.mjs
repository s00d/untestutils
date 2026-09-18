//#region src/runtime/shared/h3.ts
function defineEventHandler(handler) {
	return Object.assign(handler, { __is_handler__: true });
}
//#endregion
export { defineEventHandler };
