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

  it('links same-named certifications by their distinct codes and dashboard URLs', () => {
    const links = mountList().findAll('a.available-exams__name')
    expect(links).toHaveLength(2)
    for (const [i, code] of ['FIX-001', 'FIX-002'].entries()) {
      expect(links[i].text()).toContain('Fixture Certification')
      expect(links[i].text()).toContain(code)
      expect(links[i].text()).not.toContain('practice test')
      expect(links[i].attributes('href')).toBe(`/certs/${code}`)
    }
  })
})
