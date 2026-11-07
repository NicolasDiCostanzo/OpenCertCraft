import { siteUrl } from '../brand.ts'
import { texts } from '../texts/en.ts'
import type { ExamInfo } from '../types.ts'

export interface PageMeta {
  title: string
  canonicalPath: string | null
}

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path}`
}

export function certPath(code: string): string {
  return `/certs/${encodeURIComponent(code)}`
}

export function homeMeta(): PageMeta {
  return { title: texts.seoSiteTitle, canonicalPath: '/' }
}

export function certMeta(exam: ExamInfo): PageMeta {
  return {
    title: texts.seoCertTitle(exam.name, exam.code),
    canonicalPath: certPath(exam.code),
  }
}

export function privateMeta(label: string): PageMeta {
  return { title: texts.seoPageTitle(label), canonicalPath: null }
}
