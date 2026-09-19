<template>
  <main>
    <h1 data-mark="home-ok">Home</h1>
    <p data-mark="home-copy">mass-nuxt live browser demo</p>
    <ul>
      <li v-for="code in locales" :key="code">
        <NuxtLink :to="`/locale/${code}`" :data-nav="`locale-${code}`">Locale {{ code }}</NuxtLink>
      </li>
    </ul>
    <button type="button" data-action="bump" @click="count++">Bump {{ count }}</button>
    <p data-mark="home-count">count={{ count }}</p>
  </main>
</template>

<script setup lang="ts">
const locales = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ja', 'ko'];
const count = ref(0);
</script>
