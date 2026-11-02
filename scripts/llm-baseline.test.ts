import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyFindings, hasFindings, loadBaseline, priorVerdict } from './llm-baseline.mjs'
import classifyCases from './fixtures/llm-baseline/classify-cases.json'

const fixtureDir = (name: string) => join(import.meta.dirname, 'fixtures', 'llm-baseline', name)

describe('loadBaseline', () => {
  it.each(['missing', 'corrupt', 'wrong-shape'])('falls back to an empty baseline for the %s case', (name) => {
    expect(loadBaseline(fixtureDir(name)).size).toBe(0)
  })

  it('keeps only well-formed snapshots, keyed by cert', () => {
    expect([...loadBaseline(fixtureDir('valid')).keys()]).toEqual(['CKA'])
  })
})

describe('priorVerdict', () => {
  const baseline = loadBaseline(fixtureDir('valid'))

  it.each([
    { cert: 'CKA', url: 'https://example.test/cka', found: true },
    { cert: 'CKA', url: 'https://example.test/other-guide', found: false },
    { cert: 'DVA-C02', url: 'https://example.test/cka', found: false },
  ])('$cert at $url -> found: $found', ({ cert, url, found }) => {
    expect(priorVerdict(baseline, cert, url) !== undefined).toBe(found)
  })
})

describe('hasFindings', () => {
  it.each([
    { verdict: { new_domains: [], removed_domains: [], renamed: [], notes: ['x'] }, expected: false },
    { verdict: { new_domains: [{ name: 'A' }] }, expected: true },
    { verdict: undefined, expected: false },
  ])('$verdict -> $expected', ({ verdict, expected }) => {
    expect(hasFindings(verdict)).toBe(expected)
  })
})

describe('classifyFindings', () => {
  it.each(classifyCases)('$name', ({ previous, verdict, expected }) => {
    expect(classifyFindings(verdict, previous)).toEqual(expected)
  })
})
