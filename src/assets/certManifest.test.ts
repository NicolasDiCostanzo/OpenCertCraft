import { describe, expect, it } from 'vitest'
import certManifest from './cert-manifest.json'
import type { CertBundle } from '../types'
import { isQuestionAnswerable, validateCertBundle } from '../utils/schemaValidator'

const modules = import.meta.glob<{ default: unknown }>('./*questions.json', { eager: true })

describe('cert manifest', () => {
  it('lists exactly one entry per bundle file', () => {
    const bundleFiles = Object.keys(modules).map((path) => path.replace('./', '')).sort()
    expect(certManifest.map((entry) => entry.file).sort()).toEqual(bundleFiles)
  })

  it('matches each bundle content and every bundle passes schema validation', () => {
    for (const entry of certManifest) {
      const mod = modules[`./${entry.file}`]
      expect(mod, `no bundle file found for manifest entry "${entry.file}"`).toBeDefined()
      const result = validateCertBundle(mod?.default)
      expect(result.valid, `${entry.file}: ${result.errors.join('; ')}`).toBe(true)
      const bundle = mod?.default as { exam: unknown; questions: unknown[] }
      expect(bundle.exam).toEqual(entry.exam)
      expect(bundle.questions).toHaveLength(entry.questionCount)
    }
  })

  it.each(certManifest.map((entry) => [entry.exam.code, entry.exam] as const))(
    '%s declares an overview and an https link to its official exam guide',
    (_code, exam: { overview?: string; officialUrl?: string }) => {
      expect(exam.overview?.trim().length ?? 0).toBeGreaterThan(0)
      expect(exam.officialUrl).toMatch(/^https:\/\//)
    },
  )

  it.each(certManifest.map((entry) => [entry.exam.code, entry.file] as const))(
    '%s has at least exam.totalQuestions answerable questions',
    (code, file) => {
      const bundle = modules[`./${file}`]?.default as CertBundle
      const answerable = bundle.questions.filter(isQuestionAnswerable).length
      expect(
        answerable,
        `${code} has ${answerable} answerable questions but its real exam has ${bundle.exam.totalQuestions}: exam mode cannot build a full exam. Add questions or author the missing options.`,
      ).toBeGreaterThanOrEqual(bundle.exam.totalQuestions)
    },
  )
})
