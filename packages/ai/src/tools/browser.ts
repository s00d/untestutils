import type { Browser, Page } from 'playwright-core';
import type { AgentToolBag } from '../agent/types';

/**
 * Playwright-backed page tools for the shared AI agent.
 * Optional peer: playwright-core. Used by CLI fix/cover workflows.
 */
export function createBrowserTools(
  opts: {
    baseURL?: string;
    headless?: boolean;
  } = {},
): AgentToolBag {
  let browser: Browser | undefined;
  let page: Page | undefined;

  async function ensurePage(): Promise<Page> {
    if (page) return page;
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: opts.headless ?? true });
    const context = await browser.newContext(opts.baseURL ? { baseURL: opts.baseURL } : undefined);
    page = await context.newPage();
    return page;
  }

  async function dispose() {
    await page
      ?.context()
      .close()
      .catch(() => {});
    await browser?.close().catch(() => {});
    page = undefined;
    browser = undefined;
  }

  return {
    readPaths: () => [],
    dispose,
    tools: [
      {
        name: 'browser_goto',
        description:
          'Navigate the Playwright page to a path or absolute URL. Uses baseURL when path is relative.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Path or absolute URL' },
          },
          required: ['url'],
        },
        execute: async (args) => {
          const p = await ensurePage();
          const res = await p.goto(String(args.url), { waitUntil: 'domcontentloaded' });
          return {
            ok: Boolean(res && res.ok()),
            status: res?.status() ?? null,
            url: p.url(),
            title: await p.title(),
          };
        },
      },
      {
        name: 'browser_snapshot',
        description:
          'Accessibility snapshot of the current page (roles, names, text) — preferred over raw HTML for test authoring.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const p = await ensurePage();
          const snapshot = await p
            .locator('body')
            .ariaSnapshot()
            .catch(async () => {
              const text = await p.innerText('body').catch(() => '');
              return text.slice(0, 8000);
            });
          return { url: p.url(), title: await p.title(), snapshot };
        },
      },
      {
        name: 'browser_content',
        description: 'Return truncated HTML or visible text of the current page.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', description: '"text" (default) or "html"' },
            maxChars: { type: 'string', description: 'Max characters (default 12000)' },
          },
        },
        execute: async (args) => {
          const p = await ensurePage();
          const max = Number(args.maxChars ?? 12_000);
          const mode = String(args.mode ?? 'text');
          const raw =
            mode === 'html' ? await p.content() : await p.innerText('body').catch(() => '');
          return { url: p.url(), content: raw.slice(0, max) };
        },
      },
      {
        name: 'browser_click',
        description: 'Click an element by CSS selector or role=name (e.g. role=button[name=Save]).',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
            role: { type: 'string', description: 'ARIA role' },
            name: { type: 'string', description: 'Accessible name when using role' },
          },
        },
        execute: async (args) => {
          const p = await ensurePage();
          if (args.role) {
            await p
              .getByRole(String(args.role) as never, {
                name: args.name ? String(args.name) : undefined,
              })
              .click();
          } else if (args.selector) {
            await p.locator(String(args.selector)).click();
          } else {
            throw new Error('Provide selector or role');
          }
          return { ok: true, url: p.url() };
        },
      },
      {
        name: 'browser_eval',
        description: 'Evaluate a small JS expression in the page (return JSON-serializable value).',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'JS expression' },
          },
          required: ['expression'],
        },
        execute: async (args) => {
          const p = await ensurePage();
          const value = await p.evaluate(String(args.expression));
          return { value };
        },
      },
    ],
  };
}
