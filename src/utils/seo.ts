import { siteUrl } from '../brand.ts'
import { texts } from '../texts/en.ts'
import type { ExamInfo } from '../types.ts'

export interface PageMeta {
  title: string
  description: string
  canonicalPath: string | null
}

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`
}

export function certPath(code: string): string {
  return `/certs/${encodeURIComponent(code)}`
}

export function homeMeta(): PageMeta {
  return { title: texts.seoSiteTitle, description: texts.seoSiteDescription, canonicalPath: '/' }
}

export function certMeta(exam: ExamInfo, questionCount: number): PageMeta {
  return {
    title: texts.seoCertTitle(exam.name, exam.code),
    description: texts.seoCertDescription(exam.name, exam.code, questionCount, exam.totalQuestions, exam.timeLimitMinutes),
    canonicalPath: certPath(exam.code),
  }
}

export function privateMeta(label: string): PageMeta {
  return { title: texts.seoPageTitle(label), description: texts.seoSiteDescription, canonicalPath: null }
}
