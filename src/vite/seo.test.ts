import { describe, expect, it } from 'vitest'
import type { CertManifestEntry } from '../types'
import { fillSiteTemplate, renderCertPage, renderRobots, renderSitemap } from './seo'

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
    expect(html).toContain('<title>X-1 practice quiz: Cloud &amp; &quot;Ops&quot; &lt;Associate&gt; | OpenCertCraft</title>')
    expect(html).toContain('<link rel="canonical" href="https://opencertcraft.com/certs/X-1" />')
    expect(html).toContain('<meta property="og:url" content="https://opencertcraft.com/certs/X-1" />')
    expect(html).not.toContain('%SITE_')
    expect(html.match(/<meta name="description"/g)).toHaveLength(1)
    expect(html).toMatch(/<meta property="og:title" content="X-1 practice quiz/)
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

  it('points crawlers at the sitemap without blocking anything', () => {
    const robots = renderRobots()
    expect(robots).toContain('Sitemap: https://opencertcraft.com/sitemap.xml')
    expect(robots).not.toMatch(/^Disallow:\s*\S/m)
  })
})
