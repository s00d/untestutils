<script setup>
import { computed, onMounted, ref } from 'vue';

const results = ref(null);
const err = ref('');

onMounted(async () => {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}demo/results.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    results.value = await res.json();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
});

const speedupLabel = computed(() => {
  const s = results.value?.speedup;
  if (!s) return '—';
  return `${s}×`;
});
</script>

<template>
  <div class="mass-demo" v-if="results">
    <div class="mass-stats">
      <div class="mass-stat">
        <span class="mass-stat-value">{{ results.files }}</span>
        <span class="mass-stat-label">spec files</span>
      </div>
      <div class="mass-stat">
        <span class="mass-stat-value">{{ results.tests }}</span>
        <span class="mass-stat-label">browser scenarios</span>
      </div>
      <div class="mass-stat">
        <span class="mass-stat-value">{{ results.naive.wallSec }}s</span>
        <span class="mass-stat-label">naive wall</span>
      </div>
      <div class="mass-stat">
        <span class="mass-stat-value">{{ results.shared.wallSec }}s</span>
        <span class="mass-stat-label">shared wall</span>
      </div>
      <div class="mass-stat">
        <span class="mass-stat-value">{{ speedupLabel }}</span>
        <span class="mass-stat-label">speedup</span>
      </div>
    </div>

    <div class="mass-grid">
      <article class="mass-panel" data-kind="naive">
        <header>
          <span class="mass-badge" data-kind="naive">NAIVE</span>
          <strong>{{ results.naive.label }}</strong>
        </header>
        <p class="mass-panel-body">{{ results.naive.body }}</p>
        <p class="mass-panel-metric">
          Measured wall:
          <strong>{{ results.naive.wallSec }}s</strong>
          · Vitest {{ results.naive.durationSec }}s ·
          {{ results.naive.tests }} passed ·
          <code>{{ results.naive.command }}</code>
        </p>
        <pre class="mass-log"><code>{{ results.naive.excerpt.join('\n') }}</code></pre>
      </article>

      <article class="mass-panel" data-kind="live">
        <header>
          <span class="mass-badge" data-kind="live">SHARED</span>
          <strong>{{ results.shared.label }}</strong>
        </header>
        <p class="mass-panel-body">{{ results.shared.body }}</p>
        <p class="mass-panel-metric">
          Measured wall:
          <strong>{{ results.shared.wallSec }}s</strong>
          · Vitest {{ results.shared.durationSec }}s ·
          {{ results.shared.tests }} passed ·
          <code>{{ results.shared.command }}</code>
        </p>
        <pre class="mass-log"><code>{{ results.shared.excerpt.join('\n') }}</code></pre>
      </article>
    </div>

    <p class="mass-note">
      Same {{ results.tests }} Playwright scenarios (goto + Nuxt hydration + clicks/cookies).
      Only prepare strategy differs. Captured
      <time v-if="results.measuredAt">{{ results.measuredAt }}</time
      >.
      Example:
      <a href="https://github.com/s00d/untestutils/tree/master/examples/mass-nuxt"
        ><code>examples/mass-nuxt</code></a
      >
      — refresh with
      <code>pnpm run demo:capture</code>
      .
    </p>
  </div>
  <p v-else-if="err" class="mass-error">Could not load demo results: {{ err }}</p>
  <p v-else class="mass-loading">Loading demo…</p>
</template>

<style scoped>
.mass-demo {
  margin: 1.5rem 0 2rem;
}
.mass-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}
@media (min-width: 720px) {
  .mass-stats {
    grid-template-columns: repeat(5, 1fr);
  }
}
.mass-stat {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.85rem 0.75rem;
  background: var(--vp-c-bg-soft);
  text-align: center;
}
.mass-stat-value {
  display: block;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--vp-c-brand-1);
}
.mass-stat-label {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.72rem;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.mass-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (min-width: 960px) {
  .mass-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.mass-panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mass-panel[data-kind='live'] {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 50%, var(--vp-c-divider));
}
.mass-panel header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.mass-badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  color: #fff;
}
.mass-badge[data-kind='naive'] {
  background: #64748b;
}
.mass-badge[data-kind='live'] {
  background: #0d9488;
}
.mass-panel-body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  opacity: 0.9;
}
.mass-panel-metric {
  margin: 0;
  font-size: 0.85rem;
}
.mass-log {
  margin: 0;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: #0b1220;
  color: #e2e8f0;
  font-size: 0.72rem;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  max-height: 14rem;
  flex: 1;
}
.mass-note {
  margin: 0.85rem 0 0;
  font-size: 0.85rem;
  opacity: 0.85;
}
.mass-error {
  color: #dc2626;
}
.mass-loading {
  opacity: 0.7;
}
</style>
