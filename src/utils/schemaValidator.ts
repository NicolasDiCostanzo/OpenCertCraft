import type { CertBundle, ExamInfo, PassingScore, Question, QuestionThemes, ThemeRegistry } from '../types'

export interface ValidationResult {
  valid: boolean
  bundle?: CertBundle
  errors: string[]
  warnings: string[]
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
const SUPPORTED_VERSION = 2

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function isQuestionAnswerable(question: Question): boolean {
  return question.options.some((option) => option.trim().length > 0)
}

export function validateCertBundle(json: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isPlainObject(json)) {
    return { valid: false, errors: ['The provided cert bundle is not a JSON object.'], warnings }
  }

  if (json.version !== SUPPORTED_VERSION) {
    errors.push(`Unsupported schema version "${String(json.version)}" — expected ${SUPPORTED_VERSION}.`)
  }

  const exam = validateExam(json.exam, errors, warnings)
  const themes = validateThemes(json.themes, errors)
  const questions = validateQuestions(json.questions, exam, themes, errors, warnings)

  if (errors.length > 0 || !exam || !themes || !questions) {
    return { valid: false, errors, warnings }
  }

  return {
    valid: true,
    bundle: { version: SUPPORTED_VERSION, exam, themes, questions },
    errors,
    warnings,
  }
}

function validatePassingScore(value: unknown, errors: string[]): PassingScore | undefined {
  if (!isPlainObject(value)) {
    errors.push('exam.passingScore must be an object.')
    return undefined
  }
  if (value.passingScore === undefined) {
    errors.push('exam.passingScore.passingScore is required.')
    return undefined
  }
  if (typeof value.passingScore !== 'number' || !Number.isFinite(value.passingScore)) {
    errors.push('exam.passingScore.passingScore must be a finite number.')
    return undefined
  }
  if (value.scale !== undefined) {
    if (typeof value.scale !== 'number' || !Number.isFinite(value.scale)) {
      errors.push('exam.passingScore.scale must be a finite number when present.')
      return undefined
    }
    if (value.scale <= 0) {
      errors.push('exam.passingScore.scale must be greater than zero.')
      return undefined
    }
    if (value.passingScore < 0 || value.passingScore > value.scale) {
      errors.push(`exam.passingScore.passingScore must be between 0 and ${value.scale} (the scale).`)
      return undefined
    }
  } else if (value.passingScore < 0 || value.passingScore > 100) {
    errors.push('exam.passingScore.passingScore must be a percentage between 0 and 100 when scale is absent.')
    return undefined
  }
  return { passingScore: value.passingScore, ...(value.scale !== undefined ? { scale: value.scale } : {}) }
}

function validateExam(value: unknown, errors: string[], warnings: string[]): ExamInfo | undefined {
  const before = errors.length

  if (!isPlainObject(value)) {
    errors.push('"exam" is required and must be an object.')
    return undefined
  }

  if (typeof value.name !== 'string' || value.name.length === 0) errors.push('exam.name must be a non-empty string.')
  if (typeof value.code !== 'string' || value.code.length === 0) errors.push('exam.code must be a non-empty string.')
  if (typeof value.totalQuestions !== 'number') errors.push('exam.totalQuestions must be a number.')
  if (typeof value.timeLimitMinutes !== 'number') errors.push('exam.timeLimitMinutes must be a number.')
  if (value.instructions !== undefined && typeof value.instructions !== 'string') {
    errors.push('exam.instructions must be a string when present.')
  }

  const passingScore = validatePassingScore(value.passingScore, errors)

  let weights: Record<string, number> | undefined
  if (value.weights !== undefined) {
    if (!isPlainObject(value.weights)) {
      errors.push('exam.weights must be an object mapping topic names to numbers.')
    } else if (!Object.values(value.weights).every((v) => typeof v === 'number')) {
      errors.push('exam.weights must have a numeric value for every topic.')
    } else if (!Object.values(value.weights as Record<string, number>).every((v) => Number.isFinite(v) && v >= 0)) {
      errors.push('exam.weights values must be non-negative, finite numbers.')
    } else {
      weights = value.weights as Record<string, number>
      const sum = Object.values(weights).reduce((total, v) => total + v, 0)
      if (Math.abs(sum - 100) > 0.5) {
        warnings.push(`exam.weights values sum to ${sum}, expected 100.`)
      }
    }
  }

  if (errors.length !== before || !passingScore) return undefined

  return {
    name: value.name as string,
    code: value.code as string,
    totalQuestions: value.totalQuestions as number,
    timeLimitMinutes: value.timeLimitMinutes as number,
    passingScore,
    ...(weights !== undefined ? { weights } : {}),
    ...(value.instructions !== undefined ? { instructions: value.instructions as string } : {}),
  }
}

function validateThemes(value: unknown, errors: string[]): ThemeRegistry | undefined {
  const before = errors.length

  if (!isPlainObject(value)) {
    errors.push('"themes" is required and must be an object.')
    return undefined
  }

  const registry: ThemeRegistry = Object.create(null)
  for (const [group, values] of Object.entries(value)) {
    if (!isStringArray(values)) {
      errors.push(`themes.${group} must be an array of strings.`)
      continue
    }
    registry[group] = values
  }

  return errors.length === before ? registry : undefined
}

function validateAnswers(value: unknown, optionCount: number, label: string, errors: string[]): string | string[] | undefined {
  const validLetters = OPTION_LETTERS.slice(0, optionCount)

  if (value === undefined) {
    errors.push(`${label}.answers is required.`)
    return undefined
  }

  if (typeof value === 'string') {
    if (!validLetters.includes(value)) {
      errors.push(`${label}.answers "${value}" is out of range for ${optionCount} option(s).`)
      return undefined
    }
    return value
  }

  if (Array.isArray(value)) {
    if (!isStringArray(value)) {
      errors.push(`${label}.answers must be an array of letters (strings).`)
      return undefined
    }
    if (value.length === 0) {
      errors.push(`${label}.answers must contain at least one letter when given as an array.`)
      return undefined
    }
    if (new Set(value).size !== value.length) {
      errors.push(`${label}.answers contains duplicate letters.`)
      return undefined
    }
    const outOfRange = value.filter((letter) => !validLetters.includes(letter))
    if (outOfRange.length > 0) {
      errors.push(`${label}.answers contains out-of-range letter(s): ${outOfRange.join(', ')}.`)
      return undefined
    }
    return value
  }

  errors.push(`${label}.answers must be a letter string or an array of letters.`)
  return undefined
}

function validateQuestionThemes(
  value: unknown,
  themes: ThemeRegistry | undefined,
  label: string,
  errors: string[],
  warnings: string[],
): QuestionThemes | undefined {
  if (!isPlainObject(value)) {
    errors.push(`${label}.themes must be an object when present.`)
    return undefined
  }

  if (Object.keys(value).length === 0) {
    errors.push(`${label}.themes must contain at least one theme group when present.`)
    return undefined
  }

  const questionThemes: QuestionThemes = Object.create(null)
  for (const [group, values] of Object.entries(value)) {
    if (!isStringArray(values)) {
      errors.push(`${label}.themes.${group} must be an array of strings.`)
      continue
    }
    if (values.length === 0) {
      errors.push(`${label}.themes.${group} must not be empty — omit the group entirely instead.`)
      continue
    }
    questionThemes[group] = values

    const registeredValues = themes !== undefined && Object.hasOwn(themes, group) ? themes[group] : undefined
    if (!registeredValues) {
      warnings.push(`${label} uses theme group "${group}", which isn't declared in the top-level "themes" registry.`)
      continue
    }
    for (const tag of values) {
      if (!registeredValues.includes(tag)) {
        warnings.push(`${label}.themes.${group} references value "${tag}", which isn't declared in themes.${group}.`)
      }
    }
  }

  return questionThemes
}

function validateQuestions(
  value: unknown,
  exam: ExamInfo | undefined,
  themes: ThemeRegistry | undefined,
  errors: string[],
  warnings: string[],
): Question[] | undefined {
  if (!Array.isArray(value)) {
    errors.push('"questions" must be an array.')
    return undefined
  }
  if (value.length === 0) {
    errors.push('"questions" must not be empty.')
    return undefined
  }

  const before = errors.length
  const questions: Question[] = []
  const seenIds = new Set<string>()

  value.forEach((raw, index) => {
    const prefix = `questions[${index}]`

    if (!isPlainObject(raw)) {
      errors.push(`${prefix} must be an object.`)
      return
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
      errors.push(`${prefix}.id must be a non-empty string.`)
      return
    }
    if (seenIds.has(raw.id)) {
      errors.push(`${prefix}.id "${raw.id}" is duplicated.`)
      return
    }
    seenIds.add(raw.id)

    const label = `${prefix} (id ${raw.id})`

    if (typeof raw.question !== 'string' || raw.question.length === 0) {
      errors.push(`${label}.question must be a non-empty string.`)
    }

    if (!Array.isArray(raw.options)) {
      errors.push(`${label}.options must be an array of strings.`)
      return
    }
    if (!isStringArray(raw.options)) {
      errors.push(`${label}.options must contain only strings.`)
      return
    }
    if (raw.options.length < 2) {
      errors.push(`${label}.options must have at least 2 entries (has ${raw.options.length}).`)
      return
    }

    const answers = validateAnswers(raw.answers, raw.options.length, label, errors)
    if (answers === undefined) return

    if (typeof raw.topic !== 'string' || raw.topic.length === 0) {
      errors.push(`${label}.topic must be a non-empty string.`)
      return
    }
    if (exam?.weights && !Object.hasOwn(exam.weights, raw.topic)) {
      errors.push(`${label}.topic "${raw.topic}" is not one of exam.weights' keys.`)
      return
    }

    if (raw.url !== undefined && (typeof raw.url !== 'string' || raw.url === '')) {
      errors.push(`${label}.url must be a non-empty string when present.`)
    }
    if (raw.explanation !== undefined && typeof raw.explanation !== 'string') {
      errors.push(`${label}.explanation must be a string when present.`)
    }
    if (raw.promptImages !== undefined && !isStringArray(raw.promptImages)) {
      errors.push(`${label}.promptImages must be an array of strings when present.`)
    }

    let questionThemes: QuestionThemes | undefined
    if (raw.themes !== undefined) {
      questionThemes = validateQuestionThemes(raw.themes, themes, label, errors, warnings)
    }

    questions.push({
      id: raw.id,
      question: raw.question as string,
      options: raw.options,
      answers,
      topic: raw.topic,
      ...(raw.url !== undefined ? { url: raw.url as string } : {}),
      ...(raw.explanation !== undefined ? { explanation: raw.explanation as string } : {}),
      ...(raw.promptImages !== undefined ? { promptImages: raw.promptImages as string[] } : {}),
      ...(questionThemes !== undefined ? { themes: questionThemes } : {}),
    })
  })

  if (errors.length !== before) return undefined

  const unanswerable = questions.filter((q) => !isQuestionAnswerable(q))
  if (unanswerable.length > 0) {
    warnings.push(
      `${unanswerable.length} question(s) have no non-empty options and will be excluded from quizzes until content is authored: ${unanswerable.map((q) => q.id).join(', ')}.`,
    )
  }

  return questions
}
