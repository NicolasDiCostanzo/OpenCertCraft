import type { CertBundle, CertFamilyGroup } from '../../types'

export const validCertBundle: CertBundle = {
  version: 2,
  exam: {
    name: 'Fixture Certification',
    code: 'FIX-001',
    totalQuestions: 2,
    timeLimitMinutes: 60,
    passingScore: { passingScore: 700, scale: 1000 },
    weights: { Security: 60, Deployment: 40 },
    instructions: 'Answer all questions.',
  },
  themes: {
    services: ['lambda', 's3'],
    concepts: ['encryption'],
  },
  questions: [
    {
      id: 'q1',
      question: 'Single-select fixture question?',
      options: ['Option A', 'Option B', 'Option C'],
      answers: 'B',
      topic: 'Security',
      themes: { services: ['lambda'], concepts: ['encryption'] },
    },
    {
      id: 'q2',
      question: 'Multi-select fixture question?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answers: ['A', 'C'],
      topic: 'Deployment',
    },
  ],
}

export const secondCertBundle: CertBundle = (() => {
  const bundle = cloneBundle(validCertBundle)
  bundle.exam = { ...bundle.exam, code: 'SECOND', name: 'Second Certification', totalQuestions: 65 }
  bundle.themes = { levels: ['begin', 'advanced'] }
  bundle.questions = [
    {
      id: 's1',
      question: 'Second cert question?',
      options: ['Option A', 'Option B'],
      answers: 'A',
      topic: 'General',
      themes: { levels: ['begin'] },
    },
  ]
  return bundle
})()

export function cloneBundle(bundle: CertBundle = validCertBundle): CertBundle {
  return JSON.parse(JSON.stringify(bundle)) as CertBundle
}

export const examCertBundle: CertBundle = (() => {
  const bundle = cloneBundle(validCertBundle)
  bundle.exam = {
    ...bundle.exam,
    code: 'EXAM-001',
    totalQuestions: 10,
    timeLimitMinutes: 30,
    weights: { Security: 60, Deployment: 40 },
  }
  const build = (topic: string, prefix: string, tag: string) =>
    Array.from({ length: 20 }, (_, index) => ({
      id: `${prefix}-${index + 1}`,
      question: `${topic} question ${index + 1}?`,
      options: ['Option A', 'Option B'],
      answers: 'A',
      topic,
      themes: { services: [tag] },
    }))
  bundle.questions = [...build('Security', 'sec', 'lambda'), ...build('Deployment', 'dep', 's3')]
  return bundle
})()

export const certFamilyGroups: CertFamilyGroup[] = [
  { familyId: 'fixture', label: 'Fixture provider', certs: [{ exam: validCertBundle.exam, questionCount: 120 }] },
]
