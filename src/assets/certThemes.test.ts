import { describe, expect, it } from 'vitest'
import type { CertBundle } from '../types'
import { validateCertBundle } from '../utils/schemaValidator'
import { CERT_FAMILIES, CERT_FAMILY } from './certFamilies'

const modules = import.meta.glob<{ default: unknown }>('./*questions.json', { eager: true })

function loadBundle(path: string, mod: { default: unknown }): CertBundle {
  const result = validateCertBundle(mod.default)
  expect(result.valid, `${path}: ${result.errors.join('; ')}`).toBe(true)
  return result.bundle as CertBundle
}

describe('cert theme integrity', () => {
  it('declares every theme group and value a question references', () => {
    for (const [path, mod] of Object.entries(modules)) {
      const bundle = loadBundle(path, mod)
      const undeclared: string[] = []
      for (const question of bundle.questions) {
        for (const [group, values] of Object.entries(question.themes ?? {})) {
          if (!Object.hasOwn(bundle.themes, group)) {
            undeclared.push(`group "${group}" (question ${question.id})`)
            continue
          }
          for (const value of values) {
            if (!(bundle.themes[group] as string[]).includes(value)) {
              undeclared.push(`value "${group}.${value}" (question ${question.id})`)
            }
          }
        }
      }
      expect(
        undeclared,
        `${path} references theme values missing from its registry: ${undeclared.join(', ')}. Add them to the top-level "themes" registry or retag the questions.`,
      ).toEqual([])
    }
  })

  it('declares no theme value that no question uses', () => {
    for (const [path, mod] of Object.entries(modules)) {
      const bundle = loadBundle(path, mod)
      const used = new Set<string>()
      for (const question of bundle.questions) {
        for (const [group, values] of Object.entries(question.themes ?? {})) {
          for (const value of values) used.add(`${group}/${value}`)
        }
      }
      const orphans = Object.entries(bundle.themes).flatMap(([group, values]) =>
        values
          .filter((value) => !used.has(`${group}/${value}`))
          .map((value) => `${group}.${value}`),
      )
      expect(
        orphans,
        `${path} declares theme values no question uses: ${orphans.join(', ')}. Remove them or tag the questions that should carry them — an unused value usually means a copied registry or an untagged question.`,
      ).toEqual([])
    }
  })

  it('tags every question, so none is invisible to theme filters', () => {
    for (const [path, mod] of Object.entries(modules)) {
      const bundle = loadBundle(path, mod)
      const untagged = bundle.questions
        .filter((question) => Object.keys(question.themes ?? {}).length === 0)
        .map((question) => question.id)
      expect(
        untagged,
        `${path} has questions with no themes: they can never be selected by a theme filter. Tag them, or drop "themes" for the whole bundle deliberately.`,
      ).toEqual([])
    }
  })

  it('keeps the family code lists consistent with CERT_FAMILY', () => {
    expect(CERT_FAMILY).toEqual(
      Object.fromEntries(
        CERT_FAMILIES.flatMap((family) =>
          family.codes.map((code) => [code, family.id]),
        ),
      ),
    )
  })

  it('uses one taxonomy shape across certs in the same family', () => {
    const bundles = Object.values(modules).map((mod) => loadBundle('bundle', mod))
    const unknown = bundles
      .map((bundle) => bundle.exam.code)
      .filter((code) => !CERT_FAMILY[code])
    expect(
      unknown,
      `Add these codes to CERT_FAMILY so their taxonomy is checked: ${unknown.join(', ')}`,
    ).toEqual([])

    const shapeByFamily = new Map<string, { shape: string; codes: string[] }>()
    for (const bundle of bundles) {
      const family = CERT_FAMILY[bundle.exam.code]
      const shape = Object.keys(bundle.themes).sort().join(', ')
      const entry = shapeByFamily.get(family)
      if (entry) entry.codes.push(bundle.exam.code)
      else shapeByFamily.set(family, { shape, codes: [bundle.exam.code] })
    }

    const drifting = [...shapeByFamily.values()].filter((entry) => entry.codes.length > 1)
    for (const entry of drifting) {
      const shapes = new Set(
        bundles
          .filter((bundle) => entry.codes.includes(bundle.exam.code))
          .map((bundle) => Object.keys(bundle.themes).sort().join(', ')),
      )
      expect(
        [...shapes],
        `Certs in one family must name their theme groups identically, so a filter means the same thing across the selector: ${entry.codes.join(', ')} disagree. Rename the group in the newer cert to match its siblings.`,
      ).toHaveLength(1)
    }
  })
})
