import { describe, expect, it } from 'vitest'
import { pickSampleQuestions } from './sampleQuestions'
import { twoTopics, withIneligible } from './fixtures/sampleQuestions.fixture'
import { idsOf } from './fixtures/filterPool.fixture'

describe('pickSampleQuestions', () => {
  it.each([
    { count: 2, expected: ['a1', 'b1'] },
    { count: 4, expected: ['a1', 'b1', 'a2', 'b2'] },
    { count: 5, expected: ['a1', 'b1', 'a2', 'b2', 'a3'] },
  ])('spreads $count picks across topics, round-robin in bank order', ({ count, expected }) => {
    expect(idsOf(pickSampleQuestions(twoTopics, count))).toEqual(expected)
  })

  it('returns fewer than requested when the bank has fewer eligible questions', () => {
    expect(pickSampleQuestions(twoTopics, 50)).toHaveLength(5)
    expect(pickSampleQuestions([], 5)).toEqual([])
  })

  it('never picks a question with an image or without a usable explanation', () => {
    expect(idsOf(pickSampleQuestions(withIneligible, 5))).toEqual(['ok'])
  })

  it('is deterministic and leaves its input untouched', () => {
    const snapshot = structuredClone(twoTopics)
    expect(pickSampleQuestions(twoTopics, 3)).toEqual(pickSampleQuestions(twoTopics, 3))
    expect(twoTopics).toEqual(snapshot)
  })
})
