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
  try {
    const parsed = JSON.parse(readFileSync(join(dir, SNAPSHOT_FILE), 'utf-8'));
    const snapshots = Array.isArray(parsed?.snapshots) ? parsed.snapshots : [];
    const usable = snapshots.filter((snapshot) => snapshot && typeof snapshot.cert === 'string' && snapshot.reviewStatus !== REVIEW_STATUS.notReviewed && snapshot.verdict && typeof snapshot.verdict === 'object');
    return new Map(usable.map((snapshot) => [snapshot.cert, snapshot]));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Ignoring unreadable LLM baseline in ${dir}: ${error.message}`);
    return new Map();
  }
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
