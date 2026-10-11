<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAccount } from '../../composables/useAccount'
import { useUserFavoritesStore } from '../../stores/userFavorites'
import { texts } from '../../texts/en'
import type { CertBundleMeta } from '../../types'
import Card from '../ui/BaseCard.vue'
import CertCodeBadge from './CertCodeBadge.vue'
import CertFact from './CertFact.vue'
import ExamFacts from './ExamFacts.vue'
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{ cert: CertBundleMeta }>()

const favoritesStore = useUserFavoritesStore()
const { pushLocalDataDebounced } = useAccount()

const isFavorite = computed(() => favoritesStore.isFavorite(props.cert.exam.code))

function toggleFavorite() {
  favoritesStore.toggleFavorite(props.cert.exam.code)
  void pushLocalDataDebounced()
}
</script>

<template>
  <Card
    :as="RouterLink"
    :to="{ name: 'quiz-dashboard', params: { certCode: cert.exam.code } }"
    padding="lg"
    bg="bg"
    shadow
    hoverable
    class="cert-card"
  >
    <FavoriteButton
      class="cert-card__favorite"
      :active="isFavorite"
      :cert-name="cert.exam.name"
      @toggle="toggleFavorite"
    />
    <h2>{{ cert.exam.name }}</h2>
    <CertCodeBadge :code="cert.exam.code" />
    <ExamFacts :exam="cert.exam">
      <CertFact :label="texts.questionBankLabel" :value="String(cert.questionCount)" />
    </ExamFacts>
    <p v-if="cert.exam.instructions" class="cert-instructions">{{ cert.exam.instructions }}</p>
    <p class="cert-cta">{{ texts.viewDashboardCta }}</p>
  </Card>
</template>

<style scoped>
.cert-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-decoration: none;
}

.cert-card__favorite {
  position: absolute;
  top: 12px;
  right: 12px;
}

.cert-instructions {
  font-size: 14px;
  color: var(--text);
  text-align: left;
}

.cert-cta {
  margin-top: auto;
  font-weight: 500;
  color: var(--accent);
}
</style>
