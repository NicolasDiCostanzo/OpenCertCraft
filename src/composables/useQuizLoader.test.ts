import { describe, expect, it, vi } from 'vitest'
import type { CertManifestEntry } from '../types'
import { cloneBundle, validCertBundle } from '../utils/fixtures/certBundle.fixture'
import { createCertRegistry } from './useQuizLoader'

type ModuleLoader = () => Promise<{ default: unknown }>

function manifestEntry(examCode: string, file: string, questionCount: number): CertManifestEntry {
  return {
    file,
    exam: { ...validCertBundle.exam, code: examCode },
    questionCount,
  }
}

function loadersFor(bundles: Record<string, unknown>): Record<string, ModuleLoader> {
  return Object.fromEntries(
    Object.entries(bundles).map(([path, data]) => [path, vi.fn(async () => ({ default: data }))]),
  )
}

describe('createCertRegistry', () => {
  it('loads each manifest-listed bundle on demand and exposes its meta immediately', async () => {
    const second = cloneBundle(validCertBundle)
    second.exam.code = 'SECOND'

    const registry = createCertRegistry(
      loadersFor({
        '/src/assets/first.json': validCertBundle,
        '/src/assets/second.json': second,
      }),
      [manifestEntry('FIX-001', 'first.json', 2), manifestEntry('SECOND', 'second.json', 2)],
    )

    expect(registry.getCert('FIX-001')).toBeUndefined()
    expect(registry.availableCertMetas().map((meta) => meta.exam.code).sort()).toEqual([
      'FIX-001',
      'SECOND',
    ])
    expect(registry.availableCertMetas().every((meta) => meta.questionCount === 2)).toBe(true)
    await expect(registry.ensureCertLoaded('FIX-001')).resolves.toBe(true)
    expect(registry.getCert('FIX-001')).toEqual(validCertBundle)
    await expect(registry.ensureCertLoaded('SECOND')).resolves.toBe(true)
    expect(registry.issuesByPath).toEqual({})
  })

  it('groups metas by family and collects unknown codes under Other', () => {
    const registry = createCertRegistry(
      loadersFor({
        '/src/assets/dva.json': validCertBundle,
        '/src/assets/unknown.json': validCertBundle,
      }),
      [manifestEntry('DVA-C02', 'dva.json', 2), manifestEntry('NEW-01', 'unknown.json', 2)],
    )

    const groups = registry.groupedCertMetas()
    const aws = groups.find((group) => group.familyId === 'aws')
    expect(aws?.label).toBe('AWS')
    expect(aws?.certs.map((meta) => meta.exam.code)).toEqual(['DVA-C02'])

    const other = groups.find((group) => group.familyId === 'other')
    expect(other?.certs.map((meta) => meta.exam.code)).toEqual(['NEW-01'])
  })

  it('caches a loaded cert and never re-imports its bundle', async () => {
    const loader = vi.fn(async () => ({ default: validCertBundle }))
    const registry = createCertRegistry({ '/src/assets/first.json': loader }, [
      manifestEntry('FIX-001', 'first.json', 2),
    ])

    await registry.ensureCertLoaded('FIX-001')
    await registry.ensureCertLoaded('FIX-001')

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('returns false for an exam code that is not in the manifest', async () => {
    const registry = createCertRegistry(loadersFor({ '/src/assets/first.json': validCertBundle }), [
      manifestEntry('FIX-001', 'first.json', 2),
    ])

    await expect(registry.ensureCertLoaded('NOPE-01')).resolves.toBe(false)
  })

  it('throws eagerly when two manifest entries share an exam code', () => {
    expect(() =>
      createCertRegistry(
        loadersFor({
          '/src/assets/first.json': validCertBundle,
          '/src/assets/duplicate.json': validCertBundle,
        }),
        [manifestEntry('FIX-001', 'first.json', 2), manifestEntry('FIX-001', 'duplicate.json', 2)],
      ),
    ).toThrow(/Duplicate exam code "FIX-001" in the cert manifest/s)
  })

  it('throws eagerly when the manifest references a missing bundle file', () => {
    expect(() =>
      createCertRegistry(loadersFor({ '/src/assets/first.json': validCertBundle }), [
        manifestEntry('FIX-001', 'missing.json', 2),
      ]),
    ).toThrow(/references "missing\.json" but no matching \/src\/assets\/\*questions\.json file exists/s)
  })

  it('excludes a bundle that fails schema validation and reports it under issuesByPath', async () => {
    const registry = createCertRegistry(loadersFor({ '/src/assets/broken.json': { not: 'a cert bundle' } }), [
      manifestEntry('FIX-001', 'broken.json', 2),
    ])

    await expect(registry.ensureCertLoaded('FIX-001')).resolves.toBe(false)
    expect(registry.getCert('FIX-001')).toBeUndefined()
    expect(registry.issuesByPath['/src/assets/broken.json']).toBeInstanceOf(Array)
    expect(registry.issuesByPath['/src/assets/broken.json'].length).toBeGreaterThan(0)
  })

  it('excludes a bundle whose exam code does not match its manifest entry', async () => {
    const mismatched = cloneBundle(validCertBundle)
    mismatched.exam.code = 'OTHER'

    const registry = createCertRegistry(loadersFor({ '/src/assets/mismatched.json': mismatched }), [
      manifestEntry('FIX-001', 'mismatched.json', 2),
    ])

    await expect(registry.ensureCertLoaded('FIX-001')).resolves.toBe(false)
    expect(registry.issuesByPath['/src/assets/mismatched.json'][0]).toMatch(
      /"OTHER" does not match manifest entry "FIX-001"/s,
    )
  })

  it('excludes a bundle whose import rejects and reports it under issuesByPath', async () => {
    const registry = createCertRegistry(
      { '/src/assets/failing.json': vi.fn(async () => {
        throw new Error('network down')
      }) },
      [manifestEntry('FIX-001', 'failing.json', 2)],
    )

    await expect(registry.ensureCertLoaded('FIX-001')).resolves.toBe(false)
    expect(registry.issuesByPath['/src/assets/failing.json']).toEqual(['network down'])
  })
})
