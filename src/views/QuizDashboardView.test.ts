import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useQuizHistoryStore } from '../stores/quizHistory'
import { useUserProgressStore } from '../stores/userProgress'
import QuizDashboardView from './QuizDashboardView.vue'

const defaultQuestions = [
  { id: 'q1', question: 'Q1?', options: ['A', 'B'], answers: 'A', topic: 'Security', themes: { services: ['lambda'] } },
]

const { pushLocalData, bank } = vi.hoisted(() => ({
  pushLocalData: vi.fn(),
  bank: { questions: [] as unknown[] },
}))

vi.mock('../composables/useAccount', () => ({
  useAccount: () => ({ pushLocalData }),
}))

vi.mock('../composables/useQuizLoader', () => ({
  useQuizLoader: () => ({
    groupedCerts: [],
    getCert: () => ({
      version: 1,
      exam: { name: 'Test', code: 'TEST', totalQuestions: 2, timeLimitMinutes: 10, passingScore: { passingScore: 700, scale: 1000 } },
      themes: { services: ['lambda'] },
      questions: bank.questions,
    }),
  }),
}))

const pinia = createPinia()
setActivePinia(pinia)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'cert-selector', component: { template: '<div/>' } },
    { path: '/certs/:certCode', name: 'quiz-dashboard', component: QuizDashboardView, props: true },
    { path: '/certs/:certCode/configure', name: 'quiz-configure', component: { template: '<div/>' } },
    { path: '/certs/:certCode/flagged', name: 'flagged-review', component: { template: '<div/>' } },
    { path: '/certs/:certCode/topic/:topic', name: 'topic-review', component: { template: '<div/>' } },
    { path: '/certs/:certCode/theme/:themeGroup/:themeValue', name: 'theme-review', component: { template: '<div/>' } },
  ],
})

describe('QuizDashboardView', () => {
  beforeEach(() => {
    pushLocalData.mockClear()
    bank.questions = defaultQuestions
    useUserProgressStore().byExamCode = {}
    useQuizHistoryStore().entries = []
  })

  it('shows the flagged review button when a question is flagged without any quiz history', async () => {
    const progressStore = useUserProgressStore()
    progressStore.byExamCode['TEST'] = {
      q1: { questionId: 'q1', attempts: 1, timesCorrect: 0, timesWrong: 1, flagged: true, lastSeenAt: 1 },
    }

    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })

    const button = wrapper.find('.flagged-review-btn')
    expect(button.exists()).toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('shows no review breakdown when there is no history and nothing flagged', async () => {
    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })

    expect(wrapper.find('.flagged-review-btn').exists()).toBe(false)
  })

  it('folds the About this exam section by default while keeping its text in the DOM', async () => {
    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })

    const about = wrapper.find('details.about')
    expect(about.exists()).toBe(true)
    expect(about.attributes('open')).toBeUndefined()
    expect(about.text()).toContain('TEST')
  })

  it('shows sample questions drawn from the bank when some have an explanation', async () => {
    bank.questions = [{ ...defaultQuestions[0], explanation: 'Because A.' }]

    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })

    expect(wrapper.find('.samples').exists()).toBe(true)
    expect(wrapper.find('.samples').text()).toContain('Because A.')
  })

  it('shows no sample section when no bank question is eligible', async () => {
    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })

    expect(wrapper.find('.samples').exists()).toBe(false)
  })

  it('syncs to the backend after deleting a history entry', async () => {
    const historyStore = useQuizHistoryStore()
    historyStore.entries.push({
      id: 'h1',
      certCode: 'TEST',
      mode: 'preparation',
      startedAt: 0,
      finishedAt: 1,
      questionIds: ['q1'],
      answers: {},
      flags: [],
      result: { percentCorrect: 100, passed: true, timesCorrect: 1, totalAnswered: 1 },
    })

    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })

    wrapper.findComponent({ name: 'QuizHistoryList' }).vm.$emit('request-delete', 'h1')
    await wrapper.vm.$nextTick()
    wrapper.findComponent({ name: 'ConfirmModal' }).vm.$emit('confirm')
    await wrapper.vm.$nextTick()

    expect(historyStore.entries).toHaveLength(0)
    expect(pushLocalData).toHaveBeenCalledOnce()
  })

  it('navigates to the history review route when QuizHistoryList emits review', async () => {
    useQuizHistoryStore().entries.push({
      id: 'h1',
      certCode: 'TEST',
      mode: 'preparation',
      startedAt: 0,
      finishedAt: 1,
      questionIds: ['q1'],
      answers: {},
      flags: [],
      result: { percentCorrect: 100, passed: true, timesCorrect: 1, totalAnswered: 1 },
    })

    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    await wrapper.findComponent({ name: 'QuizHistoryList' }).vm.$emit('review', 'h1')

    expect(pushSpy).toHaveBeenCalledWith({ name: 'quiz-history-review', params: { certCode: 'TEST', entryId: 'h1' } })
    pushSpy.mockRestore()
  })

  it('navigates to the flagged review route when ReviewBreakdown emits reviewFlagged', async () => {
    useUserProgressStore().byExamCode['TEST'] = {
      q1: { questionId: 'q1', attempts: 1, timesCorrect: 0, timesWrong: 1, flagged: true, lastSeenAt: 1 },
    }

    await router.push('/certs/TEST')
    const wrapper = mount(QuizDashboardView, { global: { plugins: [pinia, router] }, props: { certCode: 'TEST' } })
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    await wrapper.findComponent({ name: 'ReviewBreakdown' }).vm.$emit('reviewFlagged')

    expect(pushSpy).toHaveBeenCalledWith({ name: 'flagged-review', params: { certCode: 'TEST' } })
    pushSpy.mockRestore()
  })
})
