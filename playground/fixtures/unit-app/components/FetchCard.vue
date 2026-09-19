<template>
  <div data-testid="fetch-card">{{ payload }}</div>
</template>

<script setup lang="ts">
const { data } = await useFetch<{ value: string }>('/api/card');
const payload = computed(() => data.value?.value ?? 'loading');
</script>
