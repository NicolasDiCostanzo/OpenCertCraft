import { describe, expect, it } from 'vitest'
import { buildReport } from './llm-report.mjs'
import reportCases from './fixtures/llm-baseline/report-cases.json'

describe('buildReport external section', () => {
  it.each(reportCases)('$name', ({ row, present, absent }) => {
    const report = buildReport('2026-11-02', [row], [], { issues: [] })
    for (const text of present) expect(report).toContain(text)
    for (const text of absent) expect(report).not.toContain(text)
  })
})
