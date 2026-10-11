<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useUserFavoritesStore } from '../../stores/userFavorites';
import { texts } from '../../texts/en';
import type { CertBundleMeta, CertFamilyGroup } from '../../types';
import CertCard from './CertCard.vue';

const FAVORITES_ID = 'favorites'

const props = defineProps<{ groups: CertFamilyGroup[] }>()

const favoritesStore = useUserFavoritesStore()

const favoritesGroup = computed<CertFamilyGroup>(() => {
  const byCode = new Map(props.groups.flatMap((group) => group.certs).map((cert) => [cert.exam.code, cert]))
  const certs = favoritesStore.certCodes
    .map((code) => byCode.get(code))
    .filter((cert): cert is CertBundleMeta => cert !== undefined)
  return { familyId: FAVORITES_ID, label: texts.favorites, certs }
})

function defaultOpenIds(): Set<string> {
  return favoritesGroup.value.certs.length > 0 ? new Set([FAVORITES_ID]) : new Set()
}

const openIds = ref<Set<string>>(defaultOpenIds())

const sections = computed<CertFamilyGroup[]>(() => [favoritesGroup.value, ...props.groups])

watch(
  () => props.groups,
  () => {
    openIds.value = defaultOpenIds()
  },
  { immediate: true },
)

function onToggle(familyId: string, event: Event) {
  const details = event.target as HTMLDetailsElement
  const next = new Set(openIds.value)
  if (details.open) next.add(familyId)
  else next.delete(familyId)
  openIds.value = next
}

function expandAll() {
  openIds.value = new Set([FAVORITES_ID, ...props.groups.map((group) => group.familyId)])
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
      v-for="section in sections"
      :key="section.familyId"
      class="cert-family"
      :class="{ 'cert-family--favorites': section.familyId === FAVORITES_ID }"
      :open="openIds.has(section.familyId)"
      @toggle="onToggle(section.familyId, $event)"
    >
      <summary class="cert-family__summary">
        <span class="cert-family__chevron" aria-hidden="true">▼</span>
        <span v-if="section.familyId === FAVORITES_ID" class="cert-family__title">
          {{ section.label }}
        </span>
        <span v-else class="cert-family__title">{{ section.label }}</span>
        <span class="cert-family__count">{{ texts.familyCertCount(section.certs.length) }}</span>
      </summary>
      <div class="cert-grid">
        <p v-if="section.certs.length === 0 && section.familyId === FAVORITES_ID" class="cert-grid__empty">
          {{ texts.favoriteEmptyState }}
        </p>
        <CertCard v-for="cert in section.certs" :key="cert.exam.code" :cert="cert" />
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cert-family__heart {
  width: 18px;
  height: 18px;
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

.cert-grid__empty {
  grid-column: 1 / -1;
  margin: 0;
  padding: 4px 0;
  color: var(--text);
}
</style>
