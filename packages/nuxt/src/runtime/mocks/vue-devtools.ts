//#region src/runtime/mocks/vue-devtools.ts
const functions: never[] = [];
function createRpcServer(): void {}
const devtools: { init: () => void } = { init(): void {} };
function addCustomCommand(): void {}
function addCustomTab(): void {}
function onDevToolsClientConnected(): void {}
function onDevToolsConnected(): void {}
function removeCustomCommand(): void {}
function setupDevToolsPlugin(): void {}
//#endregion
export {
  addCustomCommand,
  addCustomTab,
  createRpcServer,
  devtools,
  functions,
  onDevToolsClientConnected,
  onDevToolsConnected,
  removeCustomCommand,
  setupDevToolsPlugin,
};
