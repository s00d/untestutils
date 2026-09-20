import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const docsBase = process.env.NODE_ENV === 'production' ? '/untestutils/' : '/';
const description =
  'Live prepare → start → URL tests for Vitest and Playwright. Shared prepare stays fast enough for CI.';

export default withMermaid(
  defineConfig({
    lang: 'en-US',
    title: 'untestutils',
    description,
    titleTemplate: ':title | untestutils',
    lastUpdated: true,
    cleanUrls: true,
    // Project Pages: https://s00d.github.io/untestutils/
    base: docsBase,

    head: [
      ['link', { rel: 'icon', href: `${docsBase}favicon.ico`, sizes: 'any' }],
      ['link', { rel: 'icon', href: `${docsBase}favicon.svg`, type: 'image/svg+xml' }],
      ['link', { rel: 'icon', href: `${docsBase}favicon.png`, type: 'image/png' }],
      ['link', { rel: 'apple-touch-icon', href: `${docsBase}apple-touch-icon.png` }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'untestutils' }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:image', content: `${docsBase}og-image.png` }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ],

    // pnpm (shamefully-hoist=false): mermaid transitive deps must be direct
    // so vitepress-plugin-mermaid optimizeDeps.include can resolve them.
    vite: {
      optimizeDeps: {
        include: [
          'mermaid',
          'dayjs',
          'debug',
          'cytoscape',
          'cytoscape-cose-bilkent',
          '@braintree/sanitize-url',
          'fastdom',
        ],
      },
    },

    themeConfig: {
      logo: '/logo.svg',
      siteTitle: 'untestutils',
      search: { provider: 'local' },
      socialLinks: [{ icon: 'github', link: 'https://github.com/s00d/untestutils' }],
      editLink: {
        pattern: 'https://github.com/s00d/untestutils/edit/master/docs/:path',
        text: 'Edit this page',
      },
      nav: [
        { text: 'Guide', link: '/guide/getting-started' },
        { text: 'Demo', link: '/guide/demo' },
        { text: 'Why', link: '/why' },
        { text: 'Roadmap', link: '/roadmap' },
        { text: 'Migration', link: '/migration/from-nuxt-test-utils' },
        { text: 'API', link: '/api/' },
        { text: 'CLI', link: '/cli/' },
      ],
      sidebar: {
        '/guide/': [
          {
            text: 'Guide',
            items: [
              { text: 'Getting started', link: '/guide/getting-started' },
              { text: 'Demo — mass Nuxt e2e', link: '/guide/demo' },
              { text: 'How it works', link: '/guide/how-it-works' },
              { text: 'Vitest', link: '/guide/vitest' },
              { text: 'Playwright', link: '/guide/playwright' },
              { text: 'Drivers', link: '/guide/drivers' },
              { text: 'Support matrix', link: '/guide/support-matrix' },
              { text: 'Utils', link: '/guide/utils' },
              { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            ],
          },
          {
            text: 'Advanced',
            collapsed: true,
            items: [
              { text: 'Vitest Browser Mode', link: '/guide/browser-mode' },
              { text: 'Explore browsers', link: '/guide/explore-browsers' },
              { text: 'Perf suite', link: '/guide/perf' },
              { text: 'Perf calibration', link: '/guide/perf-calibration' },
              { text: 'AI codegen', link: '/guide/ai' },
              { text: 'Extending', link: '/guide/extending' },
            ],
          },
        ],
        '/why': [
          {
            text: 'Why',
            items: [
              { text: 'Why untestutils', link: '/why' },
              { text: 'Demo — mass Nuxt e2e', link: '/guide/demo' },
              { text: 'Roadmap', link: '/roadmap' },
            ],
          },
        ],
        '/roadmap': [
          {
            text: 'Roadmap',
            items: [{ text: 'Roadmap', link: '/roadmap' }],
          },
        ],
        '/migration/': [
          {
            text: 'Migration',
            items: [
              { text: 'From @nuxt/test-utils', link: '/migration/from-nuxt-test-utils' },
              { text: 'From raw Playwright', link: '/migration/from-raw-playwright' },
            ],
          },
        ],
        '/api/': [
          {
            text: 'API',
            items: [
              { text: 'Overview', link: '/api/' },
              { text: 'Core', link: '/api/core' },
              { text: 'Vitest', link: '/api/vitest' },
              { text: 'Playwright', link: '/api/playwright' },
              { text: 'Drivers', link: '/api/drivers' },
              { text: 'Nuxt', link: '/api/nuxt' },
              { text: 'AI', link: '/api/ai' },
            ],
          },
        ],
        '/cli/': [
          {
            text: 'CLI',
            items: [{ text: 'Commands', link: '/cli/' }],
          },
        ],
      },
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © untestutils contributors',
      },
    },

    mermaid: {},
  }),
);
