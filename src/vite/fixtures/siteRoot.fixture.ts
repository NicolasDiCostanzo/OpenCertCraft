import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CertBundle, CertManifestEntry } from '../../types'
import { multiAnswerQuestion, singleAnswerQuestion } from '../../utils/fixtures/sampleQuestions.fixture'

export const COMMIT_DATE = '2026-03-04'

const bundle: CertBundle = {
  version: 1,
  exam: {
    name: 'Cloud Associate',
    code: 'X-1',
    totalQuestions: 2,
    timeLimitMinutes: 30,
    passingScore: { passingScore: 70 },
    weights: { Security: 50, Networking: 50 },
  },
  themes: {},
  questions: [singleAnswerQuestion, multiAnswerQuestion],
}

const manifest: CertManifestEntry[] = [{ file: 'X-1 questions.json', questionCount: 2, exam: bundle.exam }]

export function makeSiteRoot({ withGit }: { withGit: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), 'seo-plugin-'))
  mkdirSync(join(root, 'src/assets'), { recursive: true })
  writeFileSync(join(root, 'src/assets/cert-manifest.json'), JSON.stringify(manifest))
  writeFileSync(join(root, 'src/assets/X-1 questions.json'), JSON.stringify(bundle))
  if (withGit) {
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
        cwd: root,
        stdio: 'ignore',
        env: { ...process.env, GIT_COMMITTER_DATE: `${COMMIT_DATE}T12:00:00Z`, GIT_AUTHOR_DATE: `${COMMIT_DATE}T12:00:00Z` },
      })
    git('init', '-q')
    git('add', '.')
    git('commit', '-q', '-m', 'bundle')
  }
  return root
}
