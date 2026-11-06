import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SNAPSHOT_FILE = 'llm-review.json';

export const REVIEW_STATUS = { completed: 'completed', notReviewed: 'not-reviewed' };

const FINDING_KEYS = {
  new_domains: (entry) => `new:${entry.name}`,
  removed_domains: (entry) => `removed:${entry.name}`,
  renamed: (entry) => `renamed:${entry.from}>${entry.to}`,
};

const asEntries = (value) => (Array.isArray(value) ? value.filter((entry) => entry && typeof entry === 'object') : []);

export function loadBaseline(dir) {
  const file = join(dir, SNAPSHOT_FILE);
  let raw;
  try {
    raw = readFileSync(file, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw new Error(`Invalid LLM baseline ${file}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid LLM baseline ${file}: ${error.message}`);
  }
  if (!Array.isArray(parsed?.snapshots)) throw new Error(`Invalid LLM baseline ${file}: "snapshots" must be an array.`);
  const usable = parsed.snapshots.filter((snapshot) => snapshot && typeof snapshot.cert === 'string' && snapshot.reviewStatus !== REVIEW_STATUS.notReviewed && snapshot.verdict && typeof snapshot.verdict === 'object');
  return new Map(usable.map((snapshot) => [snapshot.cert, snapshot]));
}

export function priorVerdict(baseline, cert, guideUrl) {
  const snapshot = baseline.get(cert);
  return snapshot && snapshot.guideUrl === guideUrl ? snapshot.verdict : undefined;
}

export function hasFindings(verdict) {
  return Object.keys(FINDING_KEYS).some((field) => asEntries(verdict?.[field]).length > 0);
}

export function classifyFindings(verdict, previous) {
  const known = new Set(Object.entries(FINDING_KEYS).flatMap(([field, keyOf]) => asEntries(previous?.[field]).map(keyOf)));
  const classified = Object.entries(verdict).map(([field, entries]) => {
    const keyOf = FINDING_KEYS[field];
    return [field, keyOf ? entries.map((entry) => ({ ...entry, alreadyReported: known.has(keyOf(entry)) })) : entries];
  });
  return Object.fromEntries(classified);
}

export function mergeSnapshots(baseline, fresh, certs) {
  return certs.flatMap((cert) => fresh.get(cert) ?? baseline.get(cert) ?? []);
}
