<template>
  <main>
    <h1 data-mark="search-ok">Search</h1>
    <form data-mark="search-form" @submit.prevent="onSubmit">
      <input v-model="q" data-mark="search-input" name="q" />
      <button type="submit" data-action="search">Go</button>
    </form>
    <p v-if="submitted" data-mark="search-result">query={{ submitted }}</p>
  </main>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const q = ref(String(route.query.q ?? ''));
const submitted = ref(String(route.query.q ?? ''));

watch(
  () => route.query.q,
  (v) => {
    submitted.value = String(v ?? '');
    q.value = String(v ?? '');
  },
);

async function onSubmit() {
  await router.push({ path: '/search', query: { q: q.value } });
  submitted.value = q.value;
}
</script>
