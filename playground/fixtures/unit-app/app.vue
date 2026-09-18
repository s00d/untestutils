<template>
  <div>
    <h1>{{ title }}</h1>
    <p data-testid="counter">{{ count }}</p>
    <button type="button" @click="count++">inc</button>
  </div>
</template>

<script setup lang="ts">
const title = useState('title', () => 'Unit App')
const count = ref(0)
</script>
