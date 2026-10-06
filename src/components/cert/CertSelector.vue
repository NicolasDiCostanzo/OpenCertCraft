<script setup lang="ts">
import { texts } from '../../texts/en';
import type { CertBundleMeta } from '../../types';
import CertCard from './CertCard.vue';

defineProps<{ certs: CertBundleMeta[] }>()
</script>

<template>
  <h1>{{ texts.selectCertification }}</h1>
  <p v-if="certs.length === 0" class="empty-state">
    {{ texts.emptyStateBefore }} <code>{{ texts.emptyStateHighlight }}</code>
    {{ texts.emptyStateAfter }}
  </p>
  <div v-else class="cert-grid">
    <CertCard v-for="cert in certs" :key="cert.exam.code" :cert="cert" />
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

.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 20px;
  width: 100%;
}
</style>
