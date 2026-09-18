---
titleTemplate: false
title: untestutils
description: Recipe-based test harness for Vitest and Playwright
layout: home

hero:
  name: untestutils
  text: Recipe-based test harness
  tagline: Shared prepare for Vitest and Playwright — Nuxt, static, command, and remote hosts.
  image:
    src: /logo.svg
    alt: untestutils logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Migrate from @nuxt/test-utils
      link: /migration/from-nuxt-test-utils
    - theme: alt
      text: GitHub
      link: https://github.com/s00d/untestutils

features:
  - title: Shared builds
    details: Prepare once per Recipe identity, reuse across files and workers via .untestutils artifacts.
    icon:
      src: /icons/icon-cache.png
  - title: Vitest + Playwright
    details: One recipes.ts powers both runners — plugin for Vitest, createPlaywrightConfig for Playwright Test.
    icon:
      src: /icons/icon-vitest.png
  - title: Drivers
    details: staticDir, command, nodeEntry, host, and nuxt({ run }). Extend with defineDriver.
  - title: Remote smoke
    details: Point host() at a deployed URL for post-deploy Playwright without local prepare.
    icon:
      src: /icons/icon-playwright.png
  - title: CLI
    details: init, convert, ai, doctor — scaffold configs or migrate existing tests.
  - title: Optional AI
    details: Generate or convert e2e specs with cached artifacts under .untestutils/ai.
---
