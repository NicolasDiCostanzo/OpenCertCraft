import { describe, expect, it } from 'vitest'
import { areWeightsUniform, formatPassingScore, passingScorePercent } from './examDisplay'

describe('passingScorePercent', () => {
  it('rounds a scaled score to its percentage', () => {
    expect(passingScorePercent({ passingScore: 720, scale: 1000 })).toBe(72)
    expect(passingScorePercent({ passingScore: 649, scale: 1000 })).toBe(65)
  })

  it('returns the value as-is for a percentage-based score without a scale', () => {
    expect(passingScorePercent({ passingScore: 60 })).toBe(60)
  })
})

describe('formatPassingScore', () => {
  it('formats a scaled score as value / scale with the projected percentage', () => {
    expect(formatPassingScore({ passingScore: 720, scale: 1000 })).toBe('720 / 1000 (72%)')
  })

  it('rounds the projected percentage', () => {
    expect(formatPassingScore({ passingScore: 700, scale: 1000 })).toBe('700 / 1000 (70%)')
    expect(formatPassingScore({ passingScore: 649, scale: 1000 })).toBe('649 / 1000 (65%)')
  })

  it('formats a percentage-based score without a scale', () => {
    expect(formatPassingScore({ passingScore: 60 })).toBe('60%')
    expect(formatPassingScore({ passingScore: 72.5 })).toBe('72.5%')
  })
})

describe('areWeightsUniform', () => {
  it('treats an even split as uniform, signalling the weights are estimated', () => {
    expect(areWeightsUniform({ A: 12.5, B: 12.5, C: 12.5, D: 12.5 })).toBe(true)
    expect(areWeightsUniform({ A: 7.69, B: 7.69, C: 7.69 })).toBe(true)
  })

  it('treats a meaningful spread as real, published weights', () => {
    expect(areWeightsUniform({ Security: 26, Deployment: 24, Development: 32, Troubleshooting: 18 })).toBe(false)
  })

  it('tolerates rounding noise within the validator tolerance', () => {
    expect(areWeightsUniform({ A: 20, B: 20, C: 20, D: 20, E: 20.3 })).toBe(true)
  })

  it('is uniform when there is nothing to compare', () => {
    expect(areWeightsUniform({})).toBe(true)
    expect(areWeightsUniform({ A: 100 })).toBe(true)
  })
})
