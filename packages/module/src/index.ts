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
import {
  addVitePlugin,
  defineNuxtModule,
  resolveIgnorePatterns,
  resolvePath,
} from '@nuxt/kit';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';
import { createUnplugin } from 'unplugin';
import { resolveModulePath } from 'exsolve';

//#region mock transform plugin
const PLUGIN_NAME = 'untestutils:mock-transform';
const HELPER_MOCK_IMPORT = 'mockNuxtImport';
const HELPER_UNMOCK_IMPORT = 'unmockNuxtImport';
const HELPER_MOCK_COMPONENT = 'mockComponent';
const HELPER_MOCK_HOIST = '__NUXT_VITEST_MOCKS';
const HELPER_MOCK_HOIST_ORIGINAL = '__NUXT_VITEST_MOCKS_ORIGINAL';
const HELPER_MOCK_HOIST_PREVIOUS = '__NUXT_VITEST_MOCKS_PREVIOUS';
const HELPERS_NAME = [HELPER_MOCK_IMPORT, HELPER_UNMOCK_IMPORT, HELPER_MOCK_COMPONENT];

interface MockPluginContext {
  imports: any[];
  components: any[];
}

const createMockPlugin = (ctx: MockPluginContext) =>
  createUnplugin(() => {
    return {
      name: PLUGIN_NAME,
      enforce: 'post',
      vite: {
        transform(this: any, code: string, id: string) {
          if (!HELPERS_NAME.some((n) => code.includes(n))) return;
          if (id.includes('/node_modules/')) return;
          let ast: any;
          try {
            ast = this.parse(code, { sourceType: 'module', ecmaVersion: 'latest', ranges: true });
          } catch {
            return;
          }
          let insertionPoint = 0;
          let hasViImport = false;
          const s = new MagicString(code);
          const mocksImport: any[] = [];
          const unmocksFrom = new Set<string>();
          const mocksComponent: any[] = [];
          const importPathsList = new Set<string>();
          walk(ast, {
            enter: (node: any, parent: any) => {
              const removeCallExpression = (start: any, end: any = start) =>
                s.overwrite(
                  isExpressionStatement(parent) ? startOf(parent) : startOf(start),
                  isExpressionStatement(parent) ? endOf(parent) : endOf(end),
                  '',
                );
              const parseMockImportTarget = (importTarget: any, helperName: string) => {
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
                      (i: any) =>
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
                removeCallExpression(node.arguments[0], node.arguments[1]);
                mocksImport.push({
                  name,
                  import: importItem,
                  factory: code.slice(startOf(node.arguments[1]), endOf(node.arguments[1])),
                });
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
                removeCallExpression(node.arguments[0]);
                unmocksFrom.add(importItem.from);
                mocksImport.push({ name, import: importItem, factory: undefined });
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
                    new Error(`The first argument of ${HELPER_MOCK_COMPONENT}() must be a string literal`),
                    startOf(componentName),
                  );
                const pathOrName = componentName.value;
                const path =
                  ctx.components.find((_) => _.pascalName === pathOrName || _.kebabName === pathOrName)
                    ?.filePath || pathOrName;
                removeCallExpression(node.arguments[1]);
                mocksComponent.push({
                  path,
                  factory: code.slice(startOf(node.arguments[1]), endOf(node.arguments[1])),
                });
              }
            },
          });
          if (mocksImport.length === 0 && mocksComponent.length === 0) return;
          const mockLines: string[] = [];
          for (const from of unmocksFrom) mockLines.push(`vi.unmock(${JSON.stringify(from)});`);
          for (const [from, mocks] of mapGroupBy(mocksImport, (mock) => mock.import.from)) {
            importPathsList.add(from);
            const quotedFrom = JSON.stringify(from);
            const mockModuleEntry = `globalThis.${HELPER_MOCK_HOIST}[${quotedFrom}]`;
            mockLines.push(
              `vi.mock(${quotedFrom}, async (importOriginal) => {`,
              `  if (!${mockModuleEntry} || ${unmocksFrom.has(from)}) {`,
              `    const original = await importOriginal()`,
              `    const previous = (${mockModuleEntry} ?? {}).${HELPER_MOCK_HOIST_PREVIOUS} ?? {}`,
              `    ${mockModuleEntry} = { ...original, ...previous }`,
              `    ${mockModuleEntry}.${HELPER_MOCK_HOIST_ORIGINAL} = { ...original }`,
              `    ${mockModuleEntry}.${HELPER_MOCK_HOIST_PREVIOUS} = { ...previous }`,
              `  }`,
            );
            for (const mock of mocks) {
              const quotedName = JSON.stringify(mock.import.name);
              const original = `${mockModuleEntry}.${HELPER_MOCK_HOIST_ORIGINAL}[${quotedName}]`;
              if (mock.factory === undefined)
                mockLines.push(
                  `  ${mockModuleEntry}[${quotedName}] = ${original}`,
                  `  delete ${mockModuleEntry}.${HELPER_MOCK_HOIST_PREVIOUS}[${quotedName}]`,
                );
              else
                mockLines.push(
                  `  ${mockModuleEntry}[${quotedName}] = await (${mock.factory})(${original})`,
                  `  ${mockModuleEntry}.${HELPER_MOCK_HOIST_PREVIOUS}[${quotedName}] = ${mockModuleEntry}[${quotedName}]`,
                );
            }
            mockLines.push(`  return ${mockModuleEntry}`);
            mockLines.push(`});`);
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
          if (!mockLines.length) return;
          s.appendLeft(
            insertionPoint,
            [
              ``,
              `vi.hoisted(() => {`,
              `  if(!globalThis.${HELPER_MOCK_HOIST}){`,
              `    vi.stubGlobal(${JSON.stringify(HELPER_MOCK_HOIST)}, {})`,
              `  }`,
              `});`,
              ``,
            ].join('\n'),
          );
          if (!hasViImport) s.prepend(`import {vi} from "vitest";\n`);
          s.appendLeft(insertionPoint, '\n' + mockLines.join('\n') + '\n');
          importPathsList.forEach((p) => {
            s.append(`\n import ${JSON.stringify(p)};`);
          });
          return { code: s.toString(), map: s.generateMap({ hires: true }) };
        },
        async configResolved(this: any, config: any) {
          const plugins = config.plugins || [];
          const vitestPlugins = plugins.filter(
            (p: any) =>
              (p.name === 'vite:mocks' || p.name?.startsWith('vitest:')) &&
              (p.enforce || ('order' in p && p.order)) === 'post',
          );
          const lastNuxt = findLastIndex(plugins, (i: any) => !!i?.name?.startsWith('nuxt:'));
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

function findLastIndex(arr: any[], predicate: (v: any) => boolean) {
  for (let i = arr.length - 1; i >= 0; i--) if (predicate(arr[i])) return i;
  return -1;
}
const isImportDeclaration = (node: any) => node.type === 'ImportDeclaration';
const isImportSpecifier = (node: any) => node.type === 'ImportSpecifier';
const isCallExpression = (node: any) => node.type === 'CallExpression';
const isIdentifier = (node: any) => node.type === 'Identifier';
const isLiteral = (node: any) => node.type === 'Literal';
const isExpressionStatement = (node: any) => node?.type === 'ExpressionStatement';
const startOf = (node: any) =>
  'range' in node && node.range ? node.range[0] : 'start' in node ? node.start : undefined;
const endOf = (node: any) =>
  'range' in node && node.range ? node.range[1] : 'end' in node ? node.end : undefined;
function mapGroupBy<T, K>(items: T[], keySelector: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keySelector(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}
//#endregion

//#region import mocking setup
const isTestPluginFile = (src: string) => src.includes('.spec.') || src.includes('.test.');

async function setupImportMocking(nuxt: any) {
  const ctx: MockPluginContext = { components: [], imports: [] };
  let importsCtx: any;
  nuxt.hook('imports:context', async (ctx: any) => {
    importsCtx = ctx;
  });
  nuxt.hook('ready', async () => {
    ctx.imports = await importsCtx.getImports();
  });
  nuxt.hook('components:extend', (_: any) => {
    ctx.components = _;
  });
  nuxt.hook('imports:sources', (presets: any[]) => {
    const idx = presets.findIndex(
      (p) => typeof p === 'object' && 'imports' in p && p.imports?.includes('setInterval'),
    );
    if (idx !== -1) presets.splice(idx, 1);
  });
  nuxt.options.ignore = nuxt.options.ignore.filter(
    (i: string) => i !== '**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}',
  );
  if (nuxt._ignore)
    for (const pattern of resolveIgnorePatterns('**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}'))
      nuxt._ignore.add(`!${pattern}`);
  nuxt.hook('app:resolve', (app: any) => {
    app.plugins = app.plugins.filter((plugin: any) => !isTestPluginFile(plugin.src));
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

function resolveRuntimeFile(subpath: string): string {
  return (
    resolveModulePath(`@untestutils/runtime/${subpath}`, {
      from: import.meta.url,
      try: true,
    }) || `@untestutils/runtime/${subpath}`
  );
}

//#region module
export default defineNuxtModule({
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
      nuxt.hook('app:templates', (app: any) => {
        const template = app.templates.find((t: any) => t.filename === 'paths.mjs');
        if (!template?.getContents) return;
        const original = template.getContents;
        const inlineAppConfig = JSON.stringify(nuxt.options.app);
        template.getContents = async (data: any) => {
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
          rootStubPath: await resolvePath(resolveRuntimeFile('nuxt-root')),
        }) as any,
      );

    if (!nuxt.options.test && !nuxt.options.dev) {
      nuxt.options.vite.define ||= {};
      nuxt.options.vite.define['import.meta.vitest'] = 'undefined';
    }

    nuxt.hook('prepare:types', (ctx: any) => {
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
//#endregion
