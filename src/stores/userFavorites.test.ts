import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FavoritesExportFile } from '../types'
import { useUserFavoritesStore } from './userFavorites'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('userFavorites store', () => {
  it('starts with no favorites', () => {
    const store = useUserFavoritesStore()

    expect(store.certCodes).toEqual([])
    expect(store.isFavorite('DVA-C02')).toBe(false)
  })

  it('toggles a certification in and out of favorites', () => {
    const store = useUserFavoritesStore()

    store.toggleFavorite('DVA-C02')

    expect(store.certCodes).toEqual(['DVA-C02'])
    expect(store.isFavorite('DVA-C02')).toBe(true)

    store.toggleFavorite('DVA-C02')

    expect(store.certCodes).toEqual([])
    expect(store.isFavorite('DVA-C02')).toBe(false)
  })

  it('tracks each certification independently', () => {
    const store = useUserFavoritesStore()

    store.toggleFavorite('DVA-C02')
    store.toggleFavorite('SAA-C03')

    expect(store.certCodes).toEqual(['DVA-C02', 'SAA-C03'])
  })

  it('exports favorites in the documented versioned format', () => {
    const store = useUserFavoritesStore()
    store.toggleFavorite('DVA-C02')

    const file = store.exportFavorites()

    expect(file.format).toBe('quiz-favorites')
    expect(file.version).toBe(1)
    expect(file.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(file.certCodes).toEqual(['DVA-C02'])
  })

  it('exports a copy so later mutations do not leak into a captured file', () => {
    const store = useUserFavoritesStore()
    store.toggleFavorite('DVA-C02')

    const file = store.exportFavorites()
    store.toggleFavorite('SAA-C03')

    expect(file.certCodes).toEqual(['DVA-C02'])
  })

  it('import unions remote favorites with the existing ones without duplicating', () => {
    const store = useUserFavoritesStore()
    store.toggleFavorite('DVA-C02')

    store.importFavorites({
      format: 'quiz-favorites',
      version: 1,
      exportedAt: new Date().toISOString(),
      certCodes: ['DVA-C02', 'SAA-C03'],
    })

    expect(store.certCodes).toEqual(['DVA-C02', 'SAA-C03'])
  })

  it('import ignores a document in an unsupported format or version', () => {
    const store = useUserFavoritesStore()
    store.toggleFavorite('DVA-C02')

    store.importFavorites({ format: 'quiz-favorites', version: 2, exportedAt: '', certCodes: ['SAA-C03'] })
    store.importFavorites({ format: 'other', version: 1, exportedAt: '', certCodes: ['SAA-C03'] } as unknown as FavoritesExportFile)

    expect(store.certCodes).toEqual(['DVA-C02'])
  })

  it('replaceAll swaps the whole list with a deep copy', () => {
    const store = useUserFavoritesStore()
    store.toggleFavorite('DVA-C02')
    const incoming = ['SAA-C03', 'CLF-C02']

    store.replaceAll(incoming)

    expect(store.certCodes).toEqual(['SAA-C03', 'CLF-C02'])
    incoming.push('CKA')
    expect(store.certCodes).toEqual(['SAA-C03', 'CLF-C02'])
  })
})
