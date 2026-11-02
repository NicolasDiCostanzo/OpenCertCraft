<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ReviewDetailPanel from '../components/review/ReviewDetailPanel.vue'
import ReviewQuestionGrid from '../components/review/ReviewQuestionGrid.vue'
import ReviewSummary from '../components/review/ReviewSummary.vue'
import PrimaryButton from '../components/ui/PrimaryButton.vue'
import { useAccount } from '../composables/useAccount'
import { useUserProgressStore } from '../stores/userProgress'
import { texts } from '../texts/en'
import type { CertBundle, Question, QuestionAnswer } from '../types'
import { passingScorePercent } from '../utils/examDisplay'

const props = defineProps<{
  questions: Question[]
  answers: Record<string, QuestionAnswer>
  cert: CertBundle | undefined
  title: string
  showSummary?: boolean
  summaryResult?: { percentCorrect: number; passed: boolean; timesCorrect: number; totalAnswered: number; projectedScaledScore?: number }
  topicBreakdown?: { label: string; correct: number; total: number; percent: number }[]
  themeBreakdown?: { group: string; value: string; correct: number; total: number; percent: number }[]
  backRoute: { name: string; params?: Record<string, string> }
  questionsTitle?: string
  backLabel?: string
  beforeBack?: () => void
}>()

const router = useRouter()
const { pushLocalDataDebounced } = useAccount()
const progressStore = useUserProgressStore()

const certCode = computed(() => props.cert?.exam.code ?? '')
const themeGroups = computed(() => Object.keys(props.cert?.themes ?? {}))

const selectedQuestionId = ref<string | null>(null)

watch(() => props.questions, (qs) => {
  if (selectedQuestionId.value === null && qs.length > 0) {
    selectedQuestionId.value = qs[0].id
  }
}, { immediate: true })

const passingPercent = computed(() => {
  const ps = props.cert?.exam.passingScore
  return ps ? passingScorePercent(ps) : 0
})

const selectedQuestion = computed(() =>
  props.questions.find((q) => q.id === selectedQuestionId.value) ?? null,
)

const selectedAnswer = computed(() =>
  selectedQuestionId.value ? (props.answers[selectedQuestionId.value] ?? null) : null,
)

const flaggedQuestionIds = computed(() =>
  new Set(props.questions.filter((q) => progressStore.isFlagged(certCode.value, q.id)).map((q) => q.id)),
)

const selectedQuestionFlagged = computed(() =>
  selectedQuestion.value ? progressStore.isFlagged(certCode.value, selectedQuestion.value.id) : false,
)

function toggleSelected(questionId: string) {
  selectedQuestionId.value = selectedQuestionId.value === questionId ? null : questionId
}

function toggleFlag(questionId: string) {
  progressStore.toggleFlag(certCode.value, questionId)
  void pushLocalDataDebounced()
}

function goBack() {
  props.beforeBack?.()
  router.push(props.backRoute)
}
</script>

<template>
  <div v-if="questions.length > 0" class="review">
    <header class="review__header">
    <PrimaryButton size="lg" @click="goBack">{{ backLabel ?? texts.goBackToDashboard }}</PrimaryButton>
      <h1>{{ title }}</h1>
    </header>

    <ReviewSummary
      v-if="showSummary && summaryResult"
      :result="summaryResult"
      :cert="cert"
      :topic-breakdown="topicBreakdown ?? []"
      :theme-breakdown="themeBreakdown ?? []"
      :theme-groups="themeGroups"
      :passing-percent="passingPercent"
    />

    <ReviewQuestionGrid
      :questions="questions"
      :answers="answers"
      :flagged-question-ids="flaggedQuestionIds"
      :selected-question-id="selectedQuestionId"
      @select="toggleSelected"
    />

    <ReviewDetailPanel
      :question="selectedQuestion"
      :answer="selectedAnswer"
      :theme-groups="themeGroups"
      :flagged="selectedQuestionFlagged"
      @toggle-flag="toggleFlag"
    />

  </div>

  <div v-else class="review review--not-found">
    <header class="review__header">
      <h1>{{ texts.quizNotFoundTitle }}</h1>
    </header>
    <p class="review__message">{{ texts.noQuestionsFoundMessage }}</p>
    <footer class="review__footer">
      <PrimaryButton size="lg" @click="goBack">{{ backLabel ?? texts.toCertsList }}</PrimaryButton>
    </footer>
  </div>
</template>

<style scoped>
.review {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.review__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.review__header h1 {
  margin: 0;
  font-size: 28px;
  color: var(--text-h);
}

.review__footer {
  display: flex;
  justify-content: center;
}

.review--not-found {
  text-align: center;
}

.review--not-found .review__header {
  margin-bottom: 16px;
}

.review__message {
  color: var(--text);
  margin-bottom: 24px;
}
</style>