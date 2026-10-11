import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSyncAdapter } from './remoteSync'

const fetchAuthSessionMock = vi.hoisted(() => vi.fn())

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: fetchAuthSessionMock,
}))

vi.mock('../config', () => ({
  awsConfig: {
    region: 'eu-west-3',
    userPoolId: 'eu-west-3_TEST',
    userPoolClientId: 'client-id',
    syncApiUrl: 'https://sync.example.com/sync',
  },
  isAuthConfigured: () => true,
  isSyncConfigured: () => true,
}))

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

describe('remote sync adapter', () => {
  const adapter = getSyncAdapter()

  it('pull sends the bearer token and returns the remote payload', async () => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    const payload = {
      progress: { format: 'quiz-progress', version: 1, exportedAt: '', byExamCode: {} },
      history: null,
      favorites: null,
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    await expect(adapter.pull()).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('https://sync.example.com/sync', {
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('pull rejects on a 401 response so an auth failure cannot act as an empty account', async () => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))

    await expect(adapter.pull()).rejects.toThrow('sync pull failed: 401')
  })

  it('pull rejects when the auth session cannot be retrieved, without sending a tokenless request', async () => {
    fetchAuthSessionMock.mockRejectedValue(new Error('session expired'))
    fetchMock.mockResolvedValue(new Response('', { status: 401 }))

    await expect(adapter.pull()).rejects.toThrow('session expired')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('push sends the payload with the bearer token and throws on failure', async () => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    fetchMock.mockResolvedValue(new Response('', { status: 200 }))

    const payload = { progress: null, history: null, favorites: null }
    await expect(adapter.push(payload)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('https://sync.example.com/sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' },
      body: JSON.stringify(payload),
    })

    fetchMock.mockResolvedValue(new Response('', { status: 401 }))
    await expect(adapter.push(payload)).rejects.toThrow('sync push failed: 401')
  })

  it('push forwards the abort signal so an in-flight PUT can be cancelled when the session becomes invalid (e.g. account switching)', async () => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    const controller = new AbortController()
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    const payload = { progress: null, history: null, favorites: null }
    const pushPromise = adapter.push(payload, undefined, controller.signal)

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    controller.abort()

    await expect(pushPromise).rejects.toThrow('Aborted')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sync.example.com/sync',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('pull rejects a payload whose progress.byExamCode is not a plain object', async () => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    const payload = {
      progress: { format: 'quiz-progress', version: 1, exportedAt: '', byExamCode: 'not-an-object' },
      history: null,
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    await expect(adapter.pull()).rejects.toThrow('sync pull failed: invalid progress.byExamCode')
  })

  it('pull rejects a payload whose history.entries is not an array', async () => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    const payload = {
      progress: null,
      history: { format: 'quiz-history', version: 1, exportedAt: '', entries: 'not-an-array' },
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    await expect(adapter.pull()).rejects.toThrow('sync pull failed: invalid history.entries')
  })

  it.each([
    ['progress', { history: null }, 'sync pull failed: missing progress'],
    ['history', { progress: null }, 'sync pull failed: missing history'],
  ])('pull rejects a payload missing the %s key', async (_key, payload, expectedError) => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }))

    await expect(adapter.pull()).rejects.toThrow(expectedError)
  })

  it.each([
    ['progress.format is wrong', { format: 'other', version: 1, exportedAt: '', byExamCode: {} }, 'sync pull failed: invalid progress.format'],
    ['progress.version is not a safe integer', { format: 'quiz-progress', version: 1.5, exportedAt: '', byExamCode: {} }, 'sync pull failed: invalid progress.version'],
    ['progress.exportedAt is missing', { format: 'quiz-progress', version: 1, byExamCode: {} }, 'sync pull failed: invalid progress.exportedAt'],
  ])('pull rejects a payload whose %s (same envelope check the push Lambda enforces)', async (_label, progress, expectedError) => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ progress, history: null }), { status: 200 }))

    await expect(adapter.pull()).rejects.toThrow(expectedError)
  })

  it.each([
    ['history.format is wrong', { format: 'other', version: 1, exportedAt: '', entries: [] }, 'sync pull failed: invalid history.format'],
    ['history.version is not a safe integer', { format: 'quiz-history', version: 1.5, exportedAt: '', entries: [] }, 'sync pull failed: invalid history.version'],
    ['history.exportedAt is missing', { format: 'quiz-history', version: 1, entries: [] }, 'sync pull failed: invalid history.exportedAt'],
  ])('pull rejects a payload whose %s (same envelope check the push Lambda enforces)', async (_label, history, expectedError) => {
    fetchAuthSessionMock.mockResolvedValue({ tokens: { accessToken: 'token-1' } })
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ progress: null, history }), { status: 200 }))

    await expect(adapter.pull()).rejects.toThrow(expectedError)
  })
})
