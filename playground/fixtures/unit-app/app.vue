<template>
  <div>
    <h1>{{ title }}</h1>
    <p data-testid="counter">{{ count }}</p>
    <button type="button" @click="count++">inc</button>
    <StatusBadge text="ready" />
    <p data-testid="runtime-app">{{ appName }}</p>
  </div>
</template>

<script setup lang="ts">
const title = useState('title', () => 'Unit App');
const count = ref(0);
const config = useRuntimeConfig();
const appName = computed(() => String(config.public?.appName ?? 'unit'));
</script>
