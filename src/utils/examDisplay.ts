import type { PassingScore } from '../types'

export function passingScorePercent(passingScore: PassingScore): number {
  return passingScore.scale === undefined
    ? passingScore.passingScore
    : Math.round((passingScore.passingScore / passingScore.scale) * 100)
}

export function formatPassingScore(passingScore: PassingScore): string {
  if (passingScore.scale === undefined) {
    return `${passingScore.passingScore}%`
  }
  return `${passingScore.passingScore} / ${passingScore.scale} (${passingScorePercent(passingScore)}%)`
}

export function areWeightsUniform(weights: Record<string, number>): boolean {
  const values = Object.values(weights)
  if (values.length <= 1) return true
  const min = Math.min(...values)
  const max = Math.max(...values)
  return max - min <= 0.5
}
