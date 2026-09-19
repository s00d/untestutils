<template>
  <span data-testid="badge">{{ label }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{ text?: string }>();
const label = computed(() => props.text ?? 'live');
</script>
