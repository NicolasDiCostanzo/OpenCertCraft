import { describe, expect, it } from 'vitest'
import type { CertBundle } from '../types'
import { cloneBundle } from './fixtures/certBundle.fixture'
import { isQuestionAnswerable, validateCertBundle } from './schemaValidator'

describe('validateCertBundle', () => {
  it('accepts a well-formed bundle', () => {
    const result = validateCertBundle(cloneBundle())

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.bundle?.questions).toHaveLength(2)
  })

  it.each<[string, (b: CertBundle) => unknown, string]>([
    ['the payload is not an object', () => 'not an object', 'not a JSON object'],
    ['the schema version is unsupported', (b) => ({ ...b, version: 1 }), 'Unsupported schema version'],
    ['exam is missing', (b) => ({ ...b, exam: undefined }), '"exam" is required'],
    ['exam.name is missing', (b) => ({ ...b, exam: { ...b.exam, name: undefined } }), 'exam.name must be a non-empty string'],
    ['exam.code is missing', (b) => ({ ...b, exam: { ...b.exam, code: undefined } }), 'exam.code must be a non-empty string'],
    ['exam.totalQuestions is not a number', (b) => ({ ...b, exam: { ...b.exam, totalQuestions: '65' } }), 'exam.totalQuestions must be a number'],
    ['exam.timeLimitMinutes is not a number', (b) => ({ ...b, exam: { ...b.exam, timeLimitMinutes: '130' } }), 'exam.timeLimitMinutes must be a number'],
    ['exam.weights is not an object', (b) => ({ ...b, exam: { ...b.exam, weights: 'high' } }), 'exam.weights must be an object mapping topic names to numbers'],
    ['exam.weights has a non-number value', (b) => ({ ...b, exam: { ...b.exam, weights: { ...b.exam.weights, Security: 'sixty' } } }), 'exam.weights must have a numeric value for every topic'],
    ['exam.weights has a negative value', (b) => ({ ...b, exam: { ...b.exam, weights: { ...b.exam.weights, Security: -10 } } }), 'exam.weights values must be non-negative, finite numbers'],
    ['exam.weights has a non-finite value', (b) => ({ ...b, exam: { ...b.exam, weights: { ...b.exam.weights, Security: Number.POSITIVE_INFINITY } } }), 'exam.weights values must be non-negative, finite numbers'],
    ['exam.passingScore is missing', (b) => ({ ...b, exam: { ...b.exam, passingScore: undefined } }), 'exam.passingScore must be an object'],
    ['exam.passingScore.passingScore is missing', (b) => ({ ...b, exam: { ...b.exam, passingScore: { scale: 1000 } } }), 'exam.passingScore.passingScore is required'],
    ['exam.passingScore.scale is not a number', (b) => ({ ...b, exam: { ...b.exam, passingScore: { passingScore: 700, scale: '1000' } } }), 'exam.passingScore.scale must be a finite number'],
    ['exam.passingScore.scale is zero', (b) => ({ ...b, exam: { ...b.exam, passingScore: { passingScore: 700, scale: 0 } } }), 'exam.passingScore.scale must be greater than zero'],
    ['exam.passingScore.passingScore is above the scale', (b) => ({ ...b, exam: { ...b.exam, passingScore: { passingScore: 1001, scale: 1000 } } }), 'must be between 0 and 1000'],
    ['exam.passingScore.passingScore is above 100 without a scale', (b) => ({ ...b, exam: { ...b.exam, passingScore: { passingScore: 101 } } }), 'must be a percentage between 0 and 100'],
    ['exam.passingScore.passingScore is not finite', (b) => ({ ...b, exam: { ...b.exam, passingScore: { passingScore: Number.NaN } } }), 'exam.passingScore.passingScore must be a finite number'],
    ['themes is not an object', (b) => ({ ...b, themes: ['services'] }), '"themes" is required and must be an object'],
    ['a themes group is not a string array', (b) => ({ ...b, themes: { services: [1, 2] } }), 'themes.services must be an array of strings'],
    ['questions is empty', (b) => ({ ...b, questions: [] }), '"questions" must not be empty'],
    ['questions is not an array', (b) => ({ ...b, questions: 'nope' }), '"questions" must be an array'],
    ['a question entry is not an object', (b) => ({ ...b, questions: [42] }), 'questions[0] must be an object'],
    ['a question is missing an id', (b) => ({ ...b, questions: [{ ...b.questions[0], id: undefined }] }), 'questions[0].id must be a non-empty string'],
    ['two questions share an id', (b) => ({ ...b, questions: [b.questions[0], { ...b.questions[0] }] }), 'is duplicated'],
    ['a question is missing its question text', (b) => ({ ...b, questions: [{ ...b.questions[0], question: '' }] }), '.question must be a non-empty string'],
    ['a question is missing its options', (b) => ({ ...b, questions: [{ ...b.questions[0], options: undefined }] }), '.options must be an array of strings'],
    ['a question has fewer than 2 options', (b) => ({ ...b, questions: [{ ...b.questions[0], options: ['only one'] }] }), '.options must have at least 2 entries'],
    ['a question has non-string options', (b) => ({ ...b, questions: [{ ...b.questions[0], options: [1, 2, 3] }] }), '.options must contain only strings'],
    ['a question is missing its answers', (b) => ({ ...b, questions: [{ ...b.questions[0], answers: undefined }] }), '.answers is required'],
    ['answers is an empty array', (b) => ({ ...b, questions: [{ ...b.questions[1], answers: [] }] }), '.answers must contain at least one letter when given as an array'],
    ['answers is neither a string nor an array', (b) => ({ ...b, questions: [{ ...b.questions[0], answers: 5 }] }), '.answers must be a letter string or an array of letters'],
    ['an answer letter is out of range', (b) => ({ ...b, questions: [{ ...b.questions[0], answers: 'Z' }] }), 'is out of range for 3 option(s)'],
    ['a multi-select answer has duplicate letters', (b) => ({ ...b, questions: [{ ...b.questions[1], answers: ['A', 'A'] }] }), '.answers contains duplicate letters'],
    ['a question is missing its topic', (b) => ({ ...b, questions: [{ ...b.questions[0], topic: undefined }] }), '.topic must be a non-empty string'],
    ['a topic is not one of exam.weights\' keys', (b) => ({ ...b, questions: [{ ...b.questions[0], topic: 'Unknown Topic' }] }), 'is not one of exam.weights\' keys'],
    ['a topic of "toString" matching only an inherited weights property', (b) => ({ ...b, questions: [{ ...b.questions[0], topic: 'toString' }] }), 'is not one of exam.weights\' keys'],
    ['a topic of "__proto__" matching only an inherited weights property', (b) => ({ ...b, questions: [{ ...b.questions[0], topic: '__proto__' }] }), 'is not one of exam.weights\' keys'],
    ['a question.url is not a string', (b) => ({ ...b, questions: [{ ...b.questions[0], url: 123 }] }), '.url must be a non-empty string when present'],
    ['a question.url is an empty string', (b) => ({ ...b, questions: [{ ...b.questions[0], url: '' }] }), '.url must be a non-empty string when present'],
    ['a question.explanation is not a string', (b) => ({ ...b, questions: [{ ...b.questions[0], explanation: 123 }] }), '.explanation must be a string when present'],
    ['a question.promptImages is not a string array', (b) => ({ ...b, questions: [{ ...b.questions[0], promptImages: ['ok', 5] }] }), '.promptImages must be an array of strings when present'],
    ['a question.themes is not an object', (b) => ({ ...b, questions: [{ ...b.questions[0], themes: 'nope' }] }), '.themes must be an object when present'],
    ['a question has an empty themes object', (b) => ({ ...b, questions: [{ ...b.questions[0], themes: {} }] }), '.themes must contain at least one theme group when present'],
    ['a question theme group has non-string values', (b) => ({ ...b, questions: [{ ...b.questions[0], themes: { services: [1, 2] } }] }), '.themes.services must be an array of strings'],
    ['a question has a theme group with an empty values array', (b) => ({ ...b, questions: [{ ...b.questions[0], themes: { services: [] } }] }), '.themes.services must not be empty'],
  ])('rejects a bundle where %s', (_label, mutate, expectedError) => {
    const result = validateCertBundle(mutate(cloneBundle()))

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes(expectedError))).toBe(true)
  })

  it('accepts more than 5 options when every answer letter stays within range', () => {
    const bundle = cloneBundle()
    bundle.questions[0] = {
      ...bundle.questions[0],
      options: ['a', 'b', 'c', 'd', 'e', 'f'],
      answers: ['B', 'F'],
    }

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('warns, but does not fail, on a question theme value unknown to the registry', () => {
    const bundle = cloneBundle()
    bundle.questions[0].themes = { services: ['unknown-service'] }

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain(
      'questions[0] (id q1).themes.services references value "unknown-service", which isn\'t declared in themes.services.',
    )
  })

  it('warns, but does not fail, when a question has no non-empty options', () => {
    const bundle = cloneBundle()
    bundle.questions[0].options = ['', '', '']

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain(
      '1 question(s) have no non-empty options and will be excluded from quizzes until content is authored: q1.',
    )
  })

  it('warns when exam.weights values do not sum to 100', () => {
    const bundle = cloneBundle()
    bundle.exam.weights = { Security: 60, Deployment: 30 }

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('exam.weights values sum to 90, expected 100.')
  })

  it('warns when a question uses a theme group absent from the top-level registry', () => {
    const bundle = cloneBundle()
    bundle.questions[0].themes = { questionTypes: ['troubleshooting'] }

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain(
      'questions[0] (id q1) uses theme group "questionTypes", which isn\'t declared in the top-level "themes" registry.',
    )
  })

  it('warns, but does not fail, on question theme groups named like inherited properties', () => {
    const bundle = cloneBundle()
    bundle.questions[0].themes = JSON.parse('{"toString": ["lambda"], "__proto__": ["s3"]}')

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain(
      'questions[0] (id q1) uses theme group "toString", which isn\'t declared in the top-level "themes" registry.',
    )
    expect(result.warnings).toContain(
      'questions[0] (id q1) uses theme group "__proto__", which isn\'t declared in the top-level "themes" registry.',
    )
    const themes = result.bundle?.questions[0].themes
    expect(themes && Object.getPrototypeOf(themes)).toBe(null)
  })

  it('does not let a "__proto__" theme group in the top-level registry set the registry prototype', () => {
    const bundle = cloneBundle()
    bundle.themes = JSON.parse('{"services": ["lambda"], "__proto__": ["evil"]}')

    const result = validateCertBundle(bundle)

    expect(result.valid).toBe(true)
    const themes = result.bundle?.themes
    expect(themes && Object.getPrototypeOf(themes)).toBe(null)
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'not json'],
    ['a boolean', true],
    ['an array', [1, 2, 3]],
  ])('rejects without throwing when the payload is %s', (_label, payload) => {
    expect(() => validateCertBundle(payload)).not.toThrow()

    const result = validateCertBundle(payload)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['The provided cert bundle is not a JSON object.'])
  })

  it.each<[string, unknown, string[]]>([
    ['an empty object', {}, ['"exam" is required', '"themes" is required', '"questions" must be an array']],
    ['an object missing every required key', { foo: 'bar' }, ['"exam" is required', '"themes" is required', '"questions" must be an array']],
  ])('rejects without throwing, with every top-level problem reported, when the payload is %s', (_label, payload, expectedErrors) => {
    expect(() => validateCertBundle(payload)).not.toThrow()

    const result = validateCertBundle(payload)

    expect(result.valid).toBe(false)
    for (const expectedError of expectedErrors) {
      expect(result.errors.some((e) => e.includes(expectedError))).toBe(true)
    }
  })
})

describe('isQuestionAnswerable', () => {
  it.each([
    ['all options empty', ['', '', ''], false],
    ['one non-empty option', ['', 'x', ''], true],
    ['all options non-empty', ['a', 'b'], true],
    ['whitespace-only options', ['   ', '\t'], false],
  ])('%s -> %s', (_label, options, expected) => {
    expect(
      isQuestionAnswerable({ id: 'x', question: 'q', options, answers: 'A', topic: 't' }),
    ).toBe(expected)
  })
})
