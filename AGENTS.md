# AGENTS.md — context for AI coding agents

This file gives any LLM / coding agent (Claude Code, Codex, Cursor, Cline, Gemini CLI, Zed, …) the context it needs to work on this repository. Read it before making changes.

## What this project is

**opencertcraft** — a cert-agnostic quiz web app for exam preparation. Fully static (no backend, no accounts), local-first: progress lives in the browser's localStorage.

## Tech stack

- **Vue 3** (Composition API, `<script setup lang="ts">`) + **TypeScript** (strict) + **Vite**
- **Pinia** for state, with `pinia-plugin-persistedstate` for localStorage persistence
- **Vue Router 5** with **HTML5 history** (`createWebHistory`) — clean URLs (`/`, `/cert`, `/certs/:certCode/quiz`). The app is static with no backend, so the host **must** rewrite unknown paths to `index.html`; the project's own CloudFront distribution does this via `CustomErrorResponses` (403/404 → `/index.html`), and Vite's dev/preview servers fall back to `index.html` by default. Self-hosting elsewhere requires an equivalent rewrite rule (e.g. Netlify `_redirects`, `404.html` on GitHub Pages) or deep links will 404.
- **Vitest** (jsdom environment) + `@vue/test-utils` for tests
- **ESLint** (flat config, `eslint-plugin-vue` + `@vue/eslint-config-typescript`)
- **Husky** pre-commit hooks
- **Dark/light mode** — dark by default, with a manual two-state sun/moon switch (`App.vue` header) persisted in the `userPreferences` Pinia store: it sets `data-theme` to `dark`/`light` on `<html>` (via `useThemeMode`), and `src/styles/tokens.css` (the single source of truth for theme tokens, imported by `src/style.css`). New styles must use those custom properties (`--text`, `--text-h`, `--bg`, `--border`, `--accent`, `--accent-bg`, `--shadow`, …) instead of hardcoded colors so both themes keep working. **Brand color:** `--brand-base` (in `:root`) is the *single source of truth for the brand* — rebranding means editing that one line. The brand family is computed from it: `--brand`, `--brand-bg` (via `color-mix()` tints and `--brand-tint`), and `--accent` / `--accent-bg` / `--accent-border` (which alias the brand, so hover/focus/link/ghost-button states read as the same hue as the CTAs); primary buttons (`ui/PrimaryButton.vue`) and the header brand mark/title (`app/AppHeader.vue`) consume them, nothing hardcodes a hex. The dark block re-derives `--brand` from the same `--brand-base` as a lighter, more chromatic step of the same hue. **Only the brand is derived — everything else is a literal on purpose:** the warm neutrals (`--bg`, `--surface`, `--text`, `--text-h`, `--border`, `--code-bg`) keep their fixed cream/tan values so a rebrand never repaints the page, and the semantic `--green` / `--red` stay literal so "correct" never reads as a link. The derivation relies on relative color syntax (Chrome 119+, Safari 16.4+, Firefox 128+); if browser support ever matters more than the single-line rebrand, pin `--brand` / `--brand-bg` to hex. Contrast is only guaranteed for the current brand, since the tints move with it: a rebrand to a very light brand can push links or button text under 4.5:1, so re-check contrast when changing it. User-facing strings live in `src/texts/en.ts`, SVG icons in `src/components/icons/`, never inline in components.

## Commands

```bash
npm install          # install
npm run dev          # dev server
npm run build        # vue-tsc -b && vite build → dist/ (type-checks as part of build)
npm run preview      # serve the production build
npm run typecheck    # vue-tsc -b --noEmit
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch
npm run test:certs   # cert-bundle gate: manifest + theme integrity (fast; run after any bundle edit)
```

CI (`.github/workflows/ci.yml`, Node 22) runs **lint, typecheck, test, build, and `npm audit --omit=dev --audit-level=high`** on every PR — run `npm run lint && npm run typecheck && npm run test` locally before considering work done.

The audit job is scoped to runtime deps with `--omit=dev`. The only high advisory in the tree is `braces` (GHSA-vfj7-8cjw-p6xm), pulled in transitively by `@vue/eslint-config-typescript` → `fast-glob` → `micromatch`. It is used only for build-time glob matching inside the ESLint config, is unreachable from app code, and **has no patched release** (`braces@3.0.3` is the latest and is still within the vulnerable `<=3.0.3` range), so `npm audit fix` can only "resolve" it by downgrading to `@vue/eslint-config-typescript@14.0.1` — a version that breaks `eslint.config.js` and is incompatible with ESLint 10. Remove `--omit=dev` once a patched `braces` ships.

## Project layout

```
index.html                  Vite entry
src/
  main.ts                   App bootstrap: Pinia (+ persistedstate plugin) + router
  App.vue
  types.ts                  ALL shared TypeScript interfaces (cert bundle, progress, quiz config/session) — the schema source of truth in code
  router/index.ts           Hash-history router; route guard redirects unknown :certCode to home
  views/                    Route-level components: CertSelectorView, QuizConfigureView, QuizSessionView, QuizReviewView
  stores/userProgress.ts    Pinia store: per-question progress keyed by exam code; export/import with merge
  stores/userFavorites.ts  Pinia store: favorited exam codes; export/import with merge; synced like progress/history
  composables/useQuizLoader.ts  Lazy per-cert bundle loading (import.meta.glob + cert-manifest.json) + validation
  utils/schemaValidator.ts  Pure cert-bundle validator (+ isQuestionAnswerable); has tests
  utils/markdownImage.ts    Per-option inline image rendering helper
  assets/                   Built-in cert bundles: "<CODE> questions.json" + cert-manifest.json
docs/
  certifications/
    adding-a-certification.md  Step-by-step: convert a raw exam dump into a cert-bundle JSON + its manifest entry
    schema-reference.md        Cert-bundle + user-progress schema spec (every field, scoring rules)
```

## Core architecture rules (don't break these)

1. **Cert bundles enter the app one way only**: a JSON file matching `/src/assets/*questions.json` **plus a matching entry in `src/assets/cert-manifest.json`** (file name, exam metadata, question count), discovered at **build time** via `import.meta.glob` in `useQuizLoader.ts`. The manifest (tiny, statically bundled) drives the cert selector; each cert's question bank is loaded **lazily as its own chunk on first navigation** (the router guard calls `ensureCertLoaded`). The manifest is the *sole* entry point — the glob only resolves files the manifest already names, so a bundle with no manifest entry is silently invisible. There is **no runtime upload and no client-side storage of bundles** — this was a deliberate design decision; don't re-propose it.
2. **Everything exam-specific lives in the JSON bundle** (questions, themes, topics, weights, passing score, time limit). App mechanics are generic. Never hardcode a certification's data (theme group names like `services`/`concepts`/`questionTypes` or `tasks`/`tools`/`questionTypes` are data, not code).
3. **A bundle failing validation is excluded and logged**, never auto-fixed. The validator reports errors; it does not silently patch them — a maintainer fixes the data, not the tool.
4. **Progress is keyed by `exam.code`** (`byExamCode` in the Pinia store), so multiple certs coexist without mixing. Export format is versioned (`format: 'quiz-progress'`, `version: 1`); import merges per-question, newest `lastSeenAt` wins.
5. **Two quiz modes**: `preparation` (immediate feedback, fully configurable: replay mode, question count, topic/theme filters, and an optional timer, off by default, whose length the user picks from 1 to 9999 minutes) and `exam` (deferred feedback, locked to the real exam: `exam.totalQuestions` questions sampled with `exam.weights`, countdown from `exam.timeLimitMinutes`; only the replay mode stays selectable, and only when its pool holds at least `exam.totalQuestions` questions; topic/theme filters, count and timer are not offered). Unanswered questions always count as incorrect in both modes. Scoring rules, including the scaled-score linear-projection disclaimer requirement, are specified in `docs/certifications/schema-reference.md` — follow them exactly when touching scoring/UI.
6. **Questions are always shuffled**; there is no user setting for order.
7. **Deliberate non-features** — the app refuses these on purpose, so revisit this reasoning before proposing any of them: no mandatory accounts, no runtime cert upload, no client-side storage of bundles, no auto-fixing invalid JSON, no force-fitting drag-and-drop/matching questions, no server-side AI formatting.
8. **`npm run test:certs` is the gate for any bundle or manifest edit.** The manifest must match each bundle, and themes must be internally consistent: every tag a question uses is declared, every declared value is used by some question, every question is tagged, every bundle holds at least `exam.totalQuestions` answerable questions (so exam mode can always build a full exam), and certs in the same family use identically-named groups (families are declared explicitly in `CERT_FAMILY` in `src/assets/certThemes.test.ts`, not inferred from data). This matters because `validateCertBundle` treats an unknown theme value as a **warning**, so an undeclared or misnamed tag passes schema validation and only surfaces later as an empty filter result in the UI.
9. **Advisory LLM review on bundle PRs.** `.github/workflows/bundle-consistency.yml` runs only when `src/assets/*questions.json` changes. `scripts/review-changed-questions.mjs` compares each bundle with the PR base, sends only the added or modified questions (all of them, in batches of 15) to the model and posts findings as a PR comment: answer key plausibility, options/answers fit, explanation vs answer, topic and tags. It never fails the PR (LLM output varies) and is skipped when `ANTHROPIC_API_KEY` is unavailable (fork PRs). The model defaults to the one used by the weekly review and is overridable through `LLM_MODEL`. Run it locally with `ANTHROPIC_API_KEY=… node scripts/review-changed-questions.mjs --base <dir holding the base *questions.json files>`.

## Testing philosophy

When writing tests for this project, focus on **major and crucial behavior**. Do not write tests for trivial stuff like checking the text in an element.

**Worth testing (behavior):**
- Scoring logic, pass/fail thresholds, projected scaled scores
- Filter composition (AND/OR semantics, exclude logic, replay modes)
- Session state transitions (start → answer → finish → review)
- Answer correctness (single vs multi-select, deduplication)
- Data validation (cert-bundle schema rules)

**Not worth testing (implementation details):**
- That a specific label string renders in a DOM element (e.g. `expect(wrapper.find('h1').text()).toContain('Some Title')`)
- That a button has a certain CSS class
- That a component renders the right number of children
- That a specific HTML structure is used

If a test would break only by changing copy (not behavior), it's too trivial. Test the *what*, not the *how*.

## Adding a certification

There is no in-app upload. A new cert = a new `src/assets/<CODE> questions.json` bundle **and a matching entry in `src/assets/cert-manifest.json`** (file name, exam metadata, question count — the selector renders the manifest, the questions load lazily on first visit). Raw exam dumps are converted by an LLM using **`docs/certifications/adding-a-certification.md`** (a maintainer/contributor spec with a strict stop-and-ask rule: never guess, never force-fit, never silently drop data). If your task is "convert these questions" or "add cert X", read it first and follow it; the resulting JSON must pass `src/utils/schemaValidator.ts` (validate via `npm run test`, which covers the validator).

Known quirk: questions with no non-empty `options` are kept in the bundle but excluded from the active quiz pool by `isQuestionAnswerable` (the loader's `activePool()` filters them out, and the validator emits a warning). If you see the warning for a newly added bundle, it's expected behavior, not a bug: author the missing options rather than deleting the questions.

## What the agent should do

### Scope
The agent may modify any file in the repository, including CI configuration (`.github/workflows/`) and dependencies (`package.json`). There is no restricted directory.

### Git
The agent **must not** interact with the git repository: no `git add`, `git commit`, `git push`, or any other git command. When a unit of work is complete and ready for review, tell the user what was changed and that it should be committed.

### When things go wrong
- **Test failures / bugs:** stop and ask the user. Do not unilaterally decide whether to fix the code or the tests.
- **Conflicting instructions:** if the user requests something that violates an architecture rule (section "Core architecture rules" below), warn the user and ask for confirmation before proceeding.

### Output
Explain changes briefly and clearly. The user will ask for more detail if needed — lead with the essentials.

### TODO / FIXME comments
`TODO` and `FIXME` markers are acceptable in code. The comment-free convention below applies to design rationale, not task tracking.

## Conventions

- TypeScript strict; shared types live in `src/types.ts` — extend them there rather than redefining interfaces locally.
- Tests are colocated with the code (e.g. `src/stores/userProgress.test.ts`, `src/router/index.test.ts`) using Vitest; add/adjust tests for behavior changes.
- `src/assets/**` is ESLint-ignored (the question banks are data, not code).
- Source files are kept **comment-free**: design rationale lives in `AGENTS.md` and `docs/` — don't add explanatory comments to code, put new rationale in the docs instead.
- Branch naming follows `feat/…` style; commits go through Husky hooks.

## PurgeCSS

Production builds (`vite build`) run purgecss on CSS requests in a Vite `transform` hook with `enforce: 'pre'` (`vite.config.ts`, implementation in `src/vite/purgecss.ts`). It scans the repository `index.html` and supported source files under `src`, so class references in those files affect purging. Dev builds are untouched.

- Vue scoped styles (`[data-v-*]`) stay working: every `data-v-*` attribute found in a CSS asset is auto-safelisted as a dynamic attribute, while classes inside scoped rules are still purged.
- Classes assembled at runtime (`btn--${size}`, `badge--${variant}`, `welcome-card--${variant}`) are invisible to the static extractor and are safelisted by prefix in `src/vite/purgecss.ts`. Add prefixes there when new dynamic class families are introduced.
- Custom properties (`--brand`, …) are kept by default (`variables` off).
- To keep a selector purgecss would otherwise drop, use the `/* purgecss ignore */`, `/* purgecss start ignore */` / `/* purgecss end ignore */`, or `/* purgecss ignore next */` CSS annotations.

Verify after CSS changes with `npm run build` and inspect `dist/assets/*.css`.

## First session

This file is the entry point — it carries the stack, commands, architecture rules, testing philosophy, and conventions. Read it, then follow the routing table below for the task at hand.

## Where to look first

- Schema questions (any JSON field, scoring rules) → `docs/certifications/schema-reference.md`
- Converting an exam dump, or adding a new certification → `docs/certifications/adding-a-certification.md`
- Bundle validation rules → `src/utils/schemaValidator.ts` + its tests
- What a feature should do / whether it's deliberate → the "Core architecture rules" section above
