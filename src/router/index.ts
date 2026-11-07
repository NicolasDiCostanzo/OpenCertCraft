import { createRouter, createWebHistory } from 'vue-router'
import { useQuizLoader } from '../composables/useQuizLoader'
import { isAuthAvailable } from '../config'
import { useQuizSessionStore } from '../stores/quizSession'
import { useUserAccountStore } from '../stores/userAccount'
import AuthView from '../views/AuthView.vue'
import CertSelectorView from '../views/CertSelectorView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import QuestionBankReviewView from '../views/QuestionBankReviewView.vue'
import QuizConfigureView from '../views/QuizConfigureView.vue'
import QuizDashboardView from '../views/QuizDashboardView.vue'
import QuizHistoryReviewView from '../views/QuizHistoryReviewView.vue'
import QuizReviewView from '../views/QuizReviewView.vue'
import QuizSessionView from '../views/QuizSessionView.vue'
import WelcomeView from '../views/WelcomeView.vue'
import { applyPageMeta, resolvePageMeta } from './pageMeta'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/cert', name: 'cert-selector', component: CertSelectorView },
    { path: '/', name: 'welcome', component: WelcomeView },
    { path: '/auth', name: 'auth', component: AuthView },
    { path: '/certs/:certCode', name: 'quiz-dashboard', component: QuizDashboardView, props: true },
    { path: '/certs/:certCode/configure', name: 'quiz-configure', component: QuizConfigureView },
    { path: '/certs/:certCode/quiz', name: 'quiz-session', component: QuizSessionView },
    { path: '/certs/:certCode/quiz/review', name: 'quiz-review', component: QuizReviewView },
    { path: '/certs/:certCode/history/:entryId', name: 'quiz-history-review', component: QuizHistoryReviewView, props: true },
    { path: '/certs/:certCode/topic/:topic', name: 'topic-review', component: QuestionBankReviewView, props: true },
    { path: '/certs/:certCode/theme/:themeGroup/:themeValue', name: 'theme-review', component: QuestionBankReviewView, props: true },
    { path: '/certs/:certCode/flagged', name: 'flagged-review', component: QuestionBankReviewView, props: true },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

const { ensureCertLoaded, availableCerts } = useQuizLoader()

router.beforeEach(async (to) => {
  const certCode = to.params.certCode
  if (typeof certCode !== 'string') return
  if (!(await ensureCertLoaded(certCode))) {
    return { name: 'cert-selector' }
  }
})

router.beforeEach((to) => {
  if (to.name === 'auth' && !isAuthAvailable()) {
    return { name: 'welcome' }
  }
})

router.beforeEach((to) => {
  if (to.name !== 'cert-selector') return
  if (useUserAccountStore().accountMode) return
  return { name: 'welcome' }
})

router.beforeEach((to) => {
  if (to.name !== 'welcome') return
  if (useUserAccountStore().accountMode === 'account') return { name: 'cert-selector' }
})

router.beforeEach((to) => {
  if (to.name !== 'quiz-session' && to.name !== 'quiz-review') return
  const session = useQuizSessionStore()
  if (!session.hasSession || session.currentSession?.certCode !== to.params.certCode) {
    return { name: 'quiz-configure', params: { certCode: to.params.certCode } }
  }
  if (to.name === 'quiz-review' && !session.currentSession?.finished) {
    return { name: 'quiz-session', params: { certCode: to.params.certCode } }
  }
})

router.afterEach((to) => {
  const certCode = typeof to.params.certCode === 'string' ? to.params.certCode : undefined
  applyPageMeta(resolvePageMeta(to.name, certCode, availableCerts))
})
