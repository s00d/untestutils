<template>
  <main>
    <h1 :data-mark="`item-${id}-ok`">Item {{ id }}</h1>
    <p :data-mark="`item-${id}-copy`">Detail for item {{ id }}</p>
    <NuxtLink to="/" data-nav="back-home">Home</NuxtLink>
    <NuxtLink :to="`/items/${next}`" data-nav="next-item">Next</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const route = useRoute();
const id = computed(() => String(route.params.id ?? ''));
const next = computed(() => String(Number(id.value || 0) + 1));
</script>
