import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'
import type { FavoritesExportFile, HistoryExportFile, ProgressExportFile } from '../types'
import { useUserAccountStore } from './userAccount'

function createTestPinia() {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  createApp({ render: () => null }).use(pinia)
  setActivePinia(pinia)
  return pinia
}

beforeEach(() => {
  localStorage.clear()
  createTestPinia()
})

describe('userAccount store', () => {
  it('starts with no account mode chosen', () => {
    expect(useUserAccountStore().accountMode).toBeNull()
  })

  it('persists the chosen account mode into a fresh Pinia instance', async () => {
    useUserAccountStore().accountMode = 'local'
    await nextTick()

    createTestPinia()

    expect(useUserAccountStore().user).toBeNull()
    expect(useUserAccountStore().accountMode).toBe('local')
  })

  it('persists the signed-in user into a fresh Pinia instance', async () => {
    useUserAccountStore().user = { userId: 'sub-1', email: 'dev@example.com' }
    await nextTick()

    createTestPinia()

    expect(useUserAccountStore().user).toEqual({ userId: 'sub-1', email: 'dev@example.com' })
  })

  it('takeGuestSnapshot returns the stashed guest data and clears it', () => {
    const store = useUserAccountStore()
    const progress = { format: 'quiz-progress', version: 1, exportedAt: 'now', byExamCode: {} } as ProgressExportFile
    const history = { format: 'quiz-history', version: 1, exportedAt: 'now', entries: [] } as HistoryExportFile
    const favorites = { format: 'quiz-favorites', version: 1, exportedAt: 'now', certCodes: [] } as FavoritesExportFile

    store.stashGuest(progress, history, favorites)
    const snapshot = store.takeGuestSnapshot()

    expect(snapshot.progress).toStrictEqual(progress)
    expect(snapshot.history).toStrictEqual(history)
    expect(snapshot.favorites).toStrictEqual(favorites)
    expect(store.guestProgress).toBeNull()
    expect(store.guestHistory).toBeNull()
    expect(store.guestFavorites).toBeNull()
  })

  it('takeGuestSnapshot returns nulls when nothing was stashed', () => {
    const snapshot = useUserAccountStore().takeGuestSnapshot()

    expect(snapshot.progress).toBeNull()
    expect(snapshot.history).toBeNull()
    expect(snapshot.favorites).toBeNull()
  })

  it('preserves the complete guest history snapshot without truncation', () => {
    const store = useUserAccountStore()
    const progress = { format: 'quiz-progress', version: 1, exportedAt: 'now', byExamCode: {} } as ProgressExportFile
    const entries = Array.from({ length: 60 }, (_, i) => ({
      id: `h${i}`,
      certCode: 'DVA-C02',
      mode: 'preparation' as const,
      startedAt: i,
      finishedAt: i,
      questionIds: [],
      answers: {},
      flags: [],
      result: { percentCorrect: 100, passed: true, timesCorrect: 1, totalAnswered: 1 },
    }))
    const history = { format: 'quiz-history', version: 1, exportedAt: 'now', entries } as HistoryExportFile
    const favorites = { format: 'quiz-favorites', version: 1, exportedAt: 'now', certCodes: [] } as FavoritesExportFile

    store.stashGuest(progress, history, favorites)

    expect(store.guestHistory?.entries).toHaveLength(60)
    expect(store.guestHistory?.entries.map((e) => e.id)).toEqual(entries.map((e) => e.id))
  })
})
