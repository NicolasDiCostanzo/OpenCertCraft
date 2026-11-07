import { describe, expect, it } from 'vitest'
import { selectExpiredKeys } from './prune-assets.mjs'
import pruneCases from './fixtures/prune-assets/cases.json'

describe('selectExpiredKeys', () => {
  it.each(pruneCases)('$name', ({ now, retentionDays, objects, expected }) => {
    expect(selectExpiredKeys(objects, Date.parse(now), retentionDays)).toEqual(expected)
  })
})
