import { describe, expect, it } from 'vitest'
import { validCertBundle } from './fixtures/certBundle.fixture'
import { certMeta } from './seo'

describe('certMeta', () => {
  const meta = certMeta(validCertBundle.exam, 120)

  it.each([
    { field: 'title', phrase: 'practice test' },
    { field: 'description', phrase: 'practice test' },
    { field: 'description', phrase: 'mock exam' },
    { field: 'title', phrase: 'FIX-001' },
    { field: 'description', phrase: 'Fixture Certification' },
    { field: 'description', phrase: '120 questions' },
    { field: 'description', phrase: '60 minutes' },
  ] as const)('puts "$phrase" in the $field', ({ field, phrase }) => {
    expect(meta[field]).toContain(phrase)
  })

  it('no longer sells the page as a quiz', () => {
    expect(`${meta.title} ${meta.description}`).not.toMatch(/practice quiz/i)
  })
})
