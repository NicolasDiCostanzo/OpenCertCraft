import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS_DIR = join(ROOT, 'src', 'assets');
const MANIFEST_PATH = join(ASSETS_DIR, 'cert-manifest.json');
const FAMILIES_PATH = join(ASSETS_DIR, 'certFamilies.ts');

const SUPPORTED_VERSION = 2;
const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isQuestionAnswerable(question) {
  return question.options.some((option) => option.trim().length > 0);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function loadFamilies() {
  const source = readFileSync(FAMILIES_PATH, 'utf-8');
  const byCode = {};
  const familyRe = /\{\s*id:\s*'([^']+)'[^}]*?codes:\s*\[([^\]]*)\]/g;
  let match = familyRe.exec(source);
  while (match !== null) {
    const codes = [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const code of codes) byCode[code] = match[1];
    match = familyRe.exec(source);
  }
  return byCode;
}

function loadBundles(issues) {
  const files = readdirSync(ASSETS_DIR).filter((name) => name.endsWith('questions.json')).sort();
  return files.map((file) => {
    try {
      return { file, json: JSON.parse(readFileSync(join(ASSETS_DIR, file), 'utf-8')) };
    } catch (error) {
      issues.push({ cert: file, file, code: 'BUNDLE_UNREADABLE', severity: 'error', message: `Cannot parse ${file}: ${error.message}` });
      return { file, json: undefined };
    }
  });
}

function checkExam(exam, cert, issues) {
  if (!isPlainObject(exam)) {
    issues.push({ cert, code: 'EXAM_MISSING', severity: 'error', message: '"exam" is required and must be an object.' });
    return undefined;
  }
  let broken = false;
  const fail = (code, message) => {
    issues.push({ cert, code, severity: 'error', message });
    broken = true;
  };
  if (typeof exam.name !== 'string' || exam.name.length === 0) fail('EXAM_NAME', 'exam.name must be a non-empty string.');
  if (typeof exam.code !== 'string' || exam.code.length === 0) fail('EXAM_CODE', 'exam.code must be a non-empty string.');
  if (typeof exam.totalQuestions !== 'number' || !Number.isFinite(exam.totalQuestions) || exam.totalQuestions < 1) {
    fail('EXAM_TOTAL', 'exam.totalQuestions must be a positive number.');
  }
  if (typeof exam.timeLimitMinutes !== 'number' || !Number.isFinite(exam.timeLimitMinutes) || exam.timeLimitMinutes < 0) {
    fail('EXAM_TIME_LIMIT', 'exam.timeLimitMinutes must be a non-negative number.');
  }
  const passingScore = exam.passingScore;
  if (!isPlainObject(passingScore) || typeof passingScore.passingScore !== 'number' || !Number.isFinite(passingScore.passingScore)) {
    fail('EXAM_PASSING_SCORE', 'exam.passingScore.passingScore must be a finite number.');
  } else if (passingScore.scale !== undefined) {
    if (typeof passingScore.scale !== 'number' || !Number.isFinite(passingScore.scale) || passingScore.scale <= 0) {
      fail('EXAM_SCALE', 'exam.passingScore.scale must be a positive finite number when present.');
    } else if (passingScore.passingScore < 0 || passingScore.passingScore > passingScore.scale) {
      fail('EXAM_PASSING_RANGE', `exam.passingScore.passingScore must be between 0 and ${passingScore.scale} (the scale).`);
    }
  } else if (passingScore.passingScore < 0 || passingScore.passingScore > 100) {
    fail('EXAM_PASSING_RANGE', 'exam.passingScore.passingScore must be between 0 and 100 when scale is absent.');
  }
  if (exam.weights !== undefined) {
    const weights = exam.weights;
    const bad = !isPlainObject(weights) || !Object.values(weights).every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
    if (bad) {
      fail('EXAM_WEIGHTS', 'exam.weights must map topic names to non-negative finite numbers.');
    } else {
      const sum = Object.values(weights).reduce((total, v) => total + v, 0);
      if (Math.abs(sum - 100) > 0.5) {
        issues.push({ cert, code: 'EXAM_WEIGHTS_SUM', severity: 'warning', message: `exam.weights values sum to ${sum}, expected 100 — exam-mode sampling is skewed.` });
      }
    }
  }
  return broken ? undefined : exam;
}

function checkQuestions(questions, exam, themes, cert, issues) {
  if (!Array.isArray(questions)) {
    issues.push({ cert, code: 'QUESTIONS_MISSING', severity: 'error', message: '"questions" must be an array.' });
    return [];
  }
  if (questions.length === 0) {
    issues.push({ cert, code: 'QUESTIONS_EMPTY', severity: 'error', message: '"questions" must not be empty.' });
    return [];
  }
  const valid = [];
  const seenIds = new Set();
  const unanswerable = [];
  const untagged = [];
  questions.forEach((raw, index) => {
    const prefix = `questions[${index}]`;
    if (!isPlainObject(raw)) {
      issues.push({ cert, code: 'QUESTION_SHAPE', severity: 'error', message: `${prefix} must be an object.` });
      return;
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
      issues.push({ cert, code: 'QUESTION_ID', severity: 'error', message: `${prefix}.id must be a non-empty string.` });
      return;
    }
    if (seenIds.has(raw.id)) {
      issues.push({ cert, code: 'QUESTION_ID_DUP', severity: 'error', message: `${prefix}.id "${raw.id}" is duplicated.` });
      return;
    }
    seenIds.add(raw.id);
    const label = `${prefix} (id ${raw.id})`;
    let broken = false;
    const fail = (code, message) => {
      issues.push({ cert, code, severity: 'error', message: `${label}.${message}` });
      broken = true;
    };
    if (typeof raw.question !== 'string' || raw.question.length === 0) fail('QUESTION_TEXT', 'question must be a non-empty string.');
    if (!isStringArray(raw.options) || raw.options.length < 2) {
      fail('QUESTION_OPTIONS', `options must have at least 2 string entries (has ${Array.isArray(raw.options) ? raw.options.length : 'n/a'}).`);
    }
    const optionCount = Array.isArray(raw.options) ? raw.options.length : 0;
    const validLetters = OPTION_LETTERS.slice(0, optionCount);
    const answers = raw.answers;
    if (typeof answers === 'string') {
      if (!validLetters.includes(answers)) {
        fail('QUESTION_ANSWER_RANGE', `answers "${answers}" is out of range for ${optionCount} option(s) — a changed option list can silently invalidate this answer.`);
      }
    } else if (Array.isArray(answers)) {
      if (!isStringArray(answers) || answers.length === 0) {
        fail('QUESTION_ANSWERS', 'answers must be a letter string or a non-empty array of letters.');
      } else if (new Set(answers).size !== answers.length) {
        fail('QUESTION_ANSWERS_DUP', 'answers contains duplicate letters.');
      } else {
        const outOfRange = answers.filter((letter) => !validLetters.includes(letter));
        if (outOfRange.length > 0) {
          fail('QUESTION_ANSWER_RANGE', `answers contains out-of-range letter(s): ${outOfRange.join(', ')} — a changed option list can silently invalidate this answer.`);
        }
      }
    } else {
      fail('QUESTION_ANSWERS', 'answers must be a letter string or an array of letters.');
    }
    if (typeof raw.topic !== 'string' || raw.topic.length === 0) {
      fail('QUESTION_TOPIC', 'topic must be a non-empty string.');
    } else if (exam?.weights && !Object.hasOwn(exam.weights, raw.topic)) {
      fail('QUESTION_TOPIC_UNKNOWN', `topic "${raw.topic}" is not one of exam.weights' keys.`);
    }
    if (raw.url !== undefined && (typeof raw.url !== 'string' || raw.url === '')) {
      fail('QUESTION_URL', 'url must be a non-empty string when present.');
    }
    if (raw.explanation !== undefined && typeof raw.explanation !== 'string') {
      fail('QUESTION_EXPLANATION', 'explanation must be a string when present.');
    }
    if (raw.promptImages !== undefined && !isStringArray(raw.promptImages)) {
      fail('QUESTION_IMAGES', 'promptImages must be an array of strings when present.');
    }
    if (raw.themes !== undefined) {
      if (!isPlainObject(raw.themes)) {
        fail('QUESTION_THEMES', 'themes must be an object when present.');
      } else if (Object.keys(raw.themes).length === 0) {
        fail('QUESTION_THEMES_EMPTY', 'themes must contain at least one theme group when present.');
      } else {
        for (const [group, values] of Object.entries(raw.themes)) {
          if (!isStringArray(values) || values.length === 0) {
            fail('QUESTION_THEMES_GROUP', `themes.${group} must be a non-empty array of strings.`);
            continue;
          }
          if (!themes || !Object.hasOwn(themes, group)) {
            issues.push({ cert, code: 'THEME_GROUP_UNDECLARED', severity: 'warning', message: `${label} uses theme group "${group}", which isn't declared in the top-level "themes" registry.` });
            continue;
          }
          for (const tag of values) {
            if (!themes[group].includes(tag)) {
              issues.push({ cert, code: 'THEME_VALUE_UNDECLARED', severity: 'warning', message: `${label}.themes.${group} references value "${tag}", which isn't declared in themes.${group}.` });
            }
          }
        }
      }
    } else {
      // deferred: only count untagged questions that remain in the valid pool
    }
    if (broken) return;
    valid.push({ ...raw, themes: raw.themes ?? {} });
    if (!isQuestionAnswerable(raw)) unanswerable.push(raw.id);
    if (raw.themes === undefined) untagged.push(raw.id);
  });
  if (unanswerable.length > 0) {
    issues.push({ cert, code: 'QUESTIONS_UNANSWERABLE', severity: 'warning', message: `${unanswerable.length} question(s) have no non-empty options and are excluded from quizzes: ${unanswerable.slice(0, 10).join(', ')}${unanswerable.length > 10 ? ` (+${unanswerable.length - 10} more)` : ''}.` });
  }
  if (untagged.length > 0) {
    issues.push({ cert, code: 'QUESTIONS_UNTAGGED', severity: 'warning', message: `${untagged.length} question(s) have no themes and can never match a theme filter: ${untagged.slice(0, 10).join(', ')}${untagged.length > 10 ? ` (+${untagged.length - 10} more)` : ''}.` });
  }
  return valid;
}

function analyzeCoverage(cert, exam, themes, questions, issues, summary) {
  const answerable = questions.filter(isQuestionAnswerable);
  summary.push({ cert, total: questions.length, answerable: answerable.length, needed: exam?.totalQuestions });
  if (exam && answerable.length < exam.totalQuestions) {
    issues.push({ cert, code: 'POOL_TOO_SMALL', severity: 'error', message: `Only ${answerable.length} answerable question(s) but the real exam has ${exam.totalQuestions}: exam mode cannot build a full exam.` });
  }
  const poolByTopic = new Map();
  for (const question of answerable) {
    if (!poolByTopic.has(question.topic)) poolByTopic.set(question.topic, 0);
    poolByTopic.set(question.topic, poolByTopic.get(question.topic) + 1);
  }
  for (const topic of Object.keys(exam?.weights ?? {})) {
    const count = poolByTopic.get(topic) ?? 0;
    if (count === 0) {
      issues.push({ cert, code: 'TOPIC_EMPTY', severity: 'warning', message: `Topic "${topic}" has zero answerable questions — users filtering on it get an empty quiz and exam mode can never sample it.` });
    } else if (count < 5) {
      issues.push({ cert, code: 'TOPIC_THIN', severity: 'warning', message: `Topic "${topic}" has only ${count} answerable question(s) — thin coverage, likely missing sub-topics.` });
    }
  }
  const used = new Set();
  for (const question of questions) {
    for (const [group, values] of Object.entries(question.themes ?? {})) {
      for (const value of values) used.add(`${group}/${value}`);
    }
  }
  const orphans = Object.entries(themes ?? {}).flatMap(([group, values]) =>
    (Array.isArray(values) ? values : []).filter((value) => !used.has(`${group}/${value}`)).map((value) => `${group}.${value}`),
  );
  if (orphans.length > 0) {
    issues.push({ cert, code: 'THEME_VALUE_ORPHAN', severity: 'warning', message: `Declared but unused theme value(s): ${orphans.join(', ')} — a copied registry entry or untagged questions.` });
  }
}

function checkManifest(manifest, files, issues) {
  if (!Array.isArray(manifest)) {
    issues.push({ cert: 'manifest', code: 'MANIFEST_SHAPE', severity: 'error', message: 'cert-manifest.json must be an array.' });
    return [];
  }
  const entries = manifest.filter(isPlainObject);
  if (entries.length !== manifest.length) {
    issues.push({ cert: 'manifest', code: 'MANIFEST_ENTRY_SHAPE', severity: 'error', message: 'cert-manifest.json entries must be objects.' });
  }
  const manifestFiles = entries.map((entry) => entry.file).sort();
  if (manifestFiles.join(',') !== files.join(',')) {
    issues.push({ cert: 'manifest', code: 'MANIFEST_FILES', severity: 'error', message: `Manifest lists [${manifestFiles.join(', ')}] but bundle files are [${files.join(', ')}].` });
  }
  return entries;
}

function checkFamilyTaxonomy(bundles, familyByCode, issues) {
  const shapes = new Map();
  for (const { cert, themes } of bundles) {
    const family = familyByCode[cert];
    if (!family) {
      issues.push({ cert, code: 'FAMILY_UNKNOWN', severity: 'warning', message: `Cert ${cert} is not in CERT_FAMILY, so its taxonomy is unchecked.` });
      continue;
    }
    const shape = Object.keys(themes ?? {}).sort().join(', ');
    if (!shapes.has(family)) shapes.set(family, new Map());
    shapes.get(family).set(shape, [...(shapes.get(family).get(shape) ?? []), cert]);
  }
  for (const [family, byShape] of shapes) {
    if (byShape.size > 1) {
      const detail = [...byShape.entries()].map(([shape, codes]) => `${codes.join('+')}=[${shape}]`).join(' vs ');
      issues.push({ cert: family, code: 'FAMILY_TAXONOMY_DRIFT', severity: 'warning', message: `Certs in one family name theme groups differently: ${detail}. A filter means different things per cert.` });
    }
  }
}


function summarizeBundle(cert, exam, themes, questions) {
  const answerable = questions.filter(isQuestionAnswerable);
  return {
    cert,
    version: 1,
    questionCount: questions.length,
    answerableCount: answerable.length,
    questionIds: [...new Set(questions.map((q) => q.id))].sort(),
    topics: [...new Set(answerable.map((q) => q.topic))].sort(),
    examMeta: exam ? { name: exam.name, totalQuestions: exam.totalQuestions, timeLimitMinutes: exam.timeLimitMinutes, passingScore: exam.passingScore, weights: exam.weights ?? {} } : undefined,
    themes: Object.fromEntries(Object.entries(themes ?? {}).map(([group, values]) => [group, [...values].sort()])),
  };
}

function writeSnapshots(summaries, dir) {
  mkdirSync(dir, { recursive: true });
  for (const summary of summaries) {
    writeFileSync(join(dir, `${summary.cert}.json`), `${JSON.stringify(summary, undefined, 2)}\n`);
  }
}

function loadSnapshots(dir) {
  const previous = new Map();
  if (!existsSync(dir)) return previous;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const snapshot = JSON.parse(readFileSync(join(dir, name), 'utf-8'));
      previous.set(snapshot.cert, snapshot);
    } catch {
      continue;
    }
  }
  return previous;
}

function diffSnapshots(summaries, previous, issues) {
  for (const current of summaries) {
    const old = previous.get(current.cert);
    if (!old) {
      issues.push({ cert: current.cert, code: 'DRIFT_NEW_CERT', severity: 'warning', message: `Cert ${current.cert} has no prior snapshot — review it fully against the vendor exam guide.` });
      continue;
    }
    const addedTopics = current.topics.filter((topic) => !old.topics.includes(topic));
    const removedTopics = old.topics.filter((topic) => !current.topics.includes(topic));
    if (addedTopics.length > 0) {
      issues.push({ cert: current.cert, code: 'DRIFT_TOPICS_ADDED', severity: 'warning', message: `New topic(s) since last snapshot: ${addedTopics.join(', ')}.` });
    }
    if (removedTopics.length > 0) {
      issues.push({ cert: current.cert, code: 'DRIFT_TOPICS_REMOVED', severity: 'warning', message: `Topic(s) gone since last snapshot: ${removedTopics.join(', ')} — renamed, or coverage dropped.` });
    }
    for (const group of new Set([...Object.keys(old.themes), ...Object.keys(current.themes)])) {
      const before = old.themes[group] ?? [];
      const after = current.themes[group] ?? [];
      const added = after.filter((value) => !before.includes(value));
      const removed = before.filter((value) => !after.includes(value));
      if (added.length > 0 || removed.length > 0) {
        issues.push({ cert: current.cert, code: 'DRIFT_THEMES', severity: 'warning', message: `Theme group "${group}" changed (added: ${added.join(', ') || 'none'}; removed: ${removed.join(', ') || 'none'}).` });
      }
    }
    const oldIds = new Set(old.questionIds);
    const newIds = new Set(current.questionIds);
    const added = current.questionIds.filter((id) => !oldIds.has(id)).length;
    const removed = old.questionIds.filter((id) => !newIds.has(id)).length;
    if (added > 0 || removed > 0) {
      issues.push({ cert: current.cert, code: 'DRIFT_QUESTIONS', severity: 'warning', message: `Question pool changed: +${added}/-${removed} (now ${current.questionCount}).` });
    }
    if (stable(old.examMeta) !== stable(current.examMeta)) {
      issues.push({ cert: current.cert, code: 'DRIFT_EXAM_META', severity: 'warning', message: 'Exam metadata (passing score, time limit, weights) changed since last snapshot — verify against the vendor exam guide.' });
    }
  }
  for (const cert of previous.keys()) {
    if (!summaries.some((summary) => summary.cert === cert)) {
      issues.push({ cert, code: 'DRIFT_CERT_REMOVED', severity: 'warning', message: `Cert ${cert} was snapshotted but no longer exists.` });
    }
  }
}


function parseArgs(argv) {
  const flags = { json: false, strict: false, snapshotDir: undefined, diffDir: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') flags.json = true;
    else if (argv[i] === '--strict') flags.strict = true;
    else if (argv[i] === '--snapshot') flags.snapshotDir = argv[(i += 1)];
    else if (argv[i] === '--diff') flags.diffDir = argv[(i += 1)];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!flags.snapshotDir && !flags.diffDir) {
    throw new Error('Usage: node scripts/check-bundles.mjs [--json] [--strict] [--snapshot <dir>] [--diff <dir>]');
  }
  return flags;
}

function reportText(issues, summary) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const lines = ['# cert-bundle weekly check', ''];
  lines.push('## pool summary');
  for (const row of summary) lines.push(`- ${row.cert}: ${row.answerable}/${row.total} answerable (exam needs ${row.needed ?? 'n/a'})`);
  lines.push('');
  for (const severity of ['error', 'warning']) {
    const group = severity === 'error' ? errors : warnings;
    lines.push(`## ${severity}s (${group.length})`);
    for (const issue of group) lines.push(`- [${issue.code}] ${issue.cert}: ${issue.message}`);
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const issues = [];
  const bundleFiles = loadBundles(issues);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch (error) {
    issues.push({ cert: 'manifest', code: 'MANIFEST_UNREADABLE', severity: 'error', message: `Cannot parse cert-manifest.json: ${error.message}` });
    manifest = [];
  }
  const validManifest = checkManifest(manifest, bundleFiles.map(({ file }) => file).sort(), issues);
  const manifestByFile = new Map(validManifest.map((entry) => [entry.file, entry]));
  const perBundle = [];
  const summaries = [];
  const poolSummary = [];
  for (const { file, json } of bundleFiles) {
    if (json === undefined) continue;
    const cert = json.exam?.code ?? file;
    if (json.version !== SUPPORTED_VERSION) {
      issues.push({ cert, file, code: 'SCHEMA_VERSION', severity: 'error', message: `Unsupported schema version "${String(json.version)}" — expected ${SUPPORTED_VERSION}.` });
    }
    const exam = checkExam(json.exam, cert, issues);
    let themes;
    if (!isPlainObject(json.themes)) {
      issues.push({ cert, file, code: 'THEMES_MISSING', severity: 'error', message: '"themes" is required and must be an object.' });
    } else {
      themes = {};
      for (const [group, values] of Object.entries(json.themes)) {
        if (!isStringArray(values)) {
          issues.push({ cert, file, code: 'THEMES_GROUP', severity: 'error', message: `themes.${group} must be an array of strings.` });
        } else {
          themes[group] = values;
        }
      }
    }
    const questions = checkQuestions(json.questions, exam, themes, cert, issues);
    const entry = manifestByFile.get(file);
    if (!entry) {
      issues.push({ cert, file, code: 'MANIFEST_ENTRY_MISSING', severity: 'error', message: `No manifest entry for ${file}.` });
    } else {
      if (entry.questionCount !== (json.questions ?? []).length) {
        issues.push({ cert, file, code: 'MANIFEST_COUNT', severity: 'error', message: `Manifest says questionCount ${entry.questionCount} but the bundle has ${(json.questions ?? []).length} questions.` });
      }
      if (stable(entry.exam) !== stable(json.exam)) {
        issues.push({ cert, file, code: 'MANIFEST_EXAM', severity: 'error', message: 'Manifest exam metadata does not match the bundle exam metadata.' });
      }
      if (entry.exam?.code !== json.exam?.code) {
        issues.push({ cert, file, code: 'MANIFEST_CODE', severity: 'error', message: `Bundle exam code "${json.exam?.code}" does not match manifest entry "${entry.exam?.code}".` });
      }
    }
    analyzeCoverage(cert, exam, themes, questions, issues, poolSummary);
    perBundle.push({ cert, themes });
    summaries.push(summarizeBundle(cert, exam, themes, questions));
  }
  try {
    checkFamilyTaxonomy(perBundle, loadFamilies(), issues);
  } catch (error) {
    issues.push({ cert: 'families', code: 'FAMILIES_UNREADABLE', severity: 'error', message: `Cannot parse certFamilies.ts: ${error.message}` });
  }
  if (flags.diffDir) diffSnapshots(summaries, loadSnapshots(flags.diffDir), issues);
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  if (flags.snapshotDir) writeSnapshots(summaries, flags.snapshotDir);
  if (flags.json) {
    console.log(JSON.stringify({ errors, warnings, summary: poolSummary, issues }, undefined, 2));
  } else {
    console.log(reportText(issues, poolSummary));
  }
  process.exitCode = errors > 0 || (flags.strict && warnings > 0) ? 1 : 0;
}

main();
