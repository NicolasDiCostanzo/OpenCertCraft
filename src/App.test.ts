import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { router } from './router'
import { useUserAccountStore } from './stores/userAccount'
import { useUserPreferencesStore } from './stores/userPreferences'
import { texts } from './texts/en'

vi.mock('./config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config')>()),
  isAuthAvailable: () => true,
}))

beforeEach(() => {
  setActivePinia(createPinia())
})

let wrapper!: ReturnType<typeof mount>

afterEach(() => { wrapper?.unmount() })

describe('theme mode toggle', () => {
  it.each([
    [false, 'light'],
    [true, 'dark'],
  ] as [boolean, string][])(
    'applies data-theme=%s on <html> when dark=%s',
    async (dark, expected) => {
      wrapper = mount(App, { global: { plugins: [router] } })
      const store = useUserPreferencesStore()

      store.dark = dark
      await wrapper.vm.$nextTick()

      expect(document.documentElement.dataset.theme).toBe(expected)
    },
  )

  it('toggles to light and applies it on click', async () => {
    wrapper = mount(App, { global: { plugins: [router] } })
    const store = useUserPreferencesStore()

    await wrapper.find('.theme-switch').trigger('click')

    expect(store.dark).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(wrapper.find('.theme-switch').attributes('aria-checked')).toBe('false')
  })
})

describe('app title link', () => {
  it('points to the cert selector when a session is active', () => {
    useUserAccountStore().accountMode = 'account'
    wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.find('.app-title').attributes('href')).toBe('/cert')
  })

  it('points to the cert selector in local mode too', () => {
    useUserAccountStore().accountMode = 'local'
    wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.find('.app-title').attributes('href')).toBe('/')
  })

  it('points to the welcome page when no session is active', () => {
    useUserAccountStore().accountMode = null
    wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.find('.app-title').attributes('href')).toBe('/')
  })

  it('routes the sign-in shortcut straight to the auth page in local mode', async () => {
    useUserAccountStore().accountMode = 'local'
    wrapper = mount(App, { global: { plugins: [router] } })

    await wrapper.findAll('button').find((b) => b.text() === texts.signIn)!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('auth')
    expect(router.currentRoute.value.query.mode).toBe('signin')
  })

  it('hides the sign-in shortcut for a signed-in account', () => {
    const account = useUserAccountStore()
    account.accountMode = 'account'
    account.user = { userId: 'sub-1', email: 'dev@example.com' }
    wrapper = mount(App, { global: { plugins: [router] } })

    expect(wrapper.findAll('button').some((b) => b.text() === texts.signIn)).toBe(false)
  })
})
