import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import QuestionCard from './QuestionCard.vue'
import type { Question } from '../../types'

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    question: 'What is A?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answers: 'B',
    topic: 't1',
    ...overrides,
  }
}

const mountCard = (question: Question, selected: string[] = [], reveal = false) =>
  mount(QuestionCard, {
    props: { question, selected, reveal },
  })

describe('QuestionCard', () => {
  it('uses radio inputs for single-answer questions', () => {
    const wrapper = mountCard(makeQuestion({ answers: 'C' }))
    expect(wrapper.find('input').attributes('type')).toBe('radio')
  })

  it('uses checkbox inputs for multi-answer questions', () => {
    const wrapper = mountCard(makeQuestion({ answers: ['A', 'C'] }))
    expect(wrapper.find('input').attributes('type')).toBe('checkbox')
  })

  it('emits select with a single letter on radio change', async () => {
    const wrapper = mountCard(makeQuestion())
    await wrapper.findAll('input')[0].setValue(true)
    expect(wrapper.emitted('select')?.[0]).toEqual(['q1', ['A']])
  })

  it('emits select with multiple letters on checkbox toggle', async () => {
    const wrapper = mount(QuestionCard, {
      props: { question: makeQuestion({ answers: ['A', 'B'] }), selected: ['A'], reveal: false },
    })
    await wrapper.findAll('input')[1].trigger('change')
    expect(wrapper.emitted('select')?.[0]).toEqual(['q1', ['A', 'B']])
  })

  it('emits select removing a letter when a checkbox is unchecked', async () => {
    const wrapper = mount(QuestionCard, {
      props: { question: makeQuestion({ answers: ['A', 'B'] }), selected: ['A', 'B'], reveal: false },
    })
    await wrapper.findAll('input')[0].trigger('change')
    expect(wrapper.emitted('select')?.[0]).toEqual(['q1', ['B']])
  })

  it('does not reveal feedback when reveal is false', () => {
    const wrapper = mountCard(makeQuestion(), ['B'], false)
    expect(wrapper.find('.feedback').exists()).toBe(false)
  })

  it('renders fenced commands in the explanation as code blocks', () => {
    const question = makeQuestion({
      answers: 'A',
      explanation: '```\nkubectl get pods\nkubectl scale deployment webapp --replicas=5\n```\n\nThis scales the deployment.',
    })
    const wrapper = mountCard(question, ['B'], true)
    const blocks = wrapper.findAll('.feedback pre')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text()).toContain('kubectl scale deployment webapp --replicas=5')
    expect(wrapper.find('.feedback').text()).not.toContain('```')
  })

  it('keeps line breaks between explanation paragraphs intact', () => {
    const question = makeQuestion({ answers: 'A', explanation: 'First reason.\n\nSecond reason.' })
    const wrapper = mountCard(question, ['B'], true)
    const text = wrapper.find('.feedback-explanation .rich-text__text')
    expect(text.exists()).toBe(true)
    expect(text.text()).toBe('First reason.\n\nSecond reason.')
  })
})
