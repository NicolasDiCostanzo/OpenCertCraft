import { describe, expect, it } from 'vitest'
import type { CertManifestEntry } from '../types'
import { multiAnswerQuestion, riskyQuestion, singleAnswerQuestion } from '../utils/fixtures/sampleQuestions.fixture'
import { COMMIT_DATE, makeSiteRoot } from './fixtures/siteRoot.fixture'
import { fillSiteTemplate, renderCertPage, renderRobots, renderSitemap, seoPlugin } from './seo'

const template = fillSiteTemplate(`<!doctype html>
<html lang="en">
  <head>
    <title>%SITE_TITLE%</title>
    <meta name="description" content="%SITE_DESCRIPTION%" />
    <meta property="og:title" content="%SITE_TITLE%" />
    <meta property="og:description" content="%SITE_DESCRIPTION%" />
    <meta name="twitter:title" content="%SITE_TITLE%" />
    <meta name="twitter:description" content="%SITE_DESCRIPTION%" />
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>`)

const BANK = '/assets/X-1 questions-abc123.js'

function entry(overrides: Partial<CertManifestEntry['exam']> = {}): CertManifestEntry {
  return {
    file: 'X-1 questions.json',
    questionCount: 120,
    exam: {
      name: 'Cloud & "Ops" <Associate>',
      code: 'X-1',
      totalQuestions: 60,
      timeLimitMinutes: 90,
      passingScore: { passingScore: 700, scale: 1000 },
      weights: { Security: 60, Networking: 40 },
      ...overrides,
    },
  }
}

describe('renderCertPage', () => {
  it('gives the page its own title, description, canonical and social tags', () => {
    const html = renderCertPage(template, entry(), BANK)
    expect(html).toContain('<title>X-1 practice test: Cloud &amp; &quot;Ops&quot; &lt;Associate&gt; | OpenCertCraft</title>')
    expect(html).toContain('<link rel="canonical" href="https://opencertcraft.com/certs/X-1" />')
    expect(html).toContain('<meta property="og:url" content="https://opencertcraft.com/certs/X-1" />')
    expect(html).not.toContain('%SITE_')
    expect(html.match(/<meta name="description"/g)).toHaveLength(1)
    expect(html).toMatch(/<meta property="og:title" content="X-1 practice test/)
  })

  it('prerenders a heading and description that use the practice test and mock exam wording', () => {
    const html = renderCertPage(template, entry(), BANK)
    expect(html).toMatch(/<h1>[^<]*practice test<\/h1>/)
    expect(html).toMatch(/<main>.*<p>[^<]*mock exam[^<]*<\/p>/)
  })

  it('preloads the question bank chunk so it downloads alongside the entry script', () => {
    const html = renderCertPage(template, entry(), BANK)
    expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/X-1%20questions-abc123.js" />')
  })

  it('prerenders the exam facts and domains, with weights only when they differ', () => {
    const weighted = renderCertPage(template, entry(), BANK)
    expect(weighted).toContain('<li>Security (60%)</li>')
    expect(weighted).toContain('700 / 1000 (70%)')
    const uniform = renderCertPage(template, entry({ weights: { Security: 50, Networking: 50 } }), BANK)
    expect(uniform).toContain('<li>Security</li>')
    expect(uniform).not.toContain('(50%)')
  })

  it('prerenders the sample questions as a folded set with tags, options and a folded answer', () => {
    const html = renderCertPage(template, entry(), BANK, [singleAnswerQuestion, multiAnswerQuestion])
    expect(html).toContain('<details class="samples"><summary>Example practice questions</summary>')
    expect(html).not.toMatch(/<details[^>]*\sopen/)
    expect(html).toContain('Topic: Security')
    expect(html).toContain('services: s3, kms')
    expect(html).toContain('Which option encrypts data at rest?')
    expect(html).toContain('<span>B</span>Server-side encryption')
    expect(html).toContain('Correct answer:</strong> B, D')
    expect(html).toContain('Server-side encryption protects stored data.')
  })

  it('omits the sample section when there are no samples', () => {
    expect(renderCertPage(template, entry(), BANK)).not.toContain('samples')
    expect(renderCertPage(template, entry(), BANK, [])).not.toContain('samples')
  })

  it('escapes sample text and renders code like the app does', () => {
    const html = renderCertPage(template, entry(), BANK, [riskyQuestion])
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<i>text</i>')
    expect(html).toContain('<code>&lt;b&gt;</code>')
    expect(html).toContain('<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('bold &amp; nothing')
  })

  it('refuses an exam code that cannot be a URL path segment', () => {
    expect(() => renderCertPage(template, entry({ code: '../evil' }), BANK)).toThrow(/URL path segment/)
  })

  it('fails loudly when the index.html template lost a tag it has to specialize', () => {
    expect(() => renderCertPage(template.replace(/<meta name="description"[^>]*>/, ''), entry(), BANK)).toThrow(/description/)
    expect(() => renderCertPage(template.replace('<div id="app"></div>', ''), entry(), BANK)).toThrow(/prerender/)
  })
})

describe('sitemap and robots', () => {
  it('lists the home page and one URL per certification', () => {
    const sitemap = renderSitemap([entry(), entry({ code: 'Y-2' })])
    expect(sitemap).toContain('<loc>https://opencertcraft.com/</loc>')
    expect(sitemap).toContain('<loc>https://opencertcraft.com/certs/X-1</loc>')
    expect(sitemap).toContain('<loc>https://opencertcraft.com/certs/Y-2</loc>')
    expect(sitemap.match(/<url>/g)).toHaveLength(3)
  })

  it('adds lastmod only for certifications whose date is known', () => {
    const sitemap = renderSitemap([entry(), entry({ code: 'Y-2' })], { 'X-1': '2026-11-06' })
    expect(sitemap).toContain('<loc>https://opencertcraft.com/certs/X-1</loc><lastmod>2026-11-06</lastmod>')
    expect(sitemap).toContain('<loc>https://opencertcraft.com/certs/Y-2</loc></url>')
    expect(sitemap).toContain('<loc>https://opencertcraft.com/</loc></url>')
  })

  it('ignores inherited object properties when looking up a lastmod', () => {
    expect(renderSitemap([entry({ code: 'constructor' })])).not.toContain('<lastmod>')
  })

  it('points crawlers at the sitemap without blocking anything', () => {
    const robots = renderRobots()
    expect(robots).toContain('Sitemap: https://opencertcraft.com/sitemap.xml')
    expect(robots).not.toMatch(/^Disallow:\s*\S/m)
  })
})

describe('seoPlugin', () => {
  const chunk = (fileName: string, root: string) => ({
    type: 'chunk',
    fileName,
    facadeModuleId: `${root}/src/assets/X-1 questions.json`,
  })

  async function generate(root: string, outputs: Record<string, unknown>) {
    const emitted: { fileName: string; source: string }[] = []
    const plugin = seoPlugin(root)
    const { handler } = plugin.generateBundle as unknown as {
      handler: (this: unknown, options: unknown, bundle: unknown) => Promise<void>
    }
    const bundle = { 'index.html': { type: 'asset', source: template }, ...outputs }
    await handler.call({ emitFile: (file: { fileName: string; source: string }) => emitted.push(file) }, {}, bundle)
    return Object.fromEntries(emitted.map((file) => [file.fileName, file.source]))
  }

  it('preloads the bank chunk found in the bundle and embeds sample questions from the bundle file', async () => {
    const root = makeSiteRoot({ withGit: false })
    const files = await generate(root, { 'assets/X-1 questions-h4sh.js': chunk('assets/X-1 questions-h4sh.js', root) })

    expect(files['certs/X-1/index.html']).toContain('href="/assets/X-1%20questions-h4sh.js"')
    expect(files['certs/X-1/index.html']).toContain('Which option encrypts data at rest?')
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['robots.txt', 'sitemap.xml']))
  })

  it('fails the build when the question bank chunk is missing from the bundle', async () => {
    await expect(generate(makeSiteRoot({ withGit: false }), {})).rejects.toThrow(/X-1 questions\.json/)
  })

  it.each([
    { withGit: true, expected: `<lastmod>${COMMIT_DATE}</lastmod>` },
    { withGit: false, expected: null },
  ])('sets the sitemap lastmod from git history only when available (git: $withGit)', async ({ withGit, expected }) => {
    const root = makeSiteRoot({ withGit })
    const files = await generate(root, { 'assets/b.js': chunk('assets/b.js', root) })

    if (expected) expect(files['sitemap.xml']).toContain(expected)
    else expect(files['sitemap.xml']).not.toContain('<lastmod>')
  })
})
