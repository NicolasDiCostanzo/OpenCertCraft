import { describe, expect, it } from 'vitest'
import { purgeCss } from './purgecss'

const css = `
  .used { color: red; }
  .unused { display: none; }
  .btn--sm { font-size: 14px; }
  .btn[data-v-test123] { background: blue; }
  .scoped-unused[data-v-test123] { color: green; }
  :root { --brand: #123; }
  .code-bg { background: var(--brand-bg); }
`

const content = [
  { raw: '<button class="btn btn--primary used">x</button>', extension: 'html' },
  { raw: "const cls = `btn--${size}`", extension: 'js' },
]

describe('purgeCss', () => {
  it('removes unused selectors', async () => {
    const output = await purgeCss(css, content)
    expect(output).toContain('.used')
    expect(output).toContain('.btn[data-v-test123]')
    expect(output).not.toContain('.unused')
    expect(output).not.toContain('.scoped-unused')
  })

  it('keeps safelisted dynamic classes missing from content', async () => {
    const output = await purgeCss(css, content)
    expect(output).toContain('.btn--sm')
  })

  it('keeps scoped data-v attributes but still purges classes inside them', async () => {
    const output = await purgeCss(css, content)
    expect(output).toContain('data-v-test123')
    expect(output).toContain('.btn[data-v-test123]')
    expect(output).not.toContain('.scoped-unused')
  })

  it('keeps custom properties even when unused in content', async () => {
    const output = await purgeCss(css, content)
    expect(output).toContain('--brand')
    expect(output).not.toContain('.code-bg')
  })
})
