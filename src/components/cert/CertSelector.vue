<script setup lang="ts">
import { ref, watch } from 'vue';
import { texts } from '../../texts/en';
import type { CertFamilyGroup } from '../../types';
import CertCard from './CertCard.vue';

const props = defineProps<{ groups: CertFamilyGroup[] }>()

const openIds = ref<Set<string>>(new Set())

watch(
  () => props.groups,
  (groups) => {
    openIds.value = new Set(groups.map((group) => group.familyId))
  },
)

function onToggle(familyId: string, event: Event) {
  const details = event.target as HTMLDetailsElement
  const next = new Set(openIds.value)
  if (details.open) next.add(familyId)
  else next.delete(familyId)
  openIds.value = next
}

function expandAll() {
  openIds.value = new Set(props.groups.map((group) => group.familyId))
}

function collapseAll() {
  openIds.value = new Set()
}
</script>

<template>
  <h1>{{ texts.selectCertification }}</h1>
  <p v-if="groups.length === 0" class="empty-state">
    {{ texts.emptyStateBefore }} <code>{{ texts.emptyStateHighlight }}</code>
    {{ texts.emptyStateAfter }}
  </p>
  <div v-else class="cert-families">
    <div class="cert-families__toolbar">
      <button type="button" class="cert-families__action" @click="expandAll">
        {{ texts.expandAllLabel }}
      </button>
      <span class="cert-families__separator" aria-hidden="true">·</span>
      <button type="button" class="cert-families__action" @click="collapseAll">
        {{ texts.collapseAllLabel }}
      </button>
    </div>
    <details
      v-for="group in groups"
      :key="group.familyId"
      class="cert-family"
      :open="openIds.has(group.familyId)"
      @toggle="onToggle(group.familyId, $event)"
    >
      <summary class="cert-family__summary">
        <span class="cert-family__chevron" aria-hidden="true">▼</span>
        <span class="cert-family__title">{{ group.label }}</span>
        <span class="cert-family__count">{{ texts.familyCertCount(group.certs.length) }}</span>
      </summary>
      <div class="cert-grid">
        <CertCard v-for="cert in group.certs" :key="cert.exam.code" :cert="cert" />
      </div>
    </details>
  </div>
</template>

<style scoped>
h1 {
  line-height: 2.2rem;
    margin: 0;
}

.empty-state {
  color: var(--text);
}

.cert-families {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.cert-families__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.cert-families__action {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--accent);
  font: inherit;
}

.cert-families__action:hover {
  color: var(--text-h);
}

.cert-families__separator {
  color: var(--text);
}

.cert-family {
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
}

.cert-family__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.cert-family__summary::-webkit-details-marker {
  display: none;
}

.cert-family__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 11px;
  line-height: 1;
  color: var(--accent);
  transition: transform 0.2s ease;
}

.cert-family[open] .cert-family__chevron {
  transform: rotate(180deg);
}

.cert-family__title {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-h);
}

.cert-family__count {
  margin-left: auto;
  font-size: 14px;
  color: var(--text);
}

.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 20px;
  width: 100%;
  padding: 0 20px 20px;
  box-sizing: border-box;
}
</style>
