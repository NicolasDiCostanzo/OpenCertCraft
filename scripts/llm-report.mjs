function section(title, lines) {
  return [`## ${title}`, ...(lines.length > 0 ? lines : ['- Nothing to report.']), ''].join('\n');
}

const ALREADY_REPORTED_ICON = '♻️';
const icon = (finding, fresh) => (finding.alreadyReported ? ALREADY_REPORTED_ICON : fresh);
const reported = (finding) => (finding.alreadyReported ? ' Already reported in the previous review, still open.' : '');

export function buildReport(date, external, skipped, internal) {
  const parts = [`# Weekly cert-bundle review — ${date}`, ''];
  const externalLines = [];
  for (const row of external) {
    if (row.status === 'changed' && row.reviewed === false) {
      externalLines.push(`- ⏭️ ${row.cert}: not reviewed (--no-llm), guide not compared with the bundle structure.`);
    } else if (row.status === 'changed') {
      for (const domain of row.verdict.new_domains) {
        externalLines.push(`- ${icon(domain, '🆕')} ${row.cert}: guide now lists "${domain.name}"${domain.quote ? ` — "${domain.quote}"` : ''}. Check whether questions cover it.${reported(domain)}`);
      }
      for (const domain of row.verdict.removed_domains) {
        externalLines.push(`- ${icon(domain, '⚠️')} ${row.cert}: guide no longer lists "${domain.name}"${domain.quote ? ` — "${domain.quote}"` : ''}. Questions on it are stale candidates.${reported(domain)}`);
      }
      for (const rename of row.verdict.renamed) {
        externalLines.push(`- ${icon(rename, '🔁')} ${row.cert}: "${rename.from}" → "${rename.to}" in the guide. Bundle topics/themes may need renaming.${reported(rename)}`);
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
