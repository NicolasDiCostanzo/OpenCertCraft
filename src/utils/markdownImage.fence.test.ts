import { describe, expect, it } from 'vitest'
import { parseInlineSegments } from './markdownImage'

describe('parseInlineSegments code fences', () => {
  it('parses a fenced block with a language tag', () => {
    expect(parseInlineSegments('```yaml\napiVersion: v1\n```')).toEqual([
      { type: 'code-block', value: 'apiVersion: v1', lang: 'yaml' },
    ])
  })

  it('keeps backticks inside a fenced command instead of ending the block early', () => {
    expect(parseInlineSegments('```\nkubectl get pods -o=jsonpath=`{.items[*]}`\n```')).toEqual([
      {
        type: 'code-block',
        value: 'kubectl get pods -o=jsonpath=`{.items[*]}`',
        lang: '',
      },
    ])
  })

  it('does not let a shorter inner fence line close a longer outer fence', () => {
    const segments = parseInlineSegments('````\n```\nstill code\n```\n````')
    expect(segments).toEqual([{ type: 'code-block', value: '```\nstill code\n```', lang: '' }])
  })

  it('accepts a closing fence with at least as many markers as the opener', () => {
    expect(parseInlineSegments('````\ncode\n``````')).toEqual([
      { type: 'code-block', value: 'code', lang: '' },
    ])
  })

  it('strips indentation from an indented fence and its closer', () => {
    expect(parseInlineSegments('  ```\nA\n  ```')).toEqual([
      { type: 'code-block', value: 'A', lang: '' },
    ])
  })

  it('parses multiple fenced blocks separated by prose', () => {
    expect(parseInlineSegments('```\nA\n```\nmiddle\n```\nB\n```')).toEqual([
      { type: 'code-block', value: 'A', lang: '' },
      { type: 'text', value: '\nmiddle\n' },
      { type: 'code-block', value: 'B', lang: '' },
    ])
  })
})
