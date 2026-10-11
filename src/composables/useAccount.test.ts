import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { useQuizHistoryStore } from '../stores/quizHistory'
import { useUserAccountStore } from '../stores/userAccount'
import { useUserFavoritesStore } from '../stores/userFavorites'
import { useUserProgressStore } from '../stores/userProgress'
import { texts } from '../texts/en'
import type { AuthUser, RemoteSyncPayload } from '../types'

const pushRoute = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushRoute }),
}))

vi.mock('../services/auth', () => ({
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  restoreSession: vi.fn(),
}))

let syncConfigured = true
vi.mock('../config', () => ({
  isSyncConfigured: () => syncConfigured,
}))

const adapter = { pull: vi.fn(), push: vi.fn() }
vi.mock('../services/remoteSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/remoteSync')>()
  return {
    ...actual,
    getSyncAdapter: () => adapter,
    InvalidPullPayload: actual.InvalidPullPayload,
  }
})

let auth!: typeof import('../services/auth')
let useAccount!: typeof import('./useAccount').useAccount

const USER: AuthUser = { userId: 'sub-1', email: 'dev@example.com' }

const historyEntry = {
  id: 'h1',
  certCode: 'DVA-C02',
  mode: 'preparation' as const,
  startedAt: 1,
  finishedAt: 2,
  questionIds: ['q1'],
  answers: {},
  flags: [],
  result: { percentCorrect: 100, passed: true, timesCorrect: 1, totalAnswered: 1 },
}

function makePayload(): RemoteSyncPayload {
  const exportedAt = new Date().toISOString()
  return {
    progress: {
      format: 'quiz-progress',
      version: 1,
      exportedAt,
      byExamCode: {
        'DVA-C02': { q1: { questionId: 'q1', attempts: 1, timesCorrect: 1, timesWrong: 0, flagged: false, lastSeenAt: 1 } },
      },
    },
    history: { format: 'quiz-history', version: 1, exportedAt, entries: [historyEntry] },
    favorites: { format: 'quiz-favorites', version: 1, exportedAt, certCodes: ['DVA-C02'] },
  }
}

function seedDeviceData() {
  const progressStore = useUserProgressStore()
  progressStore.byExamCode['DVA-C02'] = {
    qDev: { questionId: 'qDev', attempts: 3, timesCorrect: 1, timesWrong: 2, flagged: true, lastSeenAt: 999 },
  }
  const historyStore = useQuizHistoryStore()
  historyStore.entries.push({
    id: 'hDev',
    certCode: 'DVA-C02',
    mode: 'exam',
    startedAt: 10,
    finishedAt: 20,
    questionIds: ['qDev'],
    answers: {},
    flags: ['qDev'],
    result: { percentCorrect: 0, passed: false, timesCorrect: 0, totalAnswered: 1 },
  })
  const favoritesStore = useUserFavoritesStore()
  favoritesStore.certCodes.push('DVA-C02')
}

beforeEach(async () => {
  // useAccount.ts keeps module-level state (syncSession, pendingPush, the
  // debounce timer): resetting modules and re-importing forces fresh bindings
  // for each test instead of leaking settled/rejected promises across tests.
  vi.resetModules()
  localStorage.clear()
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  createApp({ render: () => null }).use(pinia)
  setActivePinia(pinia)
  vi.clearAllMocks()
  syncConfigured = true
  pushRoute.mockResolvedValue(undefined)
  auth = await import('../services/auth')
  vi.mocked(auth.restoreSession).mockResolvedValue(null)
  ;({ useAccount } = await import('./useAccount'))
})

describe('useAccount sign-in', () => {
  it('replaces device data with the account data pulled from the backend and never pushes at sign-in', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())

    await useAccount().signIn('dev@example.com', 'Passw0rd!')

    const account = useUserAccountStore()
    expect(account.user).toEqual(USER)
    expect(account.accountMode).toBe('account')
    expect(adapter.pull).toHaveBeenCalledOnce()
    expect(adapter.push).not.toHaveBeenCalled()

    const progressStore = useUserProgressStore()
    expect(progressStore.byExamCode['DVA-C02']?.q1?.attempts).toBe(1)
    expect(progressStore.byExamCode['DVA-C02']?.qDev).toBeUndefined()
    expect(useQuizHistoryStore().entries).toEqual([historyEntry])

    expect(useUserFavoritesStore().certCodes).toEqual(['DVA-C02'])
    expect(account.guestProgress).not.toBeNull()
    expect(account.guestHistory?.entries.map((e) => e.id)).toEqual(['hDev'])
    expect(account.guestFavorites?.certCodes).toEqual(['DVA-C02'])
    expect(pushRoute).toHaveBeenCalledWith({ name: 'cert-selector' })
  })

  it('a failed sign-in leaves the account untouched and navigates nowhere', async () => {
    vi.mocked(auth.signIn).mockRejectedValue(new Error('NotAuthorizedException'))

    await expect(useAccount().signIn('dev@example.com', 'wrong')).rejects.toThrow()

    expect(useUserAccountStore().accountMode).toBeNull()
    expect(adapter.pull).not.toHaveBeenCalled()
    expect(pushRoute).not.toHaveBeenCalled()
  })

  it('a failing pull clears the stores and reports syncError without blocking sign-in', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockRejectedValue(new Error('offline'))

    const { signIn, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    expect(syncError.value).toBe(texts.syncFailed)
    expect(useUserAccountStore().accountMode).toBe('account')
    expect(useUserProgressStore().byExamCode).toEqual({})
    expect(useQuizHistoryStore().entries).toEqual([])
    expect(pushRoute).toHaveBeenCalledWith({ name: 'cert-selector' })
  })

  it.each([
    ['progress', (p: RemoteSyncPayload) => ({ ...p, progress: { ...p.progress!, version: 2 } })],
    ['history', (p: RemoteSyncPayload) => ({ ...p, history: { ...p.history!, format: 'quiz-history-v2' } })],
  ])(
    'a %s document in an unsupported format reports syncError, leaves local data untouched, and disables push',
    async (_doc, mutate) => {
      seedDeviceData()
      vi.mocked(auth.signIn).mockResolvedValue(USER)
      adapter.pull.mockResolvedValue(mutate(makePayload()))

      const { signIn, pushLocalData, syncError } = useAccount()
      await signIn('dev@example.com', 'Passw0rd!')

      expect(syncError.value).toBe(texts.syncFailed)
      expect(useUserProgressStore().byExamCode['DVA-C02']?.qDev).toBeDefined()
      expect(useQuizHistoryStore().entries.map((e) => e.id)).toEqual(['hDev'])

      await pushLocalData()
      expect(adapter.push).not.toHaveBeenCalled()
    },
  )

  it('signing out after a failed initial pull keeps local data as-is instead of restoring the stale guest snapshot', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    adapter.pull.mockRejectedValue(new Error('offline'))

    const { signIn, signOut } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    useUserProgressStore().recordAnswer('DVA-C02', 'qNew', true)

    await signOut()

    expect(adapter.push).not.toHaveBeenCalled()
    expect(useUserProgressStore().byExamCode['DVA-C02']?.qNew?.attempts).toBe(1)
    expect(useUserAccountStore().guestProgress).toBeNull()
  })

  it('signing in while already signed in does not overwrite the guest snapshot', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())
    const { signIn } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    const progressStore = useUserProgressStore()
    progressStore.byExamCode['DVA-C02'] = {
      qAccount: { questionId: 'qAccount', attempts: 1, timesCorrect: 0, timesWrong: 1, flagged: false, lastSeenAt: 50 },
    }
    await signIn('dev@example.com', 'Passw0rd!')

    const account = useUserAccountStore()
    expect(account.guestProgress?.byExamCode['DVA-C02']?.qDev).toBeDefined()
    expect(account.guestProgress?.byExamCode['DVA-C02']?.qAccount).toBeUndefined()
  })

  it('a failing push is reported through syncError', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockRejectedValue(new Error('offline'))

    const { signIn, pushLocalData, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')
    await pushLocalData()

    expect(syncError.value).toBe(texts.syncFailed)
    expect(useUserAccountStore().accountMode).toBe('account')
  })

  it('push is a no-op when not signed in to an account', async () => {
    await useAccount().continueLocal()
    seedDeviceData()

    await useAccount().pushLocalData()

    expect(adapter.push).not.toHaveBeenCalled()
  })
})

describe('useAccount sign-up', () => {
  it('reports whether email confirmation is required', async () => {
    vi.mocked(auth.signUp).mockResolvedValue(true)

    await expect(useAccount().signUp('dev@example.com', 'Passw0rd!')).resolves.toBe(true)
    expect(auth.signUp).toHaveBeenCalledWith('dev@example.com', 'Passw0rd!')
  })

  it('confirming the code signs the user in and completes authentication', async () => {
    vi.mocked(auth.confirmSignUp).mockResolvedValue(undefined)
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockResolvedValue(undefined)

    await useAccount().confirmSignUp('dev@example.com', '123456', 'Passw0rd!')

    expect(auth.confirmSignUp).toHaveBeenCalledWith('dev@example.com', '123456')
    expect(auth.signIn).toHaveBeenCalledWith('dev@example.com', 'Passw0rd!')
    expect(useUserAccountStore().user).toEqual(USER)
    expect(useUserAccountStore().accountMode).toBe('account')
  })

  it('a confirmation whose automatic sign-in fails reports it without signing the account in', async () => {
    vi.mocked(auth.confirmSignUp).mockResolvedValue(undefined)
    vi.mocked(auth.signIn).mockRejectedValue(new Error('sign-in did not complete'))

    await expect(useAccount().confirmSignUp('dev@example.com', '123456', '')).rejects.toMatchObject({
      name: 'ConfirmAutoSignInError',
    })

    expect(useUserAccountStore().accountMode).toBeNull()
    expect(pushRoute).not.toHaveBeenCalled()
  })

  it('a failure after a successful automatic sign-in is not reported as a sign-in failure and keeps the account signed in', async () => {
    vi.mocked(auth.confirmSignUp).mockResolvedValue(undefined)
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    pushRoute.mockRejectedValue(new Error('navigation failed'))

    await expect(useAccount().confirmSignUp('dev@example.com', '123456', 'Passw0rd!')).rejects.toThrow(
      'navigation failed',
    )

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(useUserAccountStore().accountMode).toBe('account')
    expect(useUserAccountStore().user).toEqual(USER)
  })
})

describe('useAccount password reset', () => {
  it('requesting a reset delegates to the auth service untouched', async () => {
    vi.mocked(auth.requestPasswordReset).mockResolvedValue(undefined)

    await useAccount().requestPasswordReset('dev@example.com')

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('dev@example.com')
    expect(pushRoute).not.toHaveBeenCalled()
  })

  it('confirming a reset signs the user in with the new password and completes authentication', async () => {
    vi.mocked(auth.confirmPasswordReset).mockResolvedValue(undefined)
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockResolvedValue(undefined)

    await useAccount().confirmPasswordReset('dev@example.com', '123456', 'NewPassw0rd!')

    expect(auth.confirmPasswordReset).toHaveBeenCalledWith('dev@example.com', '123456', 'NewPassw0rd!')
    expect(auth.signIn).toHaveBeenCalledWith('dev@example.com', 'NewPassw0rd!')
    expect(useUserAccountStore().user).toEqual(USER)
    expect(useUserAccountStore().accountMode).toBe('account')
  })

  it('a failed reset confirmation leaves the account untouched and never signs in', async () => {
    vi.mocked(auth.confirmPasswordReset).mockRejectedValue(new Error('ExpiredCodeException'))

    await expect(useAccount().confirmPasswordReset('dev@example.com', 'wrong', 'NewPassw0rd!')).rejects.toThrow()

    expect(auth.signIn).not.toHaveBeenCalled()
    expect(useUserAccountStore().accountMode).toBeNull()
    expect(pushRoute).not.toHaveBeenCalled()
  })

  it('a failure after a successful automatic sign-in is not reported as a sign-in failure and keeps the account signed in', async () => {
    vi.mocked(auth.confirmPasswordReset).mockResolvedValue(undefined)
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    pushRoute.mockRejectedValue(new Error('navigation failed'))

    await expect(
      useAccount().confirmPasswordReset('dev@example.com', '123456', 'NewPassw0rd!'),
    ).rejects.toThrow('navigation failed')

    expect(auth.signOut).not.toHaveBeenCalled()
    expect(useUserAccountStore().accountMode).toBe('account')
    expect(useUserAccountStore().user).toEqual(USER)
  })

  it('resending the confirmation code delegates to the auth service untouched', async () => {
    vi.mocked(auth.resendSignUpCode).mockResolvedValue(undefined)

    await useAccount().resendConfirmationCode('dev@example.com')

    expect(auth.resendSignUpCode).toHaveBeenCalledWith('dev@example.com')
    expect(pushRoute).not.toHaveBeenCalled()
  })
})

describe('useAccount guest migration', () => {
  it('upload merges guest and remote data, pushes the union and discards the guest snapshot', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())
    adapter.push.mockResolvedValue(undefined)

    await useAccount().signIn('dev@example.com', 'Passw0rd!', { migrateGuest: true })

    const progressStore = useUserProgressStore()
    expect(progressStore.byExamCode['DVA-C02']?.qDev?.attempts).toBe(3)
    expect(progressStore.byExamCode['DVA-C02']?.q1?.attempts).toBe(1)
    expect(useQuizHistoryStore().entries.map((e) => e.id).sort()).toEqual(['h1', 'hDev'])
    expect(adapter.push).toHaveBeenCalledOnce()
    expect(useUserAccountStore().guestProgress).toBeNull()
  })

  it('migration keeps the newest lastSeenAt version of a question present on both sides', async () => {
    const progressStore = useUserProgressStore()
    progressStore.byExamCode['DVA-C02'] = {
      q1: { questionId: 'q1', attempts: 3, timesCorrect: 1, timesWrong: 2, flagged: true, lastSeenAt: 999 },
    }
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue({
      ...makePayload(),
      progress: {
        format: 'quiz-progress',
        version: 1,
        exportedAt: new Date().toISOString(),
        byExamCode: {
          'DVA-C02': { q1: { questionId: 'q1', attempts: 9, timesCorrect: 9, timesWrong: 0, flagged: false, lastSeenAt: 1 } },
        },
      },
    })
    adapter.push.mockResolvedValue(undefined)

    await useAccount().signIn('dev@example.com', 'Passw0rd!', { migrateGuest: true })

    expect(progressStore.byExamCode['DVA-C02']?.q1?.attempts).toBe(3)
  })

  it('a failed pull during migration keeps the guest data in place and never pushes', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockRejectedValue(new Error('offline'))

    const { signIn, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!', { migrateGuest: true })

    expect(syncError.value).toBe(texts.syncFailed)
    expect(useUserProgressStore().byExamCode['DVA-C02']?.qDev?.attempts).toBe(3)
    expect(useUserAccountStore().guestProgress).not.toBeNull()
    expect(adapter.push).not.toHaveBeenCalled()
  })

  it('a remote document in an unsupported format aborts migration, keeps the guest data in place and never pushes', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    const payload = makePayload()
    adapter.pull.mockResolvedValue({ ...payload, progress: { ...payload.progress!, version: 2 } })

    const { signIn, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!', { migrateGuest: true })

    expect(syncError.value).toBe(texts.syncFailed)
    expect(useUserProgressStore().byExamCode['DVA-C02']?.qDev?.attempts).toBe(3)
    expect(useUserProgressStore().byExamCode['DVA-C02']?.q1).toBeUndefined()
    expect(useUserAccountStore().guestProgress).not.toBeNull()
    expect(adapter.push).not.toHaveBeenCalled()
  })

  it('a failed push during migration still signs out, keeping the unsynced merged data as the new local state', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())
    adapter.push.mockRejectedValue(new Error('offline'))

    const { signIn, signOut, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!', { migrateGuest: true })

    expect(syncError.value).toBe(texts.syncFailed)
    expect(useUserAccountStore().guestProgress).not.toBeNull()

    await signOut()

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(useUserAccountStore().accountMode).toBeNull()
    expect(useUserAccountStore().guestProgress).toBeNull()
    expect(useUserProgressStore().byExamCode['DVA-C02']?.qDev?.attempts).toBe(3)
    expect(useUserProgressStore().byExamCode['DVA-C02']?.q1?.attempts).toBe(1)
  })

  it('a slow pull from a stale sign-in cannot clobber a newer account signed in in the meantime', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)

    let releasePullA!: (payload: RemoteSyncPayload | null) => void
    let capturedSignalA: AbortSignal | undefined
    adapter.pull.mockImplementationOnce((signal: AbortSignal) => {
      capturedSignalA = signal
      return new Promise((resolve) => {
        releasePullA = resolve
      })
    })

    const { signIn } = useAccount()
    const signInA = signIn('dev@example.com', 'Passw0rd!')
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(capturedSignalA).toBeDefined()

    const userB: AuthUser = { userId: 'sub-2', email: 'other@example.com' }
    vi.mocked(auth.signIn).mockResolvedValue(userB)
    adapter.pull.mockResolvedValueOnce(makePayload())
    await signIn('other@example.com', 'Passw0rd!')

    expect(capturedSignalA?.aborted).toBe(true)

    releasePullA(null)
    await signInA

    expect(useUserAccountStore().user).toEqual(userB)
    expect(useUserProgressStore().byExamCode['DVA-C02']?.q1?.attempts).toBe(1)
  })

  it('signing out aborts a still in-flight pull from the sign-in it interrupts', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    vi.mocked(auth.signOut).mockResolvedValue(undefined)

    let capturedSignal: AbortSignal | undefined
    adapter.pull.mockImplementationOnce((signal: AbortSignal) => {
      capturedSignal = signal
      return new Promise(() => {})
    })

    const { signIn, signOut } = useAccount()
    const signInPromise = signIn('dev@example.com', 'Passw0rd!')
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(capturedSignal).toBeDefined()

    await signOut()

    expect(capturedSignal?.aborted).toBe(true)
    expect(useUserAccountStore().accountMode).toBeNull()
    void signInPromise
  })

  it('a migration push is invalidated if a different sign-in completes before it resolves', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())

    let releasePush!: () => void
    const blockedPush = new Promise<void>((resolve) => {
      releasePush = resolve
    })
    let capturedIsCurrent: (() => boolean) | undefined
    adapter.push.mockImplementationOnce((_payload: unknown, isCurrent: () => boolean) => {
      capturedIsCurrent = isCurrent
      return blockedPush
    })

    const { signIn } = useAccount()
    const migrationSignIn = signIn('dev@example.com', 'Passw0rd!', { migrateGuest: true })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(capturedIsCurrent).toBeDefined()

    const userB: AuthUser = { userId: 'sub-2', email: 'other@example.com' }
    vi.mocked(auth.signIn).mockResolvedValue(userB)
    adapter.pull.mockResolvedValueOnce(null)
    await signIn('other@example.com', 'Passw0rd!')

    expect(capturedIsCurrent?.()).toBe(false)

    releasePush()
    await migrationSignIn

    expect(useUserAccountStore().guestProgress).not.toBeNull()
    expect(useUserAccountStore().user).toEqual(userB)
  })
})

describe('useAccount push serialization', () => {
  it('serializes concurrent pushes so the newest state is the last one written remotely', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockResolvedValue(undefined)

    const { signIn, pushLocalData } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    let releaseFirst!: () => void
    const blockedFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    adapter.push.mockImplementationOnce(() => blockedFirst)

    const firstCall = pushLocalData()
    useUserProgressStore().recordAnswer('DVA-C02', 'qNew', true)
    const secondCall = pushLocalData()

    releaseFirst()
    await Promise.all([firstCall, secondCall])

    expect(adapter.push).toHaveBeenCalledTimes(2)
    expect(adapter.push.mock.calls[0][0].progress.byExamCode['DVA-C02']?.qNew).toBeUndefined()
    expect(adapter.push.mock.calls[1][0].progress.byExamCode['DVA-C02']?.qNew).toBeDefined()
  })

  it('a failing push does not poison the queue for the next push', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)

    const { signIn, pushLocalData, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    await pushLocalData()
    expect(syncError.value).toBe(texts.syncFailed)

    useUserProgressStore().recordAnswer('DVA-C02', 'q1', true)
    await pushLocalData()
    expect(adapter.push).toHaveBeenCalledTimes(2)
  })

  it('queued pushes never run after sign-out and are not sent under the next account', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    const userB: AuthUser = { userId: 'sub-2', email: 'other@example.com' }
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockResolvedValue(undefined)

    const { signIn, signOut, pushLocalData } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    adapter.push.mockRejectedValueOnce(new Error('offline'))
    await pushLocalData()

    void pushLocalData()
    await Promise.resolve()

    await signOut()

    vi.mocked(auth.signIn).mockResolvedValue(userB)
    await signIn('other@example.com', 'Passw0rd!')

    expect(adapter.push).toHaveBeenCalledTimes(2)
  })

  it('queued account-A pushes are cancelled when account B signs in directly (no sign-out)', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    const userB: AuthUser = { userId: 'sub-2', email: 'other@example.com' }
    adapter.push.mockResolvedValue(undefined)

    const { signIn, pushLocalData } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    let releaseFirst!: () => void
    const blockedFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let capturedIsCurrent: (() => boolean) | undefined
    let capturedSignal: AbortSignal | undefined
    adapter.push.mockImplementationOnce((_payload: unknown, isCurrent: () => boolean, signal: AbortSignal) => {
      capturedIsCurrent = isCurrent
      capturedSignal = signal
      return blockedFirst
    })

    void pushLocalData()
    void pushLocalData()
    await Promise.resolve()

    let releasePull!: () => void
    const blockedPull = new Promise<void>((resolve) => {
      releasePull = resolve
    })
    adapter.pull.mockImplementationOnce(() => blockedPull)

    vi.mocked(auth.signIn).mockResolvedValue(userB)
    const bSignIn = signIn('other@example.com', 'Passw0rd!')
    await Promise.resolve()

    // Guards A's in-flight push from sending under B's freshly retrieved credentials.
    expect(capturedIsCurrent?.()).toBe(false)
    // Cancels the in-flight fetch outright instead of only skipping it post-hoc.
    expect(capturedSignal?.aborted).toBe(true)

    releaseFirst()
    await new Promise((resolve) => setTimeout(resolve, 25))

    releasePull()
    await bSignIn
    await new Promise((resolve) => setTimeout(resolve, 25))

    expect(adapter.push).toHaveBeenCalledTimes(1)
  })
})

describe('useAccount session ends', () => {
  it('signing out restores the guest snapshot captured at sign-in', async () => {
    seedDeviceData()
    useUserFavoritesStore().certCodes.push('SAA-C03')
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())
    const { signIn, signOut } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    expect(useUserFavoritesStore().certCodes).toEqual(['DVA-C02'])

    await signOut()

    const progressStore = useUserProgressStore()
    expect(progressStore.byExamCode['DVA-C02']?.qDev?.attempts).toBe(3)
    expect(progressStore.byExamCode['DVA-C02']?.q1).toBeUndefined()
    expect(useQuizHistoryStore().entries.map((e) => e.id)).toEqual(['hDev'])
    expect(useUserFavoritesStore().certCodes).toEqual(['DVA-C02', 'SAA-C03'])
    expect(useUserAccountStore().guestProgress).toBeNull()
  })

  it('signing out with no guest snapshot clears the stores', async () => {
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    const accountStore = useUserAccountStore()
    accountStore.user = USER
    accountStore.accountMode = 'account'
    useUserProgressStore().byExamCode['DVA-C02'] = {
      qAccount: { questionId: 'qAccount', attempts: 1, timesCorrect: 1, timesWrong: 0, flagged: false, lastSeenAt: 1 },
    }

    await useAccount().signOut()

    expect(useUserProgressStore().byExamCode).toEqual({})
    expect(useQuizHistoryStore().entries).toEqual([])
    expect(useUserFavoritesStore().certCodes).toEqual([])
  })

  it('signing out clears the account state and returns to the welcome screen', async () => {
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    const accountStore = useUserAccountStore()
    accountStore.user = USER
    accountStore.accountMode = 'account'

    await useAccount().signOut()

    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(accountStore.user).toBeNull()
    expect(accountStore.accountMode).toBeNull()
    expect(pushRoute).toHaveBeenCalledWith({ name: 'welcome' })
  })

  it('a failed server sign-out still clears the local account and returns to the welcome screen', async () => {
    vi.mocked(auth.signOut).mockRejectedValue(new Error('network down'))
    const accountStore = useUserAccountStore()
    accountStore.user = USER
    accountStore.accountMode = 'account'

    const { signOut, syncError } = useAccount()
    await signOut()

    expect(syncError.value).toBe(texts.syncFailed)
    expect(accountStore.user).toBeNull()
    expect(accountStore.accountMode).toBeNull()
    expect(pushRoute).toHaveBeenCalledWith({ name: 'welcome' })
  })

  it('signing out while a sign-in pull is still in flight is not overridden once that pull settles', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    vi.mocked(auth.signOut).mockResolvedValue(undefined)

    let releasePull!: (payload: RemoteSyncPayload | null) => void
    let capturedSignal: AbortSignal | undefined
    adapter.pull.mockImplementationOnce((signal: AbortSignal) => {
      capturedSignal = signal
      return new Promise((resolve) => {
        releasePull = resolve
      })
    })

    const { signIn, signOut } = useAccount()
    const signInPromise = signIn('dev@example.com', 'Passw0rd!')
    await vi.waitFor(() => expect(capturedSignal).toBeDefined())
    expect(capturedSignal).toBeDefined()

    await signOut()
    expect(pushRoute).toHaveBeenLastCalledWith({ name: 'welcome' })

    releasePull(makePayload())
    await signInPromise

    expect(pushRoute).toHaveBeenLastCalledWith({ name: 'welcome' })
    expect(useUserAccountStore().accountMode).toBeNull()
  })

  it('continuing locally never syncs and opens the cert selector', async () => {
    await useAccount().continueLocal()

    expect(useUserAccountStore().accountMode).toBe('local')
    expect(useUserAccountStore().user).toBeNull()
    expect(adapter.pull).not.toHaveBeenCalled()
    expect(adapter.push).not.toHaveBeenCalled()
    expect(pushRoute).toHaveBeenCalledWith({ name: 'cert-selector' })
  })
})

describe('useAccount loadAccountData with invalid remote payload', () => {
  it('preserves local progress and history stores when the server returns an invalid progress format', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)

    const progressStore = useUserProgressStore()
    const historyStore = useQuizHistoryStore()
    const beforeProgress = JSON.parse(JSON.stringify(progressStore.byExamCode))
    const beforeHistory = JSON.parse(JSON.stringify(historyStore.entries))

    // Adapter returns a payload with an invalid progress.format — this should NOT
    // clear the local stores, only set syncError.
    adapter.pull.mockResolvedValue({
      progress: { format: 'wrong-format', version: 1, exportedAt: '', byExamCode: {} },
      history: { format: 'quiz-history', version: 1, exportedAt: '', entries: [] },
    })

    const { signIn, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    // Stores must be preserved — invalid remote data should not wipe them.
    expect(progressStore.byExamCode).toEqual(beforeProgress)
    expect(historyStore.entries).toEqual(beforeHistory)
    expect(syncError.value).toBe(texts.syncFailed)
  })

  it('preserves local progress and history stores when the server returns an invalid history format', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)

    const progressStore = useUserProgressStore()
    const historyStore = useQuizHistoryStore()
    const beforeProgress = JSON.parse(JSON.stringify(progressStore.byExamCode))
    const beforeHistory = JSON.parse(JSON.stringify(historyStore.entries))

    adapter.pull.mockResolvedValue({
      progress: { format: 'quiz-progress', version: 1, exportedAt: '', byExamCode: {} },
      history: { format: 'wrong-format', version: 1, exportedAt: '', entries: [] },
    })

    const { signIn, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    expect(progressStore.byExamCode).toEqual(beforeProgress)
    expect(historyStore.entries).toEqual(beforeHistory)
    expect(syncError.value).toBe(texts.syncFailed)
  })

  it('still clears stores on a genuine sync failure (network error), not an invalid payload', async () => {
    seedDeviceData()
    vi.mocked(auth.signIn).mockResolvedValue(USER)

    const progressStore = useUserProgressStore()
    const historyStore = useQuizHistoryStore()

    // Genuine network failure — stores should be cleared (existing behavior preserved).
    adapter.pull.mockRejectedValue(new Error('network unreachable'))

    const { signIn, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    expect(progressStore.byExamCode).toEqual({})
    expect(historyStore.entries).toEqual([])
    expect(syncError.value).toBe(texts.syncFailed)
  })
})

describe('useAccount pushLocalDataDebounced', () => {
  it('coalesces a burst of calls into a single push of the latest state', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockResolvedValue(undefined)

    const { signIn, pushLocalDataDebounced } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    void pushLocalDataDebounced(10)
    useUserProgressStore().recordAnswer('DVA-C02', 'q1', true)
    void pushLocalDataDebounced(10)
    useUserProgressStore().recordAnswer('DVA-C02', 'q2', true)
    const last = pushLocalDataDebounced(10)
    await last

    expect(adapter.push).toHaveBeenCalledTimes(1)
    const [pushedPayload] = adapter.push.mock.calls[0]
    expect(pushedPayload.progress.byExamCode['DVA-C02']?.q1).toBeDefined()
    expect(pushedPayload.progress.byExamCode['DVA-C02']?.q2).toBeDefined()
  })

  it('signing out flushes a still-pending debounced push, completing it before auth.signOut is invoked', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockResolvedValue(undefined)

    const { signIn, signOut, pushLocalDataDebounced } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')

    void pushLocalDataDebounced(10_000)
    await signOut()

    expect(adapter.push).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledOnce()
    expect(adapter.push.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(auth.signOut).mock.invocationCallOrder[0],
    )
  })

  it('a pending push that fails to sync still completes sign-out, keeping the unsynced data local', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockRejectedValue(new Error('offline'))

    const { signIn, signOut, pushLocalDataDebounced, syncError } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')
    useUserProgressStore().recordAnswer('DVA-C02', 'qUnsynced', true)

    void pushLocalDataDebounced(10)
    await signOut()

    expect(syncError.value).toBe(texts.syncFailed)
    expect(auth.signOut).toHaveBeenCalledOnce()
    const account = useUserAccountStore()
    expect(account.accountMode).toBeNull()
    expect(account.user).toBeNull()
    expect(useUserProgressStore().byExamCode['DVA-C02']?.qUnsynced).toBeDefined()
    expect(pushRoute).toHaveBeenCalledWith({ name: 'welcome' })
  })

  it('a second sign-out attempt is not trapped by the previous rejected push', async () => {
    vi.mocked(auth.signIn).mockResolvedValue(USER)
    vi.mocked(auth.signOut).mockResolvedValue(undefined)
    adapter.pull.mockResolvedValue(null)
    adapter.push.mockRejectedValue(new Error('offline'))

    const { signIn, signOut, pushLocalData } = useAccount()
    await signIn('dev@example.com', 'Passw0rd!')
    await pushLocalData()

    await signOut()
    expect(auth.signOut).toHaveBeenCalledTimes(1)

    await expect(signOut()).resolves.toBeUndefined()
    expect(auth.signOut).toHaveBeenCalledTimes(2)
  })
})

describe('useAccount session restore on load', () => {
  it('signs the user in and pulls the account data when a persisted session is restored', async () => {
    seedDeviceData()
    vi.mocked(auth.restoreSession).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())

    await expect(useAccount().restoreAccountSession()).resolves.toBe(true)

    const account = useUserAccountStore()
    expect(account.user).toEqual(USER)
    expect(account.accountMode).toBe('account')
    expect(adapter.pull).toHaveBeenCalledOnce()

    // The account's data replaces the device's, exactly as at sign-in.
    const progressStore = useUserProgressStore()
    expect(progressStore.byExamCode['DVA-C02']?.q1?.attempts).toBe(1)
    expect(progressStore.byExamCode['DVA-C02']?.qDev).toBeUndefined()
  })

  it('does not re-stash the guest snapshot, so sign-out still restores the pre-sign-in data', async () => {
    seedDeviceData()
    const account = useUserAccountStore()
    account.stashGuest(
      { format: 'quiz-progress', version: 1, exportedAt: '', byExamCode: {} },
      { format: 'quiz-history', version: 1, exportedAt: '', entries: [] },
      { format: 'quiz-favorites', version: 1, exportedAt: '', certCodes: [] },
    )
    vi.mocked(auth.restoreSession).mockResolvedValue(USER)
    adapter.pull.mockResolvedValue(makePayload())

    await useAccount().restoreAccountSession()

    expect(account.guestProgress).not.toBeNull()
    expect(account.guestHistory?.entries.map((e) => e.id)).toEqual([])
  })

  it('clears a stale persisted account mode when no session can be restored', async () => {
    const account = useUserAccountStore()
    account.accountMode = 'account'
    account.user = USER
    vi.mocked(auth.restoreSession).mockResolvedValue(null)

    await expect(useAccount().restoreAccountSession()).resolves.toBe(false)

    expect(account.accountMode).toBeNull()
    expect(account.user).toBeNull()
    expect(adapter.pull).not.toHaveBeenCalled()
  })

  it('leaves a local-only user alone', async () => {
    const account = useUserAccountStore()
    account.accountMode = 'local'
    vi.mocked(auth.restoreSession).mockResolvedValue(null)

    await expect(useAccount().restoreAccountSession()).resolves.toBe(false)

    expect(account.accountMode).toBe('local')
  })

  it('never pulls when no sync backend is configured, so local data is not blanked by the no-op adapter', async () => {
    seedDeviceData()
    syncConfigured = false
    vi.mocked(auth.restoreSession).mockResolvedValue(USER)

    await expect(useAccount().restoreAccountSession()).resolves.toBe(true)

    expect(useUserAccountStore().accountMode).toBe('account')
    expect(adapter.pull).not.toHaveBeenCalled()
    expect(useUserProgressStore().byExamCode['DVA-C02']?.qDev).toBeDefined()
  })

  it('keeps push disabled when the pull fails, so blanked local state cannot overwrite the remote document', async () => {
    seedDeviceData()
    vi.mocked(auth.restoreSession).mockResolvedValue(USER)
    adapter.pull.mockRejectedValue(new Error('offline'))

    const { restoreAccountSession, pushLocalData } = useAccount()
    await restoreAccountSession()
    await pushLocalData()

    expect(adapter.push).not.toHaveBeenCalled()
  })

  it('preserves the persisted account data when the startup pull fails, instead of blanking it', async () => {
    seedDeviceData()
    vi.mocked(auth.restoreSession).mockResolvedValue(USER)
    adapter.pull.mockRejectedValue(new Error('offline'))

    const progressStore = useUserProgressStore()
    const historyStore = useQuizHistoryStore()
    const beforeProgress = JSON.parse(JSON.stringify(progressStore.byExamCode))
    const beforeHistory = JSON.parse(JSON.stringify(historyStore.entries))

    const { restoreAccountSession, syncError } = useAccount()
    await expect(restoreAccountSession()).resolves.toBe(true)

    expect(progressStore.byExamCode).toEqual(beforeProgress)
    expect(historyStore.entries).toEqual(beforeHistory)
    expect(syncError.value).toBe(texts.syncFailed)
  })
})