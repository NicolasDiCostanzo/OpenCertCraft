import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useUserFavoritesStore } from '../../stores/userFavorites'
import type { CertBundleMeta, CertFamilyGroup } from '../../types'
import CertSelector from './CertSelector.vue'

vi.mock('../../composables/useAccount', () => ({
  useAccount: () => ({ pushLocalDataDebounced: vi.fn() }),
}))

function makeCert(code: string, name: string): CertBundleMeta {
  return {
    exam: {
      name,
      code,
      totalQuestions: 65,
      timeLimitMinutes: 130,
      passingScore: { passingScore: 720, scale: 1000 },
    },
    questionCount: 200,
  }
}

const groups: CertFamilyGroup[] = [
  {
    familyId: 'aws',
    label: 'AWS',
    certs: [makeCert('DVA-C02', 'AWS Developer Associate'), makeCert('SAA-C03', 'AWS Solutions Architect')],
  },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div/>' } },
    { path: '/certs/:certCode', name: 'quiz-dashboard', component: { template: '<div/>' } },
  ],
})

describe('CertSelector favorites', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useUserFavoritesStore().certCodes = []
  })

  it('renders a favorites section listing the favorited certs, also shown in their own family', () => {
    useUserFavoritesStore().certCodes = ['DVA-C02']

    const wrapper = mount(CertSelector, { props: { groups }, global: { plugins: [router] } })
    const favoritesSection = wrapper.find('.cert-family--favorites')

    expect(favoritesSection.exists()).toBe(true)
    expect(favoritesSection.text()).toContain('Favorites')
    expect(favoritesSection.text()).toContain('AWS Developer Associate')

    const familySection = wrapper.findAll('.cert-family').find((s) => !s.classes().includes('cert-family--favorites'))
    expect(familySection?.text()).toContain('AWS Developer Associate')
  })

  it('expands the favorites section by default only when it holds favorites', () => {
    useUserFavoritesStore().certCodes = ['DVA-C02']

    const withFavorites = mount(CertSelector, { props: { groups }, global: { plugins: [router] } })
    const withSections = withFavorites.findAll('details.cert-family')
    const withFavoritesSection = withSections.find((s) => s.classes().includes('cert-family--favorites'))
    const withFamilySection = withSections.find((s) => !s.classes().includes('cert-family--favorites'))

    expect((withFavoritesSection?.element as HTMLDetailsElement).open).toBe(true)
    expect((withFamilySection?.element as HTMLDetailsElement).open).toBe(false)
  })

  it('collapses the favorites section by default when nothing is favorited', () => {
    const wrapper = mount(CertSelector, { props: { groups }, global: { plugins: [router] } })
    const sections = wrapper.findAll('details.cert-family')

    const favoritesSection = sections.find((s) => s.classes().includes('cert-family--favorites'))
    const familySection = sections.find((s) => !s.classes().includes('cert-family--favorites'))

    expect((favoritesSection?.element as HTMLDetailsElement).open).toBe(false)
    expect((familySection?.element as HTMLDetailsElement).open).toBe(false)
  })

  it('shows an empty-state hint in the favorites section when nothing is favorited', () => {
    const wrapper = mount(CertSelector, { props: { groups }, global: { plugins: [router] } })

    expect(wrapper.find('.cert-family--favorites').text()).toContain('Tap the heart')
  })
})