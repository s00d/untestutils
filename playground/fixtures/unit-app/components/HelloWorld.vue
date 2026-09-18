<template>
  <div data-testid="hello">{{ label }}</div>
</template>

<script setup lang="ts">
const props = defineProps<{ label?: string }>()
const label = computed(() => props.label ?? 'hello')
</script>
