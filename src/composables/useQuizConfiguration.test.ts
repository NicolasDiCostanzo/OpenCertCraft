import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { router } from '../router'
import { useQuizSessionStore } from '../stores/quizSession'
import { useUserAccountStore } from '../stores/userAccount'
import { useUserProgressStore } from '../stores/userProgress'
import type { ReplayMode } from '../types'

vi.mock('./useQuizLoader', async () => {
  const { examCertBundle } = await import('../utils/fixtures/certBundle.fixture')
  return {
    useQuizLoader: () => ({
      availableCerts: [],
      ensureCertLoaded: async () => true,
      getCert: () => examCertBundle,
      activePool: () => examCertBundle.questions,
    }),
  }
})

import { examCertBundle } from '../utils/fixtures/certBundle.fixture'
import { useQuizConfiguration } from './useQuizConfiguration'

const wrongIds = Array.from({ length: 12 }, (_, index) => `sec-${index + 1}`)
const flaggedIds = ['dep-1', 'dep-2', 'dep-3']

let wrapper: ReturnType<typeof mount> | undefined
const certCodeSource = ref(examCertBundle.exam.code)

function setup() {
  certCodeSource.value = examCertBundle.exam.code
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserAccountStore().accountMode = 'local'
  const progress = useUserProgressStore()
  for (const id of wrongIds) progress.recordAnswer(examCertBundle.exam.code, id, false)
  for (const id of flaggedIds) progress.toggleFlag(examCertBundle.exam.code, id)

  let config!: ReturnType<typeof useQuizConfiguration>
  wrapper = mount(
    defineComponent({
      setup() {
        config = useQuizConfiguration(
          computed(() => certCodeSource.value),
          computed(() => examCertBundle),
          computed(() => examCertBundle.questions),
        )
        return () => null
      },
    }),
    { global: { plugins: [pinia, router] } },
  )
  return config
}

beforeEach(async () => {
  setActivePinia(createPinia())
  useUserAccountStore().accountMode = 'local'
  await router.push('/')
})

afterEach(() => {
  wrapper?.unmount()
})

describe('useQuizConfiguration in exam mode', () => {
  it('builds the real weighted exam with the real time limit, ignoring count and filters', async () => {
    const config = setup()
    config.mode.value = 'exam'
    config.count.value = 3
    config.selectedTopics.value = ['Security']
    config.includeGroups.services = { values: ['lambda'], match: 'any' }

    await config.startQuiz()

    const session = useQuizSessionStore().currentSession!
    const byTopic = (topic: string) => session.questions.filter((question) => question.topic === topic).length
    expect(session.mode).toBe('exam')
    expect(session.questions).toHaveLength(examCertBundle.exam.totalQuestions)
    expect([byTopic('Security'), byTopic('Deployment')]).toEqual([6, 4])
    expect(session.deadlineAt! - session.startedAt).toBe(examCertBundle.exam.timeLimitMinutes * 60_000)
  })

  it.each<[ReplayMode, boolean]>([
    ['all', true],
    ['wrong', true],
    ['flagged', false],
    ['unattempted', true],
  ])('replay %s is selectable only when it can fill the exam: %s', (replay, expected) => {
    const config = setup()

    expect(config.examReplayAvailability.value[replay]).toBe(expected)
  })

  it('draws the exam from the replay pool only', async () => {
    const config = setup()
    config.mode.value = 'exam'
    config.replayMode.value = 'wrong'

    await config.startQuiz()

    const ids = useQuizSessionStore().currentSession!.questions.map((question) => question.id)
    expect(ids).toHaveLength(examCertBundle.exam.totalQuestions)
    expect(ids.every((id) => wrongIds.includes(id))).toBe(true)
  })

  it.each<[ReplayMode, ReplayMode]>([
    ['flagged', 'all'],
    ['wrong', 'wrong'],
  ])('switching to exam with replay %s leaves replay %s', async (initial, expected) => {
    const config = setup()
    config.replayMode.value = initial

    config.mode.value = 'exam'
    await nextTick()

    expect(config.replayMode.value).toBe(expected)
  })
})

describe('useQuizConfiguration timer', () => {
  it('defaults the timer to off with the real exam duration as its length', () => {
    const config = setup()

    expect(config.timerEnabled.value).toBe(false)
    expect(config.timerMinutes.value).toBe(examCertBundle.exam.timeLimitMinutes)
  })

  it('turns the timer off when the certification changes', async () => {
    const config = setup()
    config.timerEnabled.value = true

    certCodeSource.value = 'OTHER-CERT'
    await nextTick()

    expect(config.timerEnabled.value).toBe(false)
  })

  it.each([
    { mode: 'preparation', timerEnabled: false, timerMinutes: 45, expectedMinutes: undefined },
    { mode: 'preparation', timerEnabled: true, timerMinutes: 45, expectedMinutes: 45 },
    { mode: 'preparation', timerEnabled: true, timerMinutes: 9999, expectedMinutes: 9999 },
    { mode: 'exam', timerEnabled: false, timerMinutes: 5, expectedMinutes: examCertBundle.exam.timeLimitMinutes },
    { mode: 'exam', timerEnabled: true, timerMinutes: 5, expectedMinutes: examCertBundle.exam.timeLimitMinutes },
  ] as const)(
    '$mode with timer enabled=$timerEnabled and $timerMinutes min gives a $expectedMinutes min deadline',
    async ({ mode, timerEnabled, timerMinutes, expectedMinutes }) => {
      const config = setup()
      config.mode.value = mode
      config.timerEnabled.value = timerEnabled
      config.timerMinutes.value = timerMinutes

      await config.startQuiz()

      const session = useQuizSessionStore().currentSession!
      const deadline = session.deadlineAt === undefined ? undefined : session.deadlineAt - session.startedAt
      expect(deadline).toBe(expectedMinutes === undefined ? undefined : expectedMinutes * 60_000)
    },
  )
})
