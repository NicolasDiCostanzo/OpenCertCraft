import { awsConfig, isSyncConfigured } from '../config'
import type { RemoteSyncPayload } from '../types'
import { validateFavoritesExportFile, validateHistoryExportFile, validateProgressExportFile } from '../utils/syncPayloadValidator'

export class InvalidPullPayload extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPullPayload'
  }
}

export interface RemoteSyncAdapter {
  pull(signal?: AbortSignal): Promise<RemoteSyncPayload | null>
  push(payload: RemoteSyncPayload, isCurrent?: () => boolean, signal?: AbortSignal): Promise<void>
}

const localOnlySyncAdapter: RemoteSyncAdapter = {
  async pull() {
    return null
  },
  async push() {},
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { fetchAuthSession } = await import('aws-amplify/auth')
  const { tokens } = await fetchAuthSession()
  return tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken.toString()}` } : {}
}

function validatePullPayload(value: unknown): RemoteSyncPayload | null {
  if (value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidPullPayload('sync pull failed: invalid payload shape')
  }
  const v = value as Record<string, unknown>
  if (!('progress' in v)) {
    throw new InvalidPullPayload('sync pull failed: missing progress')
  }
  if (v.progress !== null) {
    const errors = validateProgressExportFile(v.progress)
    if (errors.length > 0) throw new InvalidPullPayload(`sync pull failed: ${errors[0]}`)
  }
  if (!('history' in v)) {
    throw new InvalidPullPayload('sync pull failed: missing history')
  }
  if (v.history !== null) {
    const errors = validateHistoryExportFile(v.history)
    if (errors.length > 0) throw new InvalidPullPayload(`sync pull failed: ${errors[0]}`)
  }
  if (v.favorites !== null && v.favorites !== undefined) {
    const errors = validateFavoritesExportFile(v.favorites)
    if (errors.length > 0) throw new InvalidPullPayload(`sync pull failed: ${errors[0]}`)
  }
  return { progress: v.progress ?? null, history: v.history ?? null, favorites: v.favorites ?? null } as unknown as RemoteSyncPayload
}

function createRemoteSyncAdapter(apiUrl: string): RemoteSyncAdapter {
  return {
    async pull(signal) {
      const headers = await getAuthHeaders()
      const res = await fetch(apiUrl, { headers, signal })
      if (res.status === 401) throw new Error('sync pull failed: 401')
      if (!res.ok) throw new Error(`sync pull failed: ${res.status}`)
      return validatePullPayload(await res.json())
    },
    async push(payload, isCurrent, signal) {
      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) }
      if (isCurrent && !isCurrent()) return
      const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(payload), signal })
      if (!res.ok) throw new Error(`sync push failed: ${res.status}`)
    },
  }
}

export function getSyncAdapter(): RemoteSyncAdapter {
  if (isSyncConfigured() && awsConfig.syncApiUrl) {
    return createRemoteSyncAdapter(awsConfig.syncApiUrl)
  }
  return localOnlySyncAdapter
}
