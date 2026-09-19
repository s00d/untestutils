<template>
  <main>
    <h1 :data-mark="`locale-${code}-ok`">Locale {{ code }}</h1>
    <p :data-mark="`locale-${code}-copy`">Browsing locale {{ code }}</p>
    <NuxtLink to="/" data-nav="back-home">Home</NuxtLink>
    <NuxtLink to="/session" data-nav="to-session">Session</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const route = useRoute();
const code = computed(() => String(route.params.code ?? ''));
</script>
