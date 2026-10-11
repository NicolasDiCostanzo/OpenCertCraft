import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useQuizHistoryStore } from '../stores/quizHistory'
import { useUserAccountStore } from '../stores/userAccount'
import { useUserFavoritesStore } from '../stores/userFavorites'
import { useUserProgressStore } from '../stores/userProgress'
import { texts } from '../texts/en'
import WelcomeView from './WelcomeView.vue'

let authConfigured = true
let syncConfigured = true
vi.mock('../config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config')>()),
  awsConfig: { region: undefined, userPoolId: undefined, userPoolClientId: undefined, syncApiUrl: undefined },
  isAuthAvailable: () => authConfigured,
  isSyncConfigured: () => syncConfigured,
}))

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
createApp({ render: () => null }).use(pinia)
setActivePinia(pinia)

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/welcome', name: 'welcome', component: WelcomeView },
    { path: '/auth', name: 'auth', component: { template: '<div/>' } },
    { path: '/', name: 'cert-selector', component: { template: '<div/>' } },
  ],
})

function mountWelcome() {
  return mount(WelcomeView, { global: { plugins: [pinia, router] } })
}

beforeEach(() => {
  authConfigured = true
  syncConfigured = true
  const account = useUserAccountStore()
  account.accountMode = null
  account.user = null
  useUserProgressStore().replaceAll({})
  useQuizHistoryStore().replaceAll([])
  useUserFavoritesStore().replaceAll([])
})

describe('WelcomeView', () => {
  it.each([
    ['existing account', 'signin', 'welcomeExistingAccountCta' as const],
    ['new account', 'signup', 'welcomeNewAccountCta' as const],
  ])('the %s button opens the auth form in %s mode', async (_name, mode, ctaKey) => {
    const wrapper = mountWelcome()
    const target = wrapper.findAll('.welcome-sync__btn').find((btn) => btn.text() === texts[ctaKey])
    expect(target?.exists()).toBe(true)
    await target?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('auth')
    expect(router.currentRoute.value.query.mode).toBe(mode)
  })

  it('continuing locally goes straight to the cert selector without any auth step', async () => {
    const wrapper = mountWelcome()
    await wrapper.get('.welcome__start .btn--primary').trigger('click')
    await flushPromises()

    expect(useUserAccountStore().accountMode).toBe('local')
    expect(router.currentRoute.value.name).toBe('cert-selector')
  })

  it('shows the sync card with real buttons when authentication is configured', () => {
    const wrapper = mountWelcome()

    expect(wrapper.find('.welcome-sync').exists()).toBe(true)
    expect(wrapper.find('.welcome__start .welcome-card--primary').exists()).toBe(true)
    expect(wrapper.text()).toContain(texts.welcomeSyncTitle)
  })

  it('offers only the local option when authentication is not configured', () => {
    authConfigured = false
    useUserProgressStore().byExamCode['DVA-C02'] = {
      q1: { questionId: 'q1', attempts: 1, timesCorrect: 1, timesWrong: 0, flagged: false, lastSeenAt: 1 },
    }
    const wrapper = mountWelcome()

    expect(wrapper.findAll('.btn--primary')).toHaveLength(1)
    expect(wrapper.text()).toContain(texts.welcomeNoAccount)
    expect(wrapper.text()).not.toContain(texts.welcomeSyncTitle)
    expect(wrapper.text()).not.toContain(texts.welcomeUploadDataCta)
    expect(wrapper.text()).not.toContain(texts.welcomeNoAccountDesc)
  })

  it('offers the upload option only when the device has local data, and routes to auth with the upload flag', async () => {
    useUserProgressStore().byExamCode['DVA-C02'] = {
      q1: { questionId: 'q1', attempts: 1, timesCorrect: 1, timesWrong: 0, flagged: false, lastSeenAt: 1 },
    }
    const wrapper = mountWelcome()

    expect(wrapper.text()).toContain(texts.welcomeUploadDataCta)
    expect(wrapper.text()).toContain(texts.welcomeNoAccountDesc)

    await wrapper.find('.welcome-card--secondary .btn--primary').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('auth')
    expect(router.currentRoute.value.query.upload).toBe('1')
  })

  it('hides the upload option when the device has no local data', () => {
    const wrapper = mountWelcome()

    expect(wrapper.text()).not.toContain(texts.welcomeUploadDataCta)
  })

  it('offers the upload option when the device only has favorites', () => {
    useUserFavoritesStore().certCodes.push('DVA-C02')
    const wrapper = mountWelcome()

    expect(wrapper.text()).toContain(texts.welcomeUploadDataCta)
  })
})
