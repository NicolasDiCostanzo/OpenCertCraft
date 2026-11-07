import type { Question } from '../types'

export const SAMPLE_QUESTION_COUNT = 5

const hasImage = (question: Question): boolean =>
  (question.promptImages?.length ?? 0) > 0 || question.options.some((option) => option.includes('!['))

const isSampleable = (question: Question): boolean =>
  !hasImage(question) && (question.explanation?.trim().length ?? 0) > 0

export function pickSampleQuestions(questions: readonly Question[], count: number): Question[] {
  const byTopic = new Map<string, Question[]>()
  for (const question of questions.filter(isSampleable)) {
    byTopic.set(question.topic, [...(byTopic.get(question.topic) ?? []), question])
  }
  const queues = [...byTopic.values()]
  const picked: Question[] = []
  for (let round = 0; picked.length < count; round++) {
    const layer = queues.flatMap((queue) => queue[round] ?? [])
    if (layer.length === 0) break
    picked.push(...layer.slice(0, count - picked.length))
  }
  return picked
}
