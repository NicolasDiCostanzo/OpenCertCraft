import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = join(ROOT, 'src', 'assets');
const SOURCES_PATH = join(ROOT, 'scripts', 'vendor-sources.json');
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const FETCH_TIMEOUT_MS = 30000;
const MAX_GUIDE_CHARS = 60000;
const MAX_BUNDLE_CHARS = 20000;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchGuideText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'opencertcraft-bundle-review/1.0 (+weekly drift check)', Accept: 'text/html,application/pdf,*/*' },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
      await response.body?.cancel().catch(() => undefined);
      return { ok: false, reason: 'PDF_GUIDE', contentType };
    }
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, reason: 'EMPTY_PAGE' };
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > MAX_GUIDE_CHARS) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    text += decoder.decode();
    if (text.length < 500) return { ok: false, reason: 'EMPTY_PAGE' };
    return { ok: true, text: stripHtml(text).slice(0, MAX_GUIDE_CHARS) };
  } catch (error) {
    return { ok: false, reason: error.name === 'AbortError' ? 'TIMEOUT' : String(error.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSourcesFor(cert, guide) {
  if (!guide) return { status: 'no-source', note: 'No stable official exam-guide URL yet — add one to scripts/vendor-sources.json.' };
  const urls = Array.isArray(guide) ? guide : [guide];
  const attempts = [];
  for (const url of urls) {
    const result = await fetchGuideText(url);
    if (result.ok) return { status: 'ok', url, text: result.text };
    attempts.push(`${url} (${result.reason})`);
  }
  const pdfOnly = attempts.every((attempt) => attempt.includes('PDF_GUIDE'));
  return {
    status: pdfOnly ? 'pdf-only' : 'fetch-failed',
    note: pdfOnly
      ? 'All guide URLs are PDFs, which this runner cannot parse — human pass needed, or add PDF text extraction.'
      : `Could not fetch any guide URL: ${attempts.join('; ')}.`,
  };
}

function summarizeBundleStructure(cert) {
  const candidates = readdirSync(ASSETS_DIR).filter((name) => name.endsWith('questions.json'));
  const manifest = JSON.parse(readFileSync(join(ASSETS_DIR, 'cert-manifest.json'), 'utf-8'));
  const entry = manifest.find((candidate) => candidate.exam?.code === cert);
  const file = entry?.file ?? candidates.find((name) => name.startsWith(`${cert} `));
  if (!file) return { error: `No bundle file found for ${cert}.` };
  const bundle = JSON.parse(readFileSync(join(ASSETS_DIR, file), 'utf-8'));
  const topics = [...new Set((bundle.questions ?? []).map((q) => q.topic))].sort();
  const lines = [
    `cert: ${cert} (${bundle.exam?.name ?? 'unknown'})`,
    `topics (${topics.length}): ${topics.join(' | ')}`,
    `theme groups: ${Object.keys(bundle.themes ?? {}).join(', ')}`,
    `questions: ${(bundle.questions ?? []).length}`,
  ];
  return { file, text: lines.join('\n').slice(0, MAX_BUNDLE_CHARS), topics };
}

function buildPrompt(cert, guideUrl, guideText, bundleText) {
  return [
    `You review certification exam-prep content for staleness. Cert: ${cert}.`,
    `Official vendor exam guide (${guideUrl}) — extracted text:`,
    '---GUIDE---',
    guideText,
    '---BUNDLE (our current question-bank structure)---',
    bundleText,
    'Compare the guide against the bundle structure and return JSON ONLY, no prose, with this shape:',
    '{"new_domains":[{"name":"...","quote":"verbatim guide line, max 200 chars"}],"removed_domains":[{"name":"...","quote":"..."}],"renamed":[{"from":"...","to":"...","quote":"..."}],"notes":["..."]}',
    'Rules: quote the guide VERBATIM for every claim or omit the claim. Bundle topics/themes are the baseline — only report guide-side drift. Never invent answer keys or rewrite questions. Empty arrays when nothing changed.',
  ].join('\n');
}

async function callAnthropic(prompt, model, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic API HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const body = await response.json();
  const text = (body.content ?? []).filter((block) => block.type === 'text').map((block) => block.text).join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('LLM response contained no JSON object.');
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeVerdict(raw) {
  const pick = (value) => (Array.isArray(value) ? value.filter((entry) => entry && typeof entry.name === 'string') : []);
  return {
    new_domains: pick(raw?.new_domains).map((entry) => ({ name: entry.name, quote: typeof entry.quote === 'string' ? entry.quote.slice(0, 200) : '' })),
    removed_domains: pick(raw?.removed_domains).map((entry) => ({ name: entry.name, quote: typeof entry.quote === 'string' ? entry.quote.slice(0, 200) : '' })),
    renamed: pick(raw?.renamed).filter((entry) => typeof entry.from === 'string' && typeof entry.to === 'string'),
    notes: Array.isArray(raw?.notes) ? raw.notes.filter((note) => typeof note === 'string').slice(0, 10) : [],
  };
}

function section(title, lines) {
  return [`## ${title}`, ...(lines.length > 0 ? lines : ['- Nothing to report.']), ''].join('\n');
}

function buildReport(date, external, skipped, internal) {
  const parts = [`# Weekly cert-bundle review — ${date}`, ''];
  const externalLines = [];
  for (const row of external) {
    if (row.status === 'changed') {
      for (const domain of row.verdict.new_domains) {
        externalLines.push(`- 🆕 ${row.cert}: guide now lists "${domain.name}"${domain.quote ? ` — "${domain.quote}"` : ''}. Check whether questions cover it.`);
      }
      for (const domain of row.verdict.removed_domains) {
        externalLines.push(`- ⚠️ ${row.cert}: guide no longer lists "${domain.name}"${domain.quote ? ` — "${domain.quote}"` : ''}. Questions on it are stale candidates.`);
      }
      for (const rename of row.verdict.renamed) {
        externalLines.push(`- 🔁 ${row.cert}: "${rename.from}" → "${rename.to}" in the guide. Bundle topics/themes may need renaming.`);
      }
      for (const note of row.verdict.notes) externalLines.push(`- 📝 ${row.cert}: ${note}`);
      if (row.verdict.new_domains.length === 0 && row.verdict.removed_domains.length === 0 && row.verdict.renamed.length === 0 && row.verdict.notes.length === 0) {
        externalLines.push(`- ✅ ${row.cert}: guide matches bundle structure, no drift.`);
      }
    } else {
      externalLines.push(`- ⏭️ ${row.cert}: ${row.note}`);
    }
  }
  parts.push(section('External drift (vendor guides)', externalLines));
  const skippedLines = skipped.map((row) => `- ${row.cert}: ${row.note}`);
  if (skippedLines.length > 0) parts.push(section('Skipped (no fetchable guide — human pass)', skippedLines));
  const errors = (internal.issues ?? []).filter((issue) => issue.severity === 'error');
  const warnings = (internal.issues ?? []).filter((issue) => issue.severity === 'warning');
  const internalLines = [
    ...errors.map((issue) => `- ❌ [${issue.code}] ${issue.cert}: ${issue.message}`),
    ...warnings.map((issue) => `- [${issue.code}] ${issue.cert}: ${issue.message}`),
  ];
  parts.push(section('Internal drift (check-bundles)', internalLines));
  parts.push(section('Suggested actions', ['- [ ] Triage each 🆕/⚠️/🔁 item against the linked guide, then author, retag, or drop questions per docs/certifications/adding-a-certification.md.']));
  return parts.join('\n');
}

function parseArgs(argv) {
  const flags = { internal: undefined, writeSnapshotDir: undefined, out: undefined, strict: false, noLlm: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--internal') flags.internal = argv[(i += 1)];
    else if (argv[i] === '--write-snapshot') flags.writeSnapshotDir = argv[(i += 1)];
    else if (argv[i] === '--out') flags.out = argv[(i += 1)];
    else if (argv[i] === '--strict') flags.strict = true;
    else if (argv[i] === '--no-llm') flags.noLlm = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return flags;
}

async function main() {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;
  if (!flags.noLlm && !apiKey) {
    console.error('ANTHROPIC_API_KEY is required (or pass --no-llm for a deterministic-only report).');
    process.exitCode = 2;
    return;
  }
  const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
  let internal = { issues: [] };
  if (flags.internal) {
    try {
      const parsed = JSON.parse(readFileSync(flags.internal, 'utf-8'));
      if (!parsed || typeof parsed !== 'object' || (parsed.issues !== undefined && !Array.isArray(parsed.issues))) {
        throw new Error('Internal report must be a JSON object with an "issues" array.');
      }
      internal = { issues: parsed.issues ?? [] };
    } catch (error) {
      internal = { issues: [{ cert: 'internal-report', code: 'INTERNAL_REPORT_UNREADABLE', severity: 'error', message: `Cannot parse internal report: ${error.message}` }] };
    }
  }
  const external = [];
  const skipped = [];
  const snapshots = [];
  for (const cert of Object.keys(sources).sort()) {
    if (cert.startsWith('$')) continue;
    const bundle = summarizeBundleStructure(cert);
    if (bundle.error) {
      skipped.push({ cert, note: bundle.error });
      continue;
    }
    const fetched = await fetchSourcesFor(cert, sources[cert].guide);
    if (fetched.status !== 'ok') {
      skipped.push({ cert, note: `${fetched.note} Bundle topics: ${(bundle.topics ?? []).join(', ') || 'none'}.` });
      continue;
    }
    let verdict = { new_domains: [], removed_domains: [], renamed: [], notes: [] };
    if (!flags.noLlm) {
      try {
        verdict = normalizeVerdict(await callAnthropic(buildPrompt(cert, fetched.url, fetched.text, bundle.text), model, apiKey));
      } catch (error) {
        skipped.push({ cert, note: `LLM review failed (${error.message}); guide fetched OK — retry or review manually.` });
        continue;
      }
    }
    external.push({ cert, status: 'changed', source: fetched.url, verdict });
    snapshots.push({ cert, guideUrl: fetched.url, verdict, bundleTopics: bundle.topics ?? [] });
  }
  if (flags.writeSnapshotDir) {
    mkdirSync(flags.writeSnapshotDir, { recursive: true });
    writeFileSync(join(flags.writeSnapshotDir, 'llm-review.json'), `${JSON.stringify({ date: new Date().toISOString(), snapshots }, undefined, 2)}\n`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const report = buildReport(date, external, skipped, internal);
  if (flags.out) writeFileSync(flags.out, `${report}\n`);
  else console.log(report);
  const findingCount =
    external.filter((row) => row.verdict.new_domains.length + row.verdict.removed_domains.length + row.verdict.renamed.length > 0).length +
    (internal.issues ?? []).filter((issue) => issue.severity === 'error').length;
  process.exitCode = flags.strict && (findingCount > 0 || skipped.length > 0) ? 1 : 0;
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
});
