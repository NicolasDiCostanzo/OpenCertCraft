import type { Question } from '../../types'

const q = (id: string, topic: string, overrides: Partial<Question> = {}): Question => ({
  id,
  question: `Question ${id}`,
  options: ['First option', 'Second option'],
  answers: 'A',
  topic,
  explanation: `Because ${id}`,
  ...overrides,
})

export const twoTopics: Question[] = [
  q('a1', 'Security'),
  q('a2', 'Security'),
  q('a3', 'Security'),
  q('b1', 'Networking'),
  q('b2', 'Networking'),
]

export const withIneligible: Question[] = [
  q('img-prompt', 'Security', { promptImages: ['https://example.com/diagram.png'] }),
  q('img-option', 'Security', { options: ['![chart](https://example.com/chart.png)', 'Plain'] }),
  q('no-explanation', 'Security', { explanation: undefined }),
  q('blank-explanation', 'Security', { explanation: '   ' }),
  q('ok', 'Security'),
]

export const singleAnswerQuestion: Question = q('single', 'Security', {
  question: 'Which option encrypts data at rest?',
  options: ['Plain storage', 'Server-side encryption'],
  answers: 'B',
  explanation: 'Server-side encryption protects stored data.',
  themes: { services: ['s3', 'kms'], concepts: [] },
})

export const multiAnswerQuestion: Question = q('multi', 'Networking', {
  question: 'Which options are private subnets?',
  options: ['Public', 'Private one', 'Gateway', 'Private two'],
  answers: ['B', 'D'],
  explanation: 'Only the private subnets have no internet route.',
})
