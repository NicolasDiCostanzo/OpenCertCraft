import { describe, expect, it } from 'vitest'
import { validCertBundle } from './fixtures/certBundle.fixture'
import { texts } from '../texts/en'
import { certMeta, homeMeta } from './seo'

describe('certMeta', () => {
  const meta = certMeta(validCertBundle.exam)

  it.each([{ phrase: 'practice test' }, { phrase: 'FIX-001' }, { phrase: 'Fixture Certification' }])(
    'puts "$phrase" in the title',
    ({ phrase }) => {
      expect(meta.title).toContain(phrase)
    },
  )

  it('no longer sells the page as a quiz', () => {
    expect(meta.title).not.toMatch(/practice quiz/i)
  })

  it('is indexable at its own canonical path', () => {
    expect(meta.canonicalPath).toBe('/certs/FIX-001')
  })
})

describe('homeMeta', () => {
  const meta = homeMeta()

  it.each([{ phrase: 'practice tests' }, { phrase: 'mock exams' }])('puts "$phrase" in the title', ({ phrase }) => {
    expect(meta.title).toContain(phrase)
  })

  it('no longer sells the site as quizzes', () => {
    expect(meta.title).not.toMatch(/quizzes/i)
  })
})

describe('seoCertHeading', () => {
  it.each([
    { name: 'Fixture Certification', code: 'FIX-001', expected: 'Fixture Certification (FIX-001) practice test' },
    { name: 'Certified Admin (ADM)', code: 'ADM', expected: 'Certified Admin (ADM) practice test' },
  ])('writes the code once for "$name"', ({ name, code, expected }) => {
    expect(texts.seoCertHeading(name, code)).toBe(expected)
  })
})
