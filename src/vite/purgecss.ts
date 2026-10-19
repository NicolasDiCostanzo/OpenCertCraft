import { PurgeCSS } from 'purgecss'

// Classes assembled at runtime (`btn--${size}`, `badge--${variant}` …) never
// appear literally in templates, so purgecss's static extractor misses them.
const DYNAMIC_CLASS_PREFIXES = [/^btn--/, /^badge--/, /^welcome-card--/]

const purgeSafelist = {
  standard: DYNAMIC_CLASS_PREFIXES,
}

function dataVueAttributesInCss(css: string): string[] {
  const attributes = new Set<string>()
  for (const match of css.matchAll(/data-v-[\w-]+/g)) {
    attributes.add(match[0])
  }
  return [...attributes]
}

export async function purgeCss(
  css: string,
  content: Array<{ raw: string; extension: string }>,
): Promise<string> {
  const result = await new PurgeCSS().purge({
    content,
    css: [{ raw: css }],
    safelist: purgeSafelist,
    dynamicAttributes: dataVueAttributesInCss(css),
  })
  return result[0].css
}
