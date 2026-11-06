import { beforeEach, describe, expect, it } from 'vitest'
import type { CertBundleMeta } from '../types'
import { applyPageMeta, resolvePageMeta } from './pageMeta'

const certs: CertBundleMeta[] = [
  {
    questionCount: 100,
    exam: { name: 'Cloud Basics', code: 'CB-1', totalQuestions: 50, timeLimitMinutes: 60, passingScore: { passingScore: 70 } },
  },
]

describe('resolvePageMeta', () => {
  it('indexes only the home page and known certification pages', () => {
    expect(resolvePageMeta('welcome', undefined, certs).canonicalPath).toBe('/')
    expect(resolvePageMeta('quiz-dashboard', 'CB-1', certs).canonicalPath).toBe('/certs/CB-1')
  })

  it('keeps every private or in-quiz route out of the index', () => {
    for (const name of ['auth', 'cert-selector', 'quiz-configure', 'quiz-session', 'quiz-review', 'quiz-history-review', 'topic-review', 'theme-review', 'flagged-review', 'not-found']) {
      expect(resolvePageMeta(name, 'CB-1', certs).canonicalPath, name).toBeNull()
    }
  })

  it('never indexes a certification page whose code is unknown', () => {
    expect(resolvePageMeta('quiz-dashboard', 'NOPE', certs).canonicalPath).toBeNull()
  })

  it('identifies the certification in titles of cert-scoped private routes', () => {
    expect(resolvePageMeta('quiz-configure', 'CB-1', certs).title).toContain('CB-1')
  })
})

describe('applyPageMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  it('marks an indexable page with a canonical URL and no robots restriction', () => {
    applyPageMeta(resolvePageMeta('quiz-dashboard', 'CB-1', certs))
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://opencertcraft.com/certs/CB-1')
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
    expect(document.title).toContain('CB-1')
  })

  it('switches to noindex and drops the canonical when navigating to a private page', () => {
    applyPageMeta(resolvePageMeta('quiz-dashboard', 'CB-1', certs))
    applyPageMeta(resolvePageMeta('quiz-session', 'CB-1', certs))
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('lifts the noindex again when coming back to an indexable page', () => {
    applyPageMeta(resolvePageMeta('auth', undefined, certs))
    applyPageMeta(resolvePageMeta('welcome', undefined, certs))
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
  })
})
