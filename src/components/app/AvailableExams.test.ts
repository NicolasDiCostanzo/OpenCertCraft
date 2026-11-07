import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { certFamilyGroups } from '../../utils/fixtures/certBundle.fixture'
import AvailableExams from './AvailableExams.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/certs/:certCode', name: 'quiz-dashboard', component: { template: '<div/>' } }],
})

function mountList() {
  return mount(AvailableExams, { global: { plugins: [router] }, props: { groups: certFamilyGroups } })
}

describe('AvailableExams', () => {
  it('is open by default so the certification links are visible', () => {
    expect(mountList().find('details.available-exams').attributes('open')).toBeDefined()
  })

  it('links each certification with a practice test anchor to its dashboard', () => {
    const link = mountList().find('a.available-exams__name')
    expect(link.text()).toContain('Fixture Certification')
    expect(link.text()).toContain('practice test')
    expect(link.attributes('href')).toBe('/certs/FIX-001')
  })
})
