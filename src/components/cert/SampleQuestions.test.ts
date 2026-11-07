import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { multiAnswerQuestion, singleAnswerQuestion } from '../../utils/fixtures/sampleQuestions.fixture'
import SampleQuestions from './SampleQuestions.vue'

describe('SampleQuestions', () => {
  it('renders nothing when there are no questions', () => {
    const wrapper = mount(SampleQuestions, { props: { questions: [] } })
    expect(wrapper.find('.samples').exists()).toBe(false)
  })

  it('folds the whole set and each answer by default while keeping their text in the DOM', () => {
    const wrapper = mount(SampleQuestions, { props: { questions: [singleAnswerQuestion, multiAnswerQuestion] } })

    expect(wrapper.findAll('.sample')).toHaveLength(2)
    const first = wrapper.findAll('.sample')[0]
    expect(wrapper.find('.samples').attributes('open')).toBeUndefined()
    expect(first.text()).toContain('Which option encrypts data at rest?')
    expect(first.findAll('li').map((item) => item.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('Server-side encryption')]),
    )
    const details = first.find('.sample__answer')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.text()).toContain('Server-side encryption protects stored data.')
  })

  it('tags each question with its topic and its non-empty theme values', () => {
    const wrapper = mount(SampleQuestions, { props: { questions: [singleAnswerQuestion, multiAnswerQuestion] } })
    const [first, second] = wrapper.findAll('.sample')

    expect(first.findAll('.sample__tags .badge').map((tag) => tag.text())).toEqual([
      expect.stringContaining('Security'),
      expect.stringContaining('services: s3, kms'),
    ])
    expect(second.findAll('.sample__tags .badge')).toHaveLength(1)
  })

  it.each([
    { question: singleAnswerQuestion, letters: 'B' },
    { question: multiAnswerQuestion, letters: 'B, D' },
  ])('lists the correct letter(s) "$letters" in the answer block', ({ question, letters }) => {
    const wrapper = mount(SampleQuestions, { props: { questions: [question] } })
    expect(wrapper.find('.sample__answer').text()).toContain(letters)
  })
})
