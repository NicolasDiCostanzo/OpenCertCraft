const PROGRESS_VERSION = 1
const HISTORY_VERSION = 1
const FAVORITES_VERSION = 1

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidQuestionProgress(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  return (
    typeof value.questionId === 'string' &&
    Number.isSafeInteger(value.attempts) &&
    Number.isSafeInteger(value.timesCorrect) &&
    Number.isSafeInteger(value.timesWrong) &&
    typeof value.flagged === 'boolean' &&
    Number.isSafeInteger(value.lastSeenAt)
  )
}

function isValidHistoryEntry(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  if (
    typeof value.id !== 'string' ||
    typeof value.certCode !== 'string' ||
    (value.mode !== 'preparation' && value.mode !== 'exam') ||
    !Number.isSafeInteger(value.startedAt) ||
    !Number.isSafeInteger(value.finishedAt) ||
    !Array.isArray(value.questionIds) ||
    !isPlainObject(value.answers) ||
    !Array.isArray(value.flags) ||
    !isPlainObject(value.result)
  ) {
    return false
  }
  if (!value.questionIds.every((id) => typeof id === 'string')) return false
  if (!value.flags.every((flag) => typeof flag === 'string')) return false
  return (
    typeof value.result.percentCorrect === 'number' &&
    typeof value.result.passed === 'boolean' &&
    Number.isSafeInteger(value.result.timesCorrect) &&
    Number.isSafeInteger(value.result.totalAnswered)
  )
}

export function validateProgressExportFile(value: unknown): string[] {
  if (!isPlainObject(value)) return ['invalid progress document']
  const errors: string[] = []
  if (value.format !== 'quiz-progress') errors.push('invalid progress.format')
  if (value.version !== PROGRESS_VERSION) errors.push('invalid progress.version')
  if (typeof value.exportedAt !== 'string') errors.push('invalid progress.exportedAt')
  if (!isPlainObject(value.byExamCode)) {
    errors.push('invalid progress.byExamCode')
  } else {
    for (const [examCode, questions] of Object.entries(value.byExamCode)) {
      if (!isPlainObject(questions)) {
        errors.push(`invalid progress.byExamCode.${examCode}`)
        continue
      }
      for (const [questionId, record] of Object.entries(questions)) {
        if (!isValidQuestionProgress(record)) {
          errors.push(`invalid progress.byExamCode.${examCode}.${questionId}`)
        }
      }
    }
  }
  return errors
}

export function validateHistoryExportFile(value: unknown): string[] {
  if (!isPlainObject(value)) return ['invalid history document']
  const errors: string[] = []
  if (value.format !== 'quiz-history') errors.push('invalid history.format')
  if (value.version !== HISTORY_VERSION) errors.push('invalid history.version')
  if (typeof value.exportedAt !== 'string') errors.push('invalid history.exportedAt')
  if (!Array.isArray(value.entries)) {
    errors.push('invalid history.entries')
  } else {
    value.entries.forEach((entry, index) => {
      if (!isValidHistoryEntry(entry)) errors.push(`invalid history.entries[${index}]`)
    })
  }
  return errors
}

export function validateFavoritesExportFile(value: unknown): string[] {
  if (!isPlainObject(value)) return ['invalid favorites document']
  const errors: string[] = []
  if (value.format !== 'quiz-favorites') errors.push('invalid favorites.format')
  if (value.version !== FAVORITES_VERSION) errors.push('invalid favorites.version')
  if (typeof value.exportedAt !== 'string') errors.push('invalid favorites.exportedAt')
  if (!Array.isArray(value.certCodes)) {
    errors.push('invalid favorites.certCodes')
  } else if (!value.certCodes.every((code) => typeof code === 'string')) {
    errors.push('invalid favorites.certCodes')
  } else if (new Set(value.certCodes).size !== value.certCodes.length) {
    errors.push('invalid favorites.certCodes')
  }
  return errors
}
