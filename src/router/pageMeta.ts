import { texts } from '../texts/en'
import type { CertBundleMeta } from '../types'
import { absoluteUrl, certMeta, homeMeta, privateMeta, type PageMeta } from '../utils/seo'

export function resolvePageMeta(
  routeName: unknown,
  certCode: string | undefined,
  certs: CertBundleMeta[],
): PageMeta {
  if (routeName === 'welcome') return homeMeta()
  const cert = certs.find((candidate) => candidate.exam.code === certCode)
  if (routeName === 'quiz-dashboard' && cert) return certMeta(cert.exam, cert.questionCount)
  const label = typeof routeName === 'string' ? texts.seoRouteTitles[routeName] : undefined
  const base = label ?? texts.notFoundTitle
  return privateMeta(cert ? `${base} (${cert.exam.code})` : base)
}

function ensureHeadElement(doc: Document, selector: string, create: () => HTMLElement): HTMLElement {
  const existing = doc.head.querySelector<HTMLElement>(selector)
  if (existing) return existing
  const element = create()
  doc.head.appendChild(element)
  return element
}

function setMeta(doc: Document, name: string, content: string | null) {
  const selector = `meta[name="${name}"]`
  if (content === null) {
    doc.head.querySelector(selector)?.remove()
    return
  }
  const element = ensureHeadElement(doc, selector, () => {
    const meta = doc.createElement('meta')
    meta.setAttribute('name', name)
    return meta
  })
  element.setAttribute('content', content)
}

function setCanonical(doc: Document, href: string | null) {
  const selector = 'link[rel="canonical"]'
  if (href === null) {
    doc.head.querySelector(selector)?.remove()
    return
  }
  const element = ensureHeadElement(doc, selector, () => {
    const link = doc.createElement('link')
    link.setAttribute('rel', 'canonical')
    return link
  })
  element.setAttribute('href', href)
}

export function applyPageMeta(meta: PageMeta, doc: Document = document) {
  doc.title = meta.title
  setMeta(doc, 'description', meta.description)
  setMeta(doc, 'robots', meta.canonicalPath === null ? 'noindex' : null)
  setCanonical(doc, meta.canonicalPath === null ? null : absoluteUrl(meta.canonicalPath))
}
