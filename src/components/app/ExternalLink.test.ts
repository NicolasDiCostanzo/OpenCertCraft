import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExternalLink from './ExternalLink.vue'

describe('ExternalLink', () => {
  it('gives an icon-only link its label as accessible name', () => {
    const wrapper = mount(ExternalLink, {
      props: { href: 'https://example.com', label: 'Example site', iconOnly: true },
      slots: { icon: '<svg />' },
    })
    expect(wrapper.attributes('aria-label')).toBe('Example site')
    expect(wrapper.text()).toBe('')
  })

  it('exposes a visible label as the accessible name when the icon is not alone', () => {
    const wrapper = mount(ExternalLink, {
      props: { href: 'https://example.com', label: 'Example site' },
      slots: { icon: '<svg />' },
    })
    expect(wrapper.text()).toBe('Example site')
    expect(wrapper.attributes('aria-label')).toBeUndefined()
  })
})
