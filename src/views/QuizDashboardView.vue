<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizLoader } from '../composables/useQuizLoader'
import { useQuizHistoryStore } from '../stores/quizHistory'
import { useUserProgressStore } from '../stores/userProgress'
import { texts } from '../texts/en'
import { passingScorePercent } from '../utils/examDisplay'
import { certMeta } from '../utils/seo'
import { breakdownByThemeAllTime, breakdownByTopicAllTime } from '../utils/scoreBreakdown'

import CertFact from '../components/cert/CertFact.vue'
import ExamFacts from '../components/cert/ExamFacts.vue'
import QuizHistoryList from '../components/history/QuizHistoryList.vue'
import ReviewBreakdown from '../components/review/ReviewBreakdown.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import PrimaryButton from '../components/ui/PrimaryButton.vue'
import SecondaryButton from '../components/ui/SecondaryButton.vue'
import { useAccount } from '../composables/useAccount'

const props = defineProps<{
  certCode: string
}>()

const router = useRouter()
const { getCert, groupedCerts } = useQuizLoader()
const { pushLocalData } = useAccount()
const historyStore = useQuizHistoryStore()
const progressStore = useUserProgressStore()

const cert = computed(() => getCert(props.certCode))
const entries = computed(() => historyStore.byCertCode(props.certCode))

const allTimeCorrect = computed(() => historyStore.allTimeCorrect(props.certCode))
const allTimeAttempted = computed(() => historyStore.allTimeAttempted(props.certCode))
const allTimePercent = computed(() =>
  allTimeAttempted.value === 0 ? 0 : Math.round((allTimeCorrect.value / allTimeAttempted.value) * 100),
)

const topicBreakdown = computed(() => breakdownByTopicAllTime(entries.value, cert.value?.questions ?? []))
const themeGroups = computed(() => Object.keys(cert.value?.themes ?? {}))
const themeBreakdown = computed(() => breakdownByThemeAllTime(entries.value, themeGroups.value, cert.value?.questions ?? []))

const hasFlaggedQuestions = computed(() => progressStore.hasFlagged(props.certCode))

const passingPercent = computed(() => {
  const ps = cert.value?.exam.passingScore
  return ps ? passingScorePercent(ps) : 0
})



const aboutDescription = computed(() =>
  cert.value ? certMeta(cert.value.exam, cert.value.questions.length).description : '',
)
const relatedCerts = computed(() => {
  const group = groupedCerts.find((candidate) =>
    candidate.certs.some((meta) => meta.exam.code === props.certCode),
  )
  return group ? group.certs.filter((meta) => meta.exam.code !== props.certCode) : []
})

const deleteTargetId = ref<string | null>(null)
const showResetModal = ref(false)

function requestDelete(id: string) {
  deleteTargetId.value = id
}

function confirmDelete() {
  if (deleteTargetId.value) {
    historyStore.deleteById(deleteTargetId.value)
    deleteTargetId.value = null
    void pushLocalData()
  }
}

function confirmReset() {
  historyStore.resetByCertCode(props.certCode)
  progressStore.resetByCertCode(props.certCode)
  showResetModal.value = false
  void pushLocalData()
}

function startQuiz() {
  router.push({ name: 'quiz-configure', params: { certCode: props.certCode } })
}

function goHome() {
  router.push({ name: 'cert-selector' })
}

function reviewEntry(entryId: string) {
  router.push({ name: 'quiz-history-review', params: { certCode: props.certCode, entryId } })
}

function reviewTopic(topic: string) {
  router.push({ name: 'topic-review', params: { certCode: props.certCode, topic } })
}

function reviewTheme(group: string, value: string) {
  router.push({ name: 'theme-review', params: { certCode: props.certCode, themeGroup: group, themeValue: value } })
}

function reviewFlagged() {
  router.push({ name: 'flagged-review', params: { certCode: props.certCode } })
}
</script>

<template>
  <div v-if="cert" class="dashboard">
    <header class="dashboard__header">
      <div class="header-buttons">
        <PrimaryButton size="sm" @click="goHome">{{ texts.toCertsList }}</PrimaryButton>
        <PrimaryButton size="sm" @click="startQuiz">{{ texts.startQuizCta }}</PrimaryButton>
      </div>
      <h1>{{ cert.exam.name }}</h1>
    </header>

    <section class="all-time">
      <div class="all-time-stats">
        <div class="stat">
          <span class="stat-value">{{ entries.length }}</span>
          <span class="stat-label">{{ texts.quizzesTaken }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ allTimePercent }}%</span>
          <span class="stat-label">{{ texts.overallAccuracy }}</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ allTimeCorrect }} / {{ allTimeAttempted }}</span>
          <span class="stat-label">{{ texts.correctAnswers }}</span>
        </div>
      </div>
    </section>

    <ReviewBreakdown
      v-if="entries.length > 0 || hasFlaggedQuestions"
      :topic-breakdown="topicBreakdown"
      :theme-breakdown="themeBreakdown"
      :theme-groups="themeGroups"
      :passing-percent="passingPercent"
      :show-review-button="true"
      :has-flagged-questions="hasFlaggedQuestions"
      @review-topic="reviewTopic"
      @review-theme="reviewTheme"
      @review-flagged="reviewFlagged"
    />

    <section class="history-section">
      <div class="history-header">
        <h2 v-if="entries.length > 0">{{ texts.quizHistory }}</h2>
        <SecondaryButton
          v-if="entries.length > 0"
          size="sm"
          danger
          @click="showResetModal = true"
        >
          {{ texts.resetAll }}
        </SecondaryButton>
      </div>
      <QuizHistoryList :entries="entries" @request-delete="requestDelete" @review="reviewEntry" />
    </section>

    <section class="about">
      <h2>{{ texts.aboutExamTitle }}</h2>
      <p>{{ aboutDescription }}</p>
      <ExamFacts :exam="cert.exam">
        <CertFact :label="texts.questionBankLabel" :value="texts.questionBankValue(cert.questions.length)" />
      </ExamFacts>
      <template v-if="relatedCerts.length > 0">
        <h3>{{ texts.relatedCertsTitle }}</h3>
        <ul class="about__related">
          <li v-for="meta in relatedCerts" :key="meta.exam.code">
            <RouterLink :to="{ name: 'quiz-dashboard', params: { certCode: meta.exam.code } }">
              {{ meta.exam.name }}
            </RouterLink>
          </li>
        </ul>
      </template>
    </section>

    <ConfirmModal
      v-if="deleteTargetId"
      :title="texts.deleteQuizTitle"
      :message="texts.deleteQuizMessage"
      :confirm-label="texts.delete"
      :cancel-label="texts.cancel"
      @confirm="confirmDelete"
      @cancel="deleteTargetId = null"
    />

    <ConfirmModal
      v-if="showResetModal"
      :title="texts.resetAllTitle"
      :message="texts.resetAllMessage"
      :confirm-label="texts.resetAll"
      :cancel-label="texts.cancel"
      @confirm="confirmReset"
      @cancel="showResetModal = false"
    />
  </div>
</template>

<style scoped>
.about {
  margin-top: 32px;
  text-align: left;
}

.about h2 {
  margin: 0 0 8px;
  font-size: 18px;
  color: var(--text-h);
}

.about h3 {
  margin: 20px 0 8px;
  font-size: 15px;
  color: var(--text-h);
}

.about__related {
  margin: 0;
  padding-left: 20px;
}

.dashboard {
  padding: 24px 16px 48px;
}

.dashboard__header {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.header-buttons {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.dashboard__header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--text-h);
  flex: 1;
  text-align: center;
}

.all-time {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 24px 0 24px 0;
}

.all-time h2,
.history-section h2 {
  font-size: 18px;
  color: var(--text-h);
  margin: 0 0 12px;
}

.all-time-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-h);
}

.stat-label {
  font-size: 13px;
  color: var(--text);
}

.history-section {
  margin-bottom: 24px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard__footer {
  display: flex;
  justify-content: center;
}
</style>
