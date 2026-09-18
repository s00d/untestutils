import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const docsBase = process.env.NODE_ENV === 'production' ? '/untestutils/' : '/';

export default withMermaid(
  defineConfig({
    lang: 'en-US',
    title: 'untestutils',
    description: 'Recipe-based test harness for Vitest and Playwright',
    titleTemplate: ':title | untestutils',
    lastUpdated: true,
    cleanUrls: true,
    // Project Pages: https://s00d.github.io/untestutils/
    base: docsBase,

    head: [
      ['link', { rel: 'icon', href: `${docsBase}favicon.svg`, type: 'image/svg+xml' }],
      ['link', { rel: 'icon', href: `${docsBase}favicon.png`, type: 'image/png' }],
      ['link', { rel: 'apple-touch-icon', href: `${docsBase}apple-touch-icon.png` }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'untestutils' }],
      [
        'meta',
        {
          property: 'og:description',
          content: 'Recipe-based test harness for Vitest and Playwright',
        },
      ],
      ['meta', { property: 'og:image', content: `${docsBase}og-image.png` }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ],

    themeConfig: {
      logo: '/logo.svg',
      siteTitle: 'untestutils',
      search: { provider: 'local' },
      socialLinks: [{ icon: 'github', link: 'https://github.com/s00d/untestutils' }],
      editLink: {
        pattern: 'https://github.com/s00d/untestutils/edit/main/docs/:path',
        text: 'Edit this page',
      },
      nav: [
        { text: 'Guide', link: '/guide/getting-started' },
        { text: 'Migration', link: '/migration/from-nuxt-test-utils' },
        { text: 'API', link: '/api/' },
        { text: 'CLI', link: '/cli/' },
        { text: 'Examples', link: '/examples' },
      ],
      sidebar: {
        '/guide/': [
          {
            text: 'Guide',
            items: [
              { text: 'Getting started', link: '/guide/getting-started' },
              { text: 'Concepts', link: '/guide/concepts' },
              { text: 'Vitest', link: '/guide/vitest' },
              { text: 'Utils', link: '/guide/utils' },
              { text: 'Perf', link: '/guide/perf' },
              { text: 'Playwright', link: '/guide/playwright' },
              { text: 'Drivers & recipes', link: '/guide/drivers' },
              { text: 'Sharing & cache', link: '/guide/sharing-and-cache' },
              { text: 'Remote host', link: '/guide/remote-host' },
              { text: 'AI codegen', link: '/guide/ai' },
              { text: 'Extending', link: '/guide/extending' },
              { text: 'Troubleshooting', link: '/guide/troubleshooting' },
              { text: 'Release', link: '/guide/release' },
            ],
          },
        ],
        '/migration/': [
          {
            text: 'Migration',
            items: [
              { text: 'From @nuxt/test-utils', link: '/migration/from-nuxt-test-utils' },
              { text: 'From raw Playwright', link: '/migration/from-raw-playwright' },
              { text: 'Pain points covered', link: '/migration/pain-points' },
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
