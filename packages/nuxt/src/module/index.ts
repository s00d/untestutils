/**
 * untestutils Nuxt module (`untestutils/module`).
 *
 * Hybrid port of the unit-lifecycle parts of `@nuxt/test-utils/module`:
 *  - the `mockNuxtImport` / `unmockNuxtImport` / `mockComponent` macro transform
 *  - the Nuxt root stub used by `mountSuspended` / `renderSuspended`
 *  - the type + test-file plumbing needed to run in-process Nuxt tests
 *
 * The devtools UI, install wizard and Vitest process wrapper from upstream are
 * intentionally omitted — they are DX conveniences, not part of the runtime
 * unit lifecycle.
 */
import { extname, dirname, join, relative } from 'pathe';
import { readFileSync } from 'node:fs';
import { addVitePlugin, defineNuxtModule, resolveIgnorePatterns, resolvePath } from '@nuxt/kit';
import type { Nuxt, NuxtHooks, Component, NuxtModule } from '@nuxt/schema';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';
import { createUnplugin } from 'unplugin';
import { fileURLToPath } from 'node:url';
import type {
  CallExpression,
  Expression,
  ExpressionStatement,
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  Literal,
  Node,
  SpreadElement,
} from 'estree';
import type { AstNode } from 'rollup';
import type { Import } from 'unimport';
import type { Plugin, ResolvedConfig } from 'vite';

//#region mock transform plugin
const PLUGIN_NAME = 'untestutils:mock-transform';
const HELPER_MOCK_IMPORT = 'mockNuxtImport';
const HELPER_UNMOCK_IMPORT = 'unmockNuxtImport';
const HELPER_MOCK_COMPONENT = 'mockComponent';
const HELPER_MOCK_HOIST = '__NUXT_VITEST_MOCKS';
const HELPER_MOCK_HOIST_FNS = '__NUXT_VITEST_MOCK_FNS';
const HELPER_MOCK_HOIST_ORIGINAL = '__NUXT_VITEST_MOCKS_ORIGINAL';
const HELPER_MOCK_HOIST_PREVIOUS = '__NUXT_VITEST_MOCKS_PREVIOUS';
const HELPERS_NAME = [HELPER_MOCK_IMPORT, HELPER_UNMOCK_IMPORT, HELPER_MOCK_COMPONENT];

interface MockPluginContext {
  imports: Import[];
  components: Component[];
}

type MockComponent = { path: string; factory: string };

/**
 * Rewrite mockNuxtImport / unmockNuxtImport to runtime registry mutations.
 *
 * Upstream bakes factories into a hoisted `vi.mock` and emits `vi.unmock` for
 * restores. That cancels the mock for the whole file, so mock+unmock cannot
 * coexist in one spec. We keep a mutable `globalThis` export object and apply
 * / restore per call site instead — no `vi.unmock`.
 */
const createMockPlugin = (ctx: MockPluginContext) =>
  createUnplugin(() => {
    return {
      name: PLUGIN_NAME,
      enforce: 'post',
      vite: {
        transform(code: string, id: string) {
          if (!HELPERS_NAME.some((n) => code.includes(n))) return;
          if (id.includes('/node_modules/')) return;
          let ast: AstNode;
          try {
            ast = this.parse(code) as AstNode;
          } catch {
            return;
          }
          let insertionPoint = 0;
          let hasViImport = false;
          const s = new MagicString(code);
          const mockModules = new Set<string>();
          const mocksComponent: MockComponent[] = [];
          const importPathsList = new Set<string>();
          let touchedImportHelpers = false;
          // @ts-expect-error mismatch between acorn/estree types
          walk(ast, {
            enter: (node: Node, parent: Node | null) => {
              const overwriteCall = (replacement: string): void => {
                s.overwrite(
                  isExpressionStatement(parent) ? startOf(parent) : startOf(node),
                  isExpressionStatement(parent) ? endOf(parent) : endOf(node),
                  replacement,
                );
              };
              const removeCallExpression = (start: Node, end: Node = start): void => {
                s.overwrite(
                  isExpressionStatement(parent) ? startOf(parent) : startOf(start),
                  isExpressionStatement(parent) ? endOf(parent) : endOf(end),
                  '',
                );
              };
              const parseMockImportTarget = (
                importTarget: Expression | SpreadElement,
                helperName: string,
              ): {
                name: string;
                importItem?: Import;
              } => {
                const name = isLiteral(importTarget)
                  ? importTarget.value
                  : isIdentifier(importTarget)
                    ? importTarget.name
                    : undefined;
                if (typeof name !== 'string')
                  return this.error(
                    new Error(
                      `The first argument of ${helperName}() must be a string literal or mocked target`,
                    ),
                    startOf(importTarget),
                  );
                return {
                  name,
                  importItem: ctx.imports.find((_) => name === (_.as || _.name)),
                };
              };
              if (isImportDeclaration(node)) {
                if (node.source.value === 'vitest' && !hasViImport) {
                  if (
                    node.specifiers.find(
                      (i) =>
                        isImportSpecifier(i) &&
                        i.imported.type === 'Identifier' &&
                        i.imported.name === 'vi',
                    )
                  ) {
                    insertionPoint = endOf(node);
                    hasViImport = true;
                  }
                  return;
                }
              }
              if (!isCallExpression(node)) return;
              if (isIdentifier(node.callee) && node.callee.name === HELPER_MOCK_IMPORT) {
                if (node.arguments.length !== 2)
                  return this.error(
                    new Error(`${HELPER_MOCK_IMPORT}() should have exactly 2 arguments`),
                    startOf(node),
                  );
                const { name, importItem } = parseMockImportTarget(
                  node.arguments[0],
                  HELPER_MOCK_IMPORT,
                );
                if (!importItem) return this.error(`Cannot find import "${name}" to mock`);
                const factoryCode = code.slice(
                  startOf(node.arguments[1]),
                  endOf(node.arguments[1]),
                );
                const quotedFrom = JSON.stringify(importItem.from);
                const quotedName = JSON.stringify(importItem.name);
                overwriteCall(
                  `(() => {` +
                    ` const __from = ${quotedFrom};` +
                    ` const __name = ${quotedName};` +
                    ` const __factory = (${factoryCode});` +
                    ` globalThis.${HELPER_MOCK_HOIST_FNS} ??= {};` +
                    ` (globalThis.${HELPER_MOCK_HOIST_FNS}[__from] ??= {})[__name] = __factory;` +
                    ` const __entry = globalThis.${HELPER_MOCK_HOIST}?.[__from];` +
                    ` if (__entry) {` +
                    `   const __value = __factory(__entry.${HELPER_MOCK_HOIST_ORIGINAL}[__name]);` +
                    `   if (__value != null && typeof __value.then === 'function')` +
                    `     throw new Error('mockNuxtImport() factory must be synchronous once the import module is loaded');` +
                    `   __entry[__name] = __value;` +
                    `   __entry.${HELPER_MOCK_HOIST_PREVIOUS}[__name] = __value;` +
                    ` }` +
                    ` })()`,
                );
                mockModules.add(importItem.from);
                touchedImportHelpers = true;
              }
              if (isIdentifier(node.callee) && node.callee.name === HELPER_UNMOCK_IMPORT) {
                if (node.arguments.length !== 1)
                  return this.error(
                    new Error(`${HELPER_UNMOCK_IMPORT}() should have exactly 1 argument`),
                    startOf(node),
                  );
                const { name, importItem } = parseMockImportTarget(
                  node.arguments[0],
                  HELPER_UNMOCK_IMPORT,
                );
                if (!importItem) return this.error(`Cannot find import "${name}" to unmock`);
                const quotedFrom = JSON.stringify(importItem.from);
                const quotedName = JSON.stringify(importItem.name);
                overwriteCall(
                  `(() => {` +
                    ` const __from = ${quotedFrom};` +
                    ` const __name = ${quotedName};` +
                    ` globalThis.${HELPER_MOCK_HOIST_FNS} ??= {};` +
                    ` (globalThis.${HELPER_MOCK_HOIST_FNS}[__from] ??= {})[__name] = null;` +
                    ` const __entry = globalThis.${HELPER_MOCK_HOIST}?.[__from];` +
                    ` if (__entry) {` +
                    `   __entry[__name] = __entry.${HELPER_MOCK_HOIST_ORIGINAL}[__name];` +
                    `   delete __entry.${HELPER_MOCK_HOIST_PREVIOUS}[__name];` +
                    ` }` +
                    ` })()`,
                );
                touchedImportHelpers = true;
              }
              if (isIdentifier(node.callee) && node.callee.name === HELPER_MOCK_COMPONENT) {
                if (node.arguments.length !== 2)
                  return this.error(
                    new Error(`${HELPER_MOCK_COMPONENT}() should have exactly 2 arguments`),
                    startOf(node),
                  );
                const componentName = node.arguments[0];
                if (!isLiteral(componentName) || typeof componentName.value !== 'string')
                  return this.error(
                    new Error(
                      `The first argument of ${HELPER_MOCK_COMPONENT}() must be a string literal`,
                    ),
                    startOf(componentName),
                  );
                const pathOrName = componentName.value;
                const path =
                  ctx.components.find(
                    (_) => _.pascalName === pathOrName || _.kebabName === pathOrName,
                  )?.filePath || pathOrName;
                removeCallExpression(node.arguments[1]);
                mocksComponent.push({
                  path,
                  factory: code.slice(startOf(node.arguments[1]), endOf(node.arguments[1])),
                });
              }
            },
          });
          if (!touchedImportHelpers && mocksComponent.length === 0) return;
          const mockLines: string[] = [];
          for (const from of mockModules) {
            importPathsList.add(from);
            const quotedFrom = JSON.stringify(from);
            const mockModuleEntry = `globalThis.${HELPER_MOCK_HOIST}[${quotedFrom}]`;
            const fnsEntry = `globalThis.${HELPER_MOCK_HOIST_FNS}?.[${quotedFrom}]`;
            mockLines.push(
              `vi.mock(${quotedFrom}, async (importOriginal) => {`,
              `  if (!${mockModuleEntry}) {`,
              `    const original = await importOriginal()`,
              `    const previous = {}`,
              `    ${mockModuleEntry} = { ...original, ...previous }`,
              `    ${mockModuleEntry}.${HELPER_MOCK_HOIST_ORIGINAL} = { ...original }`,
              `    ${mockModuleEntry}.${HELPER_MOCK_HOIST_PREVIOUS} = { ...previous }`,
              `  }`,
              `  const __fns = ${fnsEntry} ?? {}`,
              `  for (const __name of Object.keys(__fns)) {`,
              `    const __factory = __fns[__name]`,
              `    const __original = ${mockModuleEntry}.${HELPER_MOCK_HOIST_ORIGINAL}[__name]`,
              `    if (__factory == null) {`,
              `      ${mockModuleEntry}[__name] = __original`,
              `      delete ${mockModuleEntry}.${HELPER_MOCK_HOIST_PREVIOUS}[__name]`,
              `    } else {`,
              `      ${mockModuleEntry}[__name] = await __factory(__original)`,
              `      ${mockModuleEntry}.${HELPER_MOCK_HOIST_PREVIOUS}[__name] = ${mockModuleEntry}[__name]`,
              `    }`,
              `  }`,
              `  return ${mockModuleEntry}`,
              `});`,
            );
          }
          if (mocksComponent.length)
            mockLines.push(
              ...mocksComponent.flatMap((mock) => {
                return [
                  `vi.mock(${JSON.stringify(mock.path)}, async () => {`,
                  `  const factory = (${mock.factory});`,
                  `  const result = typeof factory === 'function' ? await factory() : await factory`,
                  `  return 'default' in result ? result : { default: result }`,
                  '});',
                ];
              }),
            );
          if (!mockLines.length && !touchedImportHelpers) return;
          s.appendLeft(
            insertionPoint,
            [
              ``,
              `vi.hoisted(() => {`,
              `  if(!globalThis.${HELPER_MOCK_HOIST}){`,
              `    vi.stubGlobal(${JSON.stringify(HELPER_MOCK_HOIST)}, {})`,
              `  }`,
              `  if(!globalThis.${HELPER_MOCK_HOIST_FNS}){`,
              `    vi.stubGlobal(${JSON.stringify(HELPER_MOCK_HOIST_FNS)}, {})`,
              `  }`,
              `});`,
              ``,
            ].join('\n'),
          );
          if (!hasViImport) s.prepend(`import {vi} from "vitest";\n`);
          if (mockLines.length) s.appendLeft(insertionPoint, '\n' + mockLines.join('\n') + '\n');
          importPathsList.forEach((p) => {
            s.append(`\n import ${JSON.stringify(p)};`);
          });
          return { code: s.toString(), map: s.generateMap({ hires: true }) };
        },
        async configResolved(config: ResolvedConfig): Promise<void> {
          const plugins = config.plugins as Plugin[];
          const vitestPlugins = plugins.filter(
            (p) =>
              (p.name === 'vite:mocks' || p.name?.startsWith('vitest:')) &&
              (p.enforce || ('order' in p && p.order)) === 'post',
          );
          const lastNuxt = findLastIndex(plugins, (i) => Boolean(i.name?.startsWith('nuxt:')));
          if (lastNuxt === -1) return;
          for (const plugin of vitestPlugins) {
            const index = plugins.indexOf(plugin);
            if (index < lastNuxt) {
              plugins.splice(index, 1);
              plugins.splice(lastNuxt, 0, plugin);
            }
          }
        },
      },
    };
  });

function findLastIndex<T>(arr: T[], predicate: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (predicate(arr[i])) return i;
  return -1;
}
const isImportDeclaration = (node: Node): node is ImportDeclaration =>
  node.type === 'ImportDeclaration';
const isImportSpecifier = (node: Node): node is ImportSpecifier => node.type === 'ImportSpecifier';
const isCallExpression = (node: Node): node is CallExpression => node.type === 'CallExpression';
const isIdentifier = (node: Node): node is Identifier => node.type === 'Identifier';
const isLiteral = (node: Node): node is Literal => node.type === 'Literal';
const isExpressionStatement = (node: Node | null): node is ExpressionStatement =>
  node?.type === 'ExpressionStatement';
const startOf = (node: Node): number =>
  'range' in node && node.range ? node.range[0] : 'start' in node ? (node.start as number) : 0;
const endOf = (node: Node): number =>
  'range' in node && node.range
    ? node.range[1]
    : 'end' in node
      ? (node.end as number)
      : startOf(node);
//#endregion

//#region import mocking setup
const isTestPluginFile = (src: string) => src.includes('.spec.') || src.includes('.test.');

async function setupImportMocking(nuxt: Nuxt): Promise<void> {
  const ctx: MockPluginContext = { components: [], imports: [] };
  let importsCtx: Parameters<NuxtHooks['imports:context']>[0] | undefined;
  nuxt.hook('imports:context', async (ctx) => {
    importsCtx = ctx;
  });
  nuxt.hook('ready', async () => {
    ctx.imports = importsCtx ? await importsCtx.getImports() : [];
  });
  nuxt.hook('components:extend', (_) => {
    ctx.components = _;
  });
  nuxt.hook('imports:sources', (presets) => {
    const idx = presets.findIndex(
      (p) =>
        typeof p === 'object' && p !== null && 'imports' in p && p.imports?.includes('setInterval'),
    );
    if (idx !== -1) presets.splice(idx, 1);
  });
  nuxt.options.ignore = nuxt.options.ignore.filter(
    (i: string) => i !== '**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}',
  );
  if (nuxt._ignore)
    for (const pattern of resolveIgnorePatterns('**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}'))
      nuxt._ignore.add(`!${pattern}`);
  nuxt.hook('app:resolve', (app) => {
    app.plugins = app.plugins.filter((plugin) => !isTestPluginFile(plugin.src));
  });
  addVitePlugin(createMockPlugin(ctx).vite());
}
//#endregion

//#region nuxt root stub plugin
const STUB_PLUGIN_NAME = 'untestutils:nuxt-root-stub';
const STUB_ID = 'nuxt-vitest-app-entry';

const NuxtRootStubPlugin = (options: { entry: string; rootStubPath: string }) => {
  const extension = extname(options.entry);
  const escapedExt = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entryPath = join(dirname(options.entry), STUB_ID + extension);
  const idFilter = new RegExp(`${STUB_ID}(?:${escapedExt})?$`);
  return {
    name: STUB_PLUGIN_NAME,
    enforce: 'pre' as const,
    resolveId: {
      filter: { id: idFilter },
      async handler(id: string, importer?: string) {
        return importer?.endsWith('index.html') ? id : entryPath;
      },
    },
    load: {
      filter: { id: idFilter },
      async handler() {
        return readFileSync(options.entry, 'utf-8').replace(
          '#build/root-component.mjs',
          options.rootStubPath,
        );
      },
    },
  };
};
//#endregion

function runtimeFile(subpath: string): string {
  const bare = subpath.replace(/^\.\//, '').replace(/\.mjs$/, '');
  return fileURLToPath(new URL(`../runtime/${bare}.mjs`, import.meta.url));
}

//#region module
const untestutilsModule: NuxtModule = defineNuxtModule({
  meta: {
    name: 'untestutils',
    configKey: 'testUtils',
    version: '0.1.8',
  },
  defaults: {},
  async setup(_options, nuxt) {
    if (nuxt.options.test || nuxt.options.dev) await setupImportMocking(nuxt);

    // Inline the resolved app config into `paths.mjs` so runtime config works
    // without a running Nitro server.
    if (nuxt.options.test && !nuxt.options.dev)
      nuxt.hook('app:templates', (app) => {
        const template = app.templates.find((t) => t.filename === 'paths.mjs');
        if (!template?.getContents) return;
        const original = template.getContents;
        const inlineAppConfig = JSON.stringify(nuxt.options.app);
        template.getContents = async (data: Parameters<typeof original>[0]): Promise<string> => {
          return (await original(data))
            .replace(/^import \{ useRuntimeConfig \} from ['"]nitropack\/runtime['"]\n?/m, '')
            .replace(
              /const getAppConfig = \(\) => useRuntimeConfig\(\)\.app/,
              () => `const getAppConfig = () => (${inlineAppConfig})`,
            );
        };
      });

    if (nuxt.options.test || nuxt.options.dev)
      addVitePlugin(
        NuxtRootStubPlugin({
          entry: await resolvePath('#app/entry', { alias: nuxt.options.alias }),
          rootStubPath: await resolvePath(runtimeFile('nuxt-root')),
        }) as Plugin,
      );

    if (!nuxt.options.test && !nuxt.options.dev) {
      nuxt.options.vite.define ||= {};
      nuxt.options.vite.define['import.meta.vitest'] = 'undefined';
    }

    nuxt.hook('prepare:types', (ctx) => {
      ctx.references.push({ types: 'vitest/import-meta' });
      for (const tsConfig of [ctx.tsConfig, ctx.nodeTsConfig, ctx.sharedTsConfig]) {
        if (!tsConfig) continue;
        tsConfig.compilerOptions ||= {};
        tsConfig.compilerOptions.allowImportingTsExtensions = true;
      }
      if (ctx.nodeTsConfig) {
        ctx.nodeTsConfig.include ||= [];
        ctx.nodeTsConfig.include.push(
          relative(nuxt.options.buildDir, join(nuxt.options.rootDir, 'vitest.config.*')),
        );
        if (nuxt.options.workspaceDir !== nuxt.options.rootDir)
          ctx.nodeTsConfig.include.push(
            relative(nuxt.options.buildDir, join(nuxt.options.workspaceDir, 'vitest.config.*')),
          );
      }
    });
  },
});

export default untestutilsModule;
//#endregion
