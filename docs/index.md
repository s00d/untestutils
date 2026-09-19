---
titleTemplate: false
title: untestutils
description: Live prepare → start → URL tests for Vitest and Playwright. Shared prepare stays fast enough for CI.
layout: home

hero:
  name: untestutils
  text: Test the live app
  tagline: Prepare once, assert against a real URL — Vitest and Playwright share the same recipes. Fast enough for CI.
  image:
    src: /logo.svg
    alt: untestutils logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Why
      link: /why
    - theme: alt
      text: Roadmap
      link: /roadmap
    - theme: alt
      text: GitHub
      link: https://github.com/s00d/untestutils

features:
  - title: Live target
    details: Specs hit a real prepare → start → URL path — cookies, SEO, redirects, locale — not happy-dom stubs.
  - title: Shared prepare
    details: Build once per recipe identity, reuse across files and workers via .untestutils. That is the CI time win.
  - title: One recipes.ts
    details: Same ids for Vitest and Playwright. Drivers for Nuxt, static, command, remote host, and more.
---
