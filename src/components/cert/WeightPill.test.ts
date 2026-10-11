import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WeightPill from './WeightPill.vue'

describe('WeightPill', () => {
  it('shows the percentage with the topic by default', () => {
    const wrapper = mount(WeightPill, { props: { topic: 'Security', weight: 26 } })

    expect(wrapper.text()).toContain('26%')
    expect(wrapper.text()).toContain('Security')
  })

  it('shows only the topic name when the weight is hidden', () => {
    const wrapper = mount(WeightPill, { props: { topic: 'Core Ecosystem Knowledge', weight: 12.5, showWeight: false } })

    expect(wrapper.text()).toContain('Core Ecosystem Knowledge')
    expect(wrapper.text()).not.toContain('%')
  })
})