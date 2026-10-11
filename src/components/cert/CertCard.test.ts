import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useUserFavoritesStore } from '../../stores/userFavorites'
import { texts } from '../../texts/en'
import type { CertBundleMeta } from '../../types'
import CertCard from './CertCard.vue'

const { pushLocalDataDebounced } = vi.hoisted(() => ({ pushLocalDataDebounced: vi.fn() }))

vi.mock('../../composables/useAccount', () => ({
  useAccount: () => ({ pushLocalDataDebounced }),
}))

const cert: CertBundleMeta = {
  exam: {
    name: 'AWS Developer Associate',
    code: 'DVA-C02',
    totalQuestions: 65,
    timeLimitMinutes: 130,
    passingScore: { passingScore: 720, scale: 1000 },
  },
  questionCount: 200,
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/certs/:certCode', name: 'quiz-dashboard', component: { template: '<div/>' } },
  ],
})

describe('CertCard favorite toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pushLocalDataDebounced.mockClear()
  })

  it('marks the cert as favorite and syncs without navigating away from the card', async () => {
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(CertCard, {
      props: { cert },
      global: { plugins: [router] },
    })

    await wrapper.findComponent({ name: 'FavoriteButton' }).vm.$emit('toggle')
    await wrapper.vm.$nextTick()

    expect(useUserFavoritesStore().isFavorite('DVA-C02')).toBe(true)
    expect(pushLocalDataDebounced).toHaveBeenCalledOnce()
    expect(pushSpy).not.toHaveBeenCalled()
    pushSpy.mockRestore()
  })

  it('un-marks an already favorited cert on a second toggle', async () => {
    useUserFavoritesStore().toggleFavorite('DVA-C02')
    const wrapper = mount(CertCard, {
      props: { cert },
      global: { plugins: [router] },
    })

    expect(wrapper.findComponent({ name: 'FavoriteButton' }).props('active')).toBe(true)

    await wrapper.findComponent({ name: 'FavoriteButton' }).vm.$emit('toggle')
    await wrapper.vm.$nextTick()

    expect(useUserFavoritesStore().isFavorite('DVA-C02')).toBe(false)
  })

  it('a click on the heart button does not bubble up and trigger the card link', async () => {
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(CertCard, {
      props: { cert },
      global: { plugins: [router] },
    })

    await wrapper.find('button.favorite-btn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(useUserFavoritesStore().isFavorite('DVA-C02')).toBe(true)
    expect(pushSpy).not.toHaveBeenCalled()
    pushSpy.mockRestore()
  })

  it('includes the certification name in the accessible label in both states', async () => {
    const wrapper = mount(CertCard, {
      props: { cert },
      global: { plugins: [router] },
    })
    const button = wrapper.find('button.favorite-btn')

    expect(button.attributes('aria-label')).toContain(cert.exam.name)
    expect(button.attributes('aria-label')).toContain(texts.favoriteAdd)

    await wrapper.findComponent({ name: 'FavoriteButton' }).vm.$emit('toggle')
    await wrapper.vm.$nextTick()

    expect(button.attributes('aria-label')).toContain(cert.exam.name)
    expect(button.attributes('aria-label')).toContain(texts.favoriteRemove)
  })
})