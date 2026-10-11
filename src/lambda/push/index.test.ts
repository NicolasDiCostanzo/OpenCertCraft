import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn().mockResolvedValue({})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send }) },
  TransactWriteCommand: class {
    input: unknown
    constructor(input: unknown) {
      this.input = input
    }
  },
}))

const { handler } = await import('./index')

const event = (body: unknown) => ({
  requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } },
  body: JSON.stringify(body),
})

const validProgress = { format: 'quiz-progress', version: 1, exportedAt: 'now', byExamCode: {} }
const validHistory = { format: 'quiz-history', version: 1, exportedAt: 'now', entries: [] }
const validFavorites = { format: 'quiz-favorites', version: 1, exportedAt: 'now', certCodes: ['DVA-C02'] }
const validQuestionProgress = { questionId: 'q1', attempts: 1, timesCorrect: 1, timesWrong: 0, flagged: false, lastSeenAt: 1 }
const validHistoryEntry = {
  id: 'h1',
  certCode: 'DVA-C02',
  mode: 'preparation',
  startedAt: 1,
  finishedAt: 2,
  questionIds: ['q1'],
  answers: {},
  flags: [],
  result: { percentCorrect: 100, passed: true, timesCorrect: 1, totalAnswered: 1 },
}

describe('push handler payload validation', () => {
  beforeEach(() => {
    send.mockClear()
  })

  it.each([
    ['missing byExamCode', { ...validProgress, byExamCode: undefined }],
    ['missing format', { ...validProgress, format: undefined }],
    ['wrong version type', { ...validProgress, version: '1' }],
    ['unsafe version', { ...validProgress, version: 1.5 }],
    ['unsupported version', { ...validProgress, version: 2 }],
    [
      'a malformed nested question-progress record',
      { ...validProgress, byExamCode: { 'DVA-C02': { q1: { questionId: 'q1' } } } },
    ],
    ['a null nested question-progress record', { ...validProgress, byExamCode: { 'DVA-C02': { q1: null } } }],
  ])('rejects a progress document with %s', async (_label, progress) => {
    const result = await handler(event({ progress }))

    expect(result.statusCode).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['missing entries', { ...validHistory, entries: undefined }],
    ['entries not an array', { ...validHistory, entries: {} }],
    ['a malformed history entry', { ...validHistory, entries: [{ id: 'h1' }] }],
    ['a null history entry', { ...validHistory, entries: [null] }],
  ])('rejects a history document with %s', async (_label, history) => {
    const result = await handler(event({ history }))

    expect(result.statusCode).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['missing certCodes', { ...validFavorites, certCodes: undefined }],
    ['certCodes not an array', { ...validFavorites, certCodes: {} }],
    ['a non-string cert code', { ...validFavorites, certCodes: [1] }],
    ['wrong format', { ...validFavorites, format: 'other' }],
    ['unsupported version', { ...validFavorites, version: 2 }],
  ])('rejects a favorites document with %s', async (_label, favorites) => {
    const result = await handler(event({ favorites }))

    expect(result.statusCode).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })

  it('accepts a payload with valid progress and history documents', async () => {
    const progress = { ...validProgress, byExamCode: { 'DVA-C02': { q1: validQuestionProgress } } }
    const history = { ...validHistory, entries: [validHistoryEntry] }

    const result = await handler(event({ progress, history }))

    expect(result.statusCode).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('accepts a payload with a valid favorites document', async () => {
    const result = await handler(event({ favorites: validFavorites }))

    expect(result.statusCode).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('accepts a payload deleting a document (null value)', async () => {
    const result = await handler(event({ progress: null }))

    expect(result.statusCode).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('accepts a document just under the 190 KB DynamoDB item limit', async () => {
    const progress = {
      ...validProgress,
      byExamCode: { 'DVA-C02': { q1: { ...validQuestionProgress, padding: 'a'.repeat(180 * 1024) } } },
    }

    const result = await handler(event({ progress }))

    expect(result.statusCode).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('rejects a document over the 190 KB DynamoDB item limit with 413', async () => {
    const progress = {
      ...validProgress,
      byExamCode: { 'DVA-C02': { q1: { ...validQuestionProgress, padding: 'a'.repeat(200 * 1024) } } },
    }

    const result = await handler(event({ progress }))

    expect(result.statusCode).toBe(413)
    expect(send).not.toHaveBeenCalled()
  })

  it('returns 500 instead of throwing when DynamoDB is unavailable', async () => {
    send.mockRejectedValueOnce(new Error('ProvisionedThroughputExceededException'))

    const result = await handler(event({ progress: validProgress, history: validHistory }))

    expect(result.statusCode).toBe(500)
  })
})
