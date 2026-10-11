import { defineStore } from 'pinia'
import 'pinia-plugin-persistedstate'
import type { FavoritesExportFile } from '../types'

const EXPORT_FORMAT = 'quiz-favorites'
const EXPORT_VERSION = 1

export const useUserFavoritesStore = defineStore('userFavorites', {
  state: () => ({
    certCodes: [] as string[],
  }),

  getters: {
    isFavorite: (state) => (certCode: string): boolean => state.certCodes.includes(certCode),
  },

  actions: {
    toggleFavorite(certCode: string) {
      const index = this.certCodes.indexOf(certCode)
      if (index === -1) this.certCodes.push(certCode)
      else this.certCodes.splice(index, 1)
    },

    exportFavorites(): FavoritesExportFile {
      return {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        certCodes: [...this.certCodes],
      }
    },

    importFavorites(file: FavoritesExportFile) {
      if (file.format !== EXPORT_FORMAT || file.version !== EXPORT_VERSION) return
      for (const code of file.certCodes) {
        if (!this.certCodes.includes(code)) this.certCodes.push(code)
      }
    },

    replaceAll(certCodes: string[]) {
      this.certCodes = JSON.parse(JSON.stringify(certCodes)) as string[]
    },
  },

  persist: true,
})
