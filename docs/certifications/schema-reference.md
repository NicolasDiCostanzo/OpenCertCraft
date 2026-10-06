# Data Model

This document specifies the two data structures the app works with: the **cert bundle** (a certification's questions and metadata) and **user progress** (per-question stats).

---

## Cert bundle

One JSON file per certification, named `<CODE> questions.json` (e.g. `DVA-C02 questions.json`). The app auto-discovers all files matching `/src/assets/* questions.json` at build time, and each cert must also have an entry in `src/assets/cert-manifest.json` (file name, exam metadata, question count) — the manifest drives the cert selector while the bundle itself loads lazily on first navigation. This is the only way a bundle enters the app. There is no runtime upload or client-side storage of bundles; a certification that isn't built in yet is requested via a GitHub issue and shipped as a new file here (see `adding-a-certification.md` for the maintainer-side conversion spec).

### Top-level shape

```jsonc
{
  "version": 2,                        // schema version, integer
  "exam": { },                         // ExamInfo (required)
  "themes": { },                       // taxonomy registry (required)
  "questions": [ ]                     // Question[] (required, non-empty)
}
```

### `exam` — ExamInfo

Metadata about the certification itself. Displayed on the home screen and used for exam-ratio sampling and scoring.

```jsonc
{
  "exam": {
    "name": "AWS Certified Developer - Associate",
    "code": "DVA-C02",
    "totalQuestions": 65,
    "timeLimitMinutes": 130,
    "passingScore": {
      "passingScore": 720,
      "scale": 1000
    },
    "weights": {
      "Development with AWS Services": 32,
      "Deployment": 24,
      "Security": 26,
      "Troubleshooting and Optimization": 18
    },
    "instructions": "You have 130 minutes to complete 65 questions..."
  }
}
```

**Field rules:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✅ | Full display name. |
| `code` | string | ✅ | Short unique code (`DVA-C02`, `SAA-C03`, `CKAD`). Used as the progress-storage key and file-name prefix. |
| `totalQuestions` | number | ✅ | Question count on the **real** exam (not the bank size). Exam mode always draws exactly this many questions, so the bank must hold at least this many answerable questions (`certManifest.test.ts`). Also the default question count in preparation mode. |
| `timeLimitMinutes` | number | ✅ | Real exam duration. Exam mode's fixed countdown, and the default length of the optional timer in preparation mode. |
| `passingScore.passingScore` | number | ✅ | Score needed to pass. A raw percentage (0–100) when `scale` is absent; a scaled score (e.g. out of 1000) when `scale` is present. |
| `passingScore.scale` | number | optional | Max scale (e.g. `1000` for AWS scaled scores). Omit for percentage-based certs — `passingScore` is then itself the pass percentage. The pass percentage is always computed as `passingScore / scale`. |
| `weights` | `Record<string, number>` | optional | Keys **must** be topic names used on questions; values are percentages summing to 100. When the cert publishes its domains but no percentages, split 100 equally across the official domain names (two decimals, e.g. `7.69` for 13 domains; the validator tolerates a total within 0.5 of 100). Omit only if no domain list is published; the app then samples uniformly. A weighted topic that no question uses yet is ignored by sampling and the remaining weights are renormalized. |
| `instructions` | string | optional | Free-text instructions shown on the home screen. |

### Session scoring

How a quiz session's raw `timesCorrect` / `totalAnswered` maps onto `exam.passingScore`:

1. Compute `percentCorrect = timesCorrect / totalAnswered * 100`.
2. **Pass/fail** is always decided from `percentCorrect` against the pass threshold expressed as a percentage: `passingScore / scale * 100` when `scale` is present, or `passingScore` itself when `scale` is absent (percentage-based certs).
3. When `passingScore.scale` is present, additionally display a **projected scaled score**: `round(percentCorrect / 100 * passingScore.scale)` (e.g. 75% correct on DVA-C02 → a displayed "750 / 1000"). This is a **linear projection**, not a reproduction of the certification's real scoring.
4. Whenever a projected scaled score is shown, the UI must attach a visible disclaimer next to it, e.g.:

   > \* This is a linear projection of your percentage correct onto {examName}'s scale, shown for reference only. Real certification exams score with an undisclosed, difficulty-weighted algorithm (often item-response theory) that varies per certification and cannot be reproduced here — this number has no guaranteed relationship to the score {examName} would actually give you.

5. **Unanswered questions always count as incorrect** — `totalAnswered` is always the session's full question count, regardless of mode.

No such disclaimer is needed for percentage-based certs (no `scale`), since there `percentCorrect` already **is** the number the cert defines.

### `themes` — taxonomy registry

A dictionary mapping **theme groups** to their possible **values**. Each key is also the key used inside a question's nested `themes` object (`"services"`, `"concepts"`, `"questionTypes"` in the built-in bank — see `questions[]` below); the key becomes the filter-group label in the UI and its values become the filter options.

```jsonc
{
  "themes": {
    "services":      ["dynamodb", "lambda", "s3"],
    "concepts":      ["encryption", "caching"],
    "questionTypes": ["troubleshooting", "most-secure"]
  }
}
```

- Keys are free-form strings — they are **not** hardcoded. A networking cert might use `"protocols"`, `"osiLayers"`, `"devices"`. A PMP cert might use `"processGroups"`, `"knowledgeAreas"`. Use lowerCamelCase so the key reads naturally as a question field name.
- The app renders one filter group per key, using the key as the label.
- Every value referenced by a question **should** exist in this registry. The validator warns if a question references an unknown value (it does not hard-fail — new values discovered while authoring are allowed, but the registry should be updated in the same pass).


### `questions[]` — Question

```jsonc
{
  "id": "1",
  "question": "A company is implementing ...",
  "options": ["...", "...", "...", "..."],
  "answers": "C",
  "topic": "Security",
  "url": "https://www.examtopics.com/...",
  "promptImages": ["https://...", "data:image/..."],
  "explanation": "Why C is correct and the other options are wrong.",
  "themes": {
  "services": ["ssm", "secrets-manager", "kms"],
  "concepts": ["encryption", "secrets-management"],
  "questionTypes": ["architecture-decision", "multi-step-scenario"]
  }
}
```

**Field rules:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | Unique within the file. Stable across re-generations. |
| `question` | string | ✅ | Full prompt. Unicode preserved. |
| `options` | string[] | ✅ | At least 2 entries. No `A. ` prefixes — the app renders letters. Inline images inside an option are markdown (`![...](...)`). |
| `answers` | string \| string[] | ✅ | Single letter (`"C"`) for single-select; array (`["B","D"]`) for multi-select. Every letter must be within the `options` range. |
| `topic` | string | ✅ | **Exactly one** topic name — see the rule below. Never an array, and never several topics joined by commas or slashes. If `exam.weights` exists, must be exactly one of its keys. |
| `explanation` | string | optional | Rationale for the correct answer. Shown as immediate feedback in preparation mode and on the end-of-quiz review screen in both modes. |
| `url` | string | optional | Source/discussion link. Omit the field entirely if unavailable (never `null` or `""`). |
| `promptImages` | string[] | optional | Images referenced **by the question prompt** (diagrams, screenshots). URLs or data URIs. Per-option images do **not** go here — they are inline markdown in `options`. |
| `themes` | object | optional | Nested object keyed by this cert's theme-group names (the keys of the top-level `themes` registry above — `services`/`concepts`/`questionTypes` for DVA-C02, something else for another cert). Each value is an array of strings drawn from that group's registry. Omit a sub-array entirely when it doesn't apply to this question (never `[]`); omit the whole `themes` object when the question has no tags at all. Unknown values are a validator warning, not an error (see below). |

#### The `id` rule — continue the bundle's own sequence

`id` is a string that must be unique within the file and stable for the life of
that question: it is the key that `userProgress` stores per-question stats
against, so a question whose id changes silently loses its whole history.

**Number from the bundle, not from the source dump.** When you append questions
to an existing bundle, continue its numbering:

- Find the highest existing id and start after it.
- If the bundle's ids are plain integers (`"1"` … `"80"`), the next ids are
  `"81"`, `"82"`, … — even when the source dump numbers its questions `"1.1"`,
  `"2.1"`, or by topic.
- Only preserve a source's own numbering when it is already a clean sequence
  with no collisions.

Don't renumber existing questions when adding to a bundle. Leave gaps where
questions were deleted rather than closing them up, so every id a user may
already have stored progress against keeps pointing at the same question.

The source's numbering is still useful for your own bookkeeping while
converting — it is how you map a dumped question back to its discussion thread
— but it does not become the id.

#### The `topic` rule — exactly one, always

`topic` is a **single string holding exactly one topic name**, and it is
mandatory on every question. There is no "no topic" case and no "multiple
topics" case:

- **Exactly one.** Not an array, not `"Security, Deployment"`, not
  `"Security/Deployment"`. If a question genuinely spans two domains, pick the
  one it primarily tests and say so in `explanation`.
- **Never omitted or blank.** A missing or empty `topic` is a validation error,
  and it breaks exam-ratio sampling, which has nothing to count.
- **Must be an exact key of `exam.weights`** when that field is present. The
  comparison is exact string equality, so `"Billing, Pricing, and Support"`
  matches only that key — a comma inside a topic *name* is fine, commas
  separating *topics* are not.

> A topic name may legitimately contain punctuation, which is why you will see
> values like `Billing, Pricing, and Support` and `Governance, Safety & Risk
> Management`. Those are single topic names copied verbatim from
> `exam.weights`, not a list of topics.

The validator enforces the exact-key rule as a **hard error**, not a warning, so
a mistyped or multi-valued topic fails the build rather than silently skewing
sampling:

```
questions[0] (id 1).topic "Evaluation, Testing & Optimization, Integration" is not one of exam.weights' keys.
```

When `exam.weights` is absent (a cert that publishes no domain list at all), any
non-empty topic string is accepted and the app samples the bank uniformly.


### DVA-C02 canonical themes (reference)

The built-in DVA-C02 bank defines three registry groups (`services` / `concepts` / `questionTypes`), mirrored under a nested `themes` object on every question (e.g. `question.themes.services`):

- **Topics** (4): `Development with AWS Services`, `Deployment`, `Security`, `Troubleshooting and Optimization`
- **Services** (33): `acm`, `amplify`, `api-gateway`, `cloudformation`, `cloudfront`, `cloudwatch`, `codebuild`, `codecommit`, `codedeploy`, `codepipeline`, `cognito`, `container`, `dynamodb`, `ec2`, `efs-ebs`, `elastic-beanstalk`, `elasticache`, `eventbridge`, `iam`, `kinesis`, `kms`, `lambda`, `rds-aurora`, `route53`, `s3`, `sam`, `secrets-manager`, `sns`, `sqs`, `ssm`, `step-functions`, `vpc`, `x-ray`
- **Concepts** (25): `api-design`, `authentication`, `authorization`, `caching`, `cicd-pipeline`, `cost-optimization`, `cross-account`, `data-modeling`, `deployment-strategies`, `disaster-recovery`, `encryption`, `event-driven`, `high-availability`, `iac`, `idempotency-retry`, `least-privilege`, `lifecycle-management`, `logging`, `microservices`, `observability`, `secrets-management`, `serverless`, `testing`, `throttling-concurrency`, `versioning-rollback`
- **Question Types** (8): `architecture-decision`, `configuration`, `how-to-deploy`, `most-cost-effective`, `most-performant`, `most-secure`, `multi-step-scenario`, `troubleshooting`

### Exam weights — DVA-C02 (AWS-official)

| Topic | Weight |
|---|---|
| Development with AWS Services | 32% |
| Deployment | 24% |
| Security | 26% |
| Troubleshooting and Optimization | 18% |

---

## User progress

Progress is **not** part of the cert bundle. It is per-browser, per-user state stored in localStorage via the Pinia `userProgress` store.

### Shape

```ts
interface QuestionProgress {
  questionId: string            // matches Question.id
  attempts: number              // total times answered
  timesCorrect: number
  timesWrong: number
  flagged: boolean              // user-marked for review
  lastSeenAt: number            // epoch ms
}

interface UserProgress {
  byExamCode: Record<string, Record<string, QuestionProgress>>
  //            exam code      question id
}
```

### Replay-mode queries

The store exposes helpers used by the quiz launcher:

| Mode | Predicate |
|---|---|
| Only wrong | `timesWrong > timesCorrect` |
| Only flagged | `flagged === true` |
| Only unattempted | no entry for that question id, or `attempts === 0` |
| All / custom | no predicate (combined with theme filters) |

### Export / import

Because localStorage is wiped when the user clears browser data, the store supports:

- **Export** — downloads a versioned JSON file: `{ "format": "quiz-progress", "version": 1, "exportedAt": "<iso>", "byExamCode": { } }`
- **Import** — reads such a file and merges it into the current state (per-question, newest `lastSeenAt` wins).

Note: this export's `version` is unrelated to the cert bundle's top-level `version` (currently `2`, see above) — they version two independent formats and change on their own schedules.

### Storage limits

| Store | Limit | Usage |
|---|---|---|
| localStorage (progress) | ~5 MB | Progress is tiny (a few bytes per question); safe even with thousands of questions. |

