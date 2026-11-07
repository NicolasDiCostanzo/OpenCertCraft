import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { appName, siteUrl } from '../brand.ts'
import { texts } from '../texts/en.ts'
import type { CertManifestEntry } from '../types.ts'
import { areWeightsUniform, formatPassingScore } from '../utils/examDisplay.ts'
import { absoluteUrl, certMeta, certPath } from '../utils/seo.ts'

const SAFE_CERT_CODE = /^[A-Za-z0-9._-]+$/

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function fillSiteTemplate(html: string): string {
  return html
    .replaceAll('%SITE_TITLE%', escapeHtml(texts.seoSiteTitle))
    .replaceAll('%SITE_DESCRIPTION%', escapeHtml(texts.seoSiteDescription))
    .replaceAll('%SITE_URL%', siteUrl)
}

function replaceMetaContent(html: string, attribute: 'name' | 'property', key: string, content: string): string {
  const pattern = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`)
  if (!pattern.test(html)) {
    throw new Error(`index.html has no <meta ${attribute}="${key}"> tag to specialize for a certification page.`)
  }
  return html.replace(pattern, (_match, before: string, after: string) => `${before}${escapeHtml(content)}${after}`)
}

function certBody(entry: CertManifestEntry): string {
  const { exam, questionCount } = entry
  const showWeights = exam.weights !== undefined && !areWeightsUniform(exam.weights)
  const facts = [
    [texts.questionBankLabel, texts.questionBankValue(questionCount)],
    [texts.realExamLabel, texts.realExamValue(exam.totalQuestions)],
    [texts.timeLimitLabel, texts.timeLimitValue(exam.timeLimitMinutes)],
    [texts.passingScoreLabel, formatPassingScore(exam.passingScore)],
  ]
    .map(([label, value]) => `<li>${escapeHtml(label)}: ${escapeHtml(value)}</li>`)
    .join('')
  const domains = exam.weights
    ? `<h2>${escapeHtml(texts.seoCertDomainsTitle)}</h2><ul>${Object.entries(exam.weights)
        .map(([topic, weight]) => `<li>${escapeHtml(texts.seoCertDomainItem(topic, showWeights ? weight : null))}</li>`)
        .join('')}</ul>`
    : ''
  return (
    `<main><h1>${escapeHtml(texts.seoCertHeading(exam.name, exam.code))}</h1>` +
    `<p>${escapeHtml(certMeta(exam, questionCount).description)}</p>` +
    `<ul>${facts}</ul>${domains}` +
    `<p><a href="/">${escapeHtml(appName)}</a></p></main>`
  )
}

export function renderCertPage(template: string, entry: CertManifestEntry, bankChunkPath: string): string {
  const { exam } = entry
  if (!SAFE_CERT_CODE.test(exam.code)) {
    throw new Error(`Exam code "${exam.code}" cannot be used as a URL path segment.`)
  }
  const meta = certMeta(exam, entry.questionCount)
  const url = absoluteUrl(certPath(exam.code))
  let html = template.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(meta.title)}</title>`)
  html = replaceMetaContent(html, 'name', 'description', meta.description)
  html = replaceMetaContent(html, 'property', 'og:title', meta.title)
  html = replaceMetaContent(html, 'property', 'og:description', meta.description)
  html = replaceMetaContent(html, 'name', 'twitter:title', meta.title)
  html = replaceMetaContent(html, 'name', 'twitter:description', meta.description)
  const headExtras =
    `<link rel="canonical" href="${escapeHtml(url)}" />` +
    `<meta property="og:url" content="${escapeHtml(url)}" />` +
    `<link rel="modulepreload" crossorigin href="${escapeHtml(encodeURI(bankChunkPath))}" />`
  if (!html.includes('</head>')) throw new Error('index.html has no </head> to inject certification metadata into.')
  html = html.replace('</head>', () => `${headExtras}</head>`)
  const emptyRoot = '<div id="app"></div>'
  if (!html.includes(emptyRoot)) throw new Error('index.html has no empty <div id="app"></div> to prerender into.')
  return html.replace(emptyRoot, () => `<div id="app">${certBody(entry)}</div>`)
}

export function renderRobots(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
}

export function renderSitemap(entries: CertManifestEntry[], lastModified: Record<string, string> = {}): string {
  const pages = [
    { path: '/', lastmod: undefined },
    ...entries.map((entry) => ({ path: certPath(entry.exam.code), lastmod: lastModified[entry.exam.code] })),
  ]
  const urls = pages
    .map(
      ({ path, lastmod }) =>
        `  <url><loc>${escapeHtml(absoluteUrl(path))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function bundleLastModified(root: string, file: string): string | null {
  const run = (args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    if (run(['rev-parse', '--is-shallow-repository']) !== 'false') return null
    const date = run(['log', '-1', '--format=%cs', '--', `src/assets/${file}`])
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
  } catch {
    return null
  }
}

function findBankChunk(bundle: Record<string, { type: string; fileName: string; facadeModuleId?: string | null }>, entry: CertManifestEntry): string {
  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk' && output.facadeModuleId?.endsWith(`/src/assets/${entry.file}`)) {
      return `/${output.fileName}`
    }
  }
  throw new Error(`SEO plugin could not find the built question-bank chunk for "${entry.file}".`)
}

export function seoPlugin(root: string): Plugin {
  return {
    name: 'seo',
    enforce: 'post',
    transformIndexHtml: fillSiteTemplate,
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const page = bundle['index.html']
        if (page?.type !== 'asset') throw new Error('SEO plugin could not find the built index.html.')
        const template = typeof page.source === 'string' ? page.source : new TextDecoder().decode(page.source)
        const manifest = JSON.parse(
          await readFile(join(root, 'src/assets/cert-manifest.json'), 'utf8'),
        ) as CertManifestEntry[]
        const lastModified: Record<string, string> = {}
        for (const entry of manifest) {
          this.emitFile({
            type: 'asset',
            fileName: `certs/${entry.exam.code}/index.html`,
            source: renderCertPage(template, entry, findBankChunk(bundle, entry)),
          })
          const date = bundleLastModified(root, entry.file)
          if (date) lastModified[entry.exam.code] = date
        }
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: renderRobots() })
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap(manifest, lastModified) })
      },
    },
  }
}
