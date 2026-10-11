import { defineStore } from 'pinia'
import 'pinia-plugin-persistedstate'
import type { AccountMode, AuthUser, FavoritesExportFile, HistoryExportFile, ProgressExportFile } from '../types'

export const useUserAccountStore = defineStore('userAccount', {
  state: (): {
    accountMode: AccountMode | null
    user: AuthUser | null
    guestProgress: ProgressExportFile | null
    guestHistory: HistoryExportFile | null
    guestFavorites: FavoritesExportFile | null
  } => ({
    accountMode: null,
    user: null,
    guestProgress: null,
    guestHistory: null,
    guestFavorites: null,
  }),

  actions: {
    stashGuest(progress: ProgressExportFile, history: HistoryExportFile, favorites: FavoritesExportFile) {
      this.guestProgress = progress
      this.guestHistory = { ...history, entries: [...history.entries] }
      this.guestFavorites = { ...favorites, certCodes: [...favorites.certCodes] }
    },

    takeGuestSnapshot(): { progress: ProgressExportFile | null; history: HistoryExportFile | null; favorites: FavoritesExportFile | null } {
      const snapshot = { progress: this.guestProgress, history: this.guestHistory, favorites: this.guestFavorites }
      this.guestProgress = null
      this.guestHistory = null
      this.guestFavorites = null
      return snapshot
    },
  },

  persist: true,
})
