<template>
  <main>
    <h1 data-mark="session-ok">Session</h1>
    <p data-mark="session-locale">locale={{ locale }}</p>
    <button type="button" data-action="set-de" @click="setLocale('de')">Set de</button>
    <button type="button" data-action="set-en" @click="setLocale('en')">Set en</button>
    <button type="button" data-action="clear" @click="clearLocale">Clear</button>
  </main>
</template>

<script setup lang="ts">
const locale = useCookie('demo_locale', { default: () => 'en' });

function setLocale(code: string) {
  locale.value = code;
}

function clearLocale() {
  locale.value = 'en';
}
</script>
