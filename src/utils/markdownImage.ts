interface TextSegment {
  type: 'text'
  value: string
}

interface ImageSegment {
  type: 'image'
  value: string
  alt: string
}

interface CodeBlockSegment {
  type: 'code-block'
  value: string
  lang: string
}

interface InlineCodeSegment {
  type: 'inline-code'
  value: string
}

export type InlineSegment = TextSegment | ImageSegment | CodeBlockSegment | InlineCodeSegment

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/
const INLINE_CODE_PATTERN = /`([^`\n]+)`/
const CODE_FENCE_PATTERN = /^[ \t]*(`{3,})([^\n`]*)\n([\s\S]*?)^[ \t]*\1`*[ \t]*(?=\r?\n|$)/gm
const INLINE_TOKEN_PATTERN = new RegExp(`${IMAGE_PATTERN.source}|${INLINE_CODE_PATTERN.source}`, 'g')
const SAFE_IMAGE_URL_PATTERN = /^(https?:|data:image\/)/i
const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

function isSafeImageUrl(url: string): boolean {
  return !HAS_SCHEME_PATTERN.test(url) || SAFE_IMAGE_URL_PATTERN.test(url)
}

function pushInlineSegments(segments: InlineSegment[], chunk: string): void {
  let lastIndex = 0

  for (const match of chunk.matchAll(INLINE_TOKEN_PATTERN)) {
    const [full, alt, url, code] = match
    const index = match.index

    if (index > lastIndex) {
      segments.push({ type: 'text', value: chunk.slice(lastIndex, index) })
    }

    if (code !== undefined) {
      segments.push({ type: 'inline-code', value: code })
    } else {
      segments.push(
        isSafeImageUrl(url) ? { type: 'image', value: url, alt } : { type: 'text', value: full },
      )
    }
    lastIndex = index + full.length
  }

  if (lastIndex < chunk.length) {
    segments.push({ type: 'text', value: chunk.slice(lastIndex) })
  }
}

export function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let lastIndex = 0

  for (const fence of text.matchAll(CODE_FENCE_PATTERN)) {
    const [full, , lang, body] = fence
    const index = fence.index

    if (index > lastIndex) {
      pushInlineSegments(segments, text.slice(lastIndex, index))
    }

    segments.push({ type: 'code-block', value: body.replace(/\n$/, ''), lang: lang.trim() })
    lastIndex = index + full.length
  }

  if (lastIndex < text.length) {
    pushInlineSegments(segments, text.slice(lastIndex))
  }

  return segments
}
