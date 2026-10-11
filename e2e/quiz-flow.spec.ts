import { texts } from '../src/texts/en'
import {
  certCode,
  certExamName,
  expectedResult,
  scriptedQuestions,
  themeBreakdown,
  themeGroup,
  themeGroupsInOrder,
  themeValues,
  topicBreakdown,
  topicFilter,
} from './fixtures/deploymentQuiz'
import { seedConfirmedUser, signIn } from './helpers/authFlow'
import { freezeTimeAt } from './helpers/clock'
import {
  expectFlaggedReviewEnabled,
  expectSingleHistoryEntry,
  goBackToDashboard,
  goBackToCertDashboard,
  openCertDashboardCard,
  openFlaggedReviewOnly,
  signOut,
} from './helpers/dashboard'
import {
  configureFilteredQuiz,
  expectCorrectFeedback,
  expectDashboardStat,
  expectIncorrectFeedback,
  expectMatchingCount,
  finishQuiz,
  flagQuestion,
  goToNextQuestion,
  pinDeterministicShuffle,
  selectAnswer,
  startConfiguredQuiz,
  submitAnswer,
  unflagQuestion,
} from './helpers/quiz'
import {
  expandThemeGroup,
  expectPassFailBanner,
  expectQuestionDetail,
  expectScoreCard,
  expectSummaryCard,
  expectThemeBreakdownRow,
  expectTopicBreakdownRow,
  openQuestionDetail,
} from './helpers/review'
import certManifestJson from '../src/assets/cert-manifest.json' with { type: 'json' }
import type { CertManifestEntry } from '../src/types'
import { expect, test } from './helpers/sharedPageFixture'
import { newTestUserCredentials } from './helpers/testUser'

const certManifest = certManifestJson as unknown as CertManifestEntry[]

const { email, password } = newTestUserCredentials()

const quizStartedAt = new Date('2025-06-15T10:00:00.000Z')
const quizFinishedAt = new Date(quizStartedAt.getTime() + 13 * 60_000)
const expectedHistoryDate = quizFinishedAt.toLocaleDateString('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

test.describe.serial('quiz journey on the DVA-C02 certification', () => {
  test.beforeAll(async ({ sharedPage: page }) => {
    await pinDeterministicShuffle(page)
    await seedConfirmedUser(page, { email, password })
    await signIn(page, { email, password })
  })

  test('lists every declared certification as a card', async ({ sharedPage: page }) => {
    await page.goto('/cert')

    await page.getByRole('button', { name: texts.expandAllLabel }).click()

    await expect(page.locator('.cert-card')).toHaveCount(certManifest.length)
    for (const entry of certManifest) {
      await expect(page.getByRole('heading', { name: entry.exam.name })).toBeVisible()
    }
  })

  test('shows a blank dashboard before any quiz is taken', async ({ sharedPage: page }) => {
    await openCertDashboardCard(page, certExamName)
    await expect(page).toHaveURL(new RegExp(`/certs/${certCode}$`))

    await expectDashboardStat(page, texts.quizzesTaken, '0')
    await expectDashboardStat(page, texts.overallAccuracy, '0%')
    await expectDashboardStat(page, texts.correctAnswers, '0 / 0')
    await expect(page.getByText(texts.noQuizzesTaken)).toBeVisible()
  })

  test('configures a quiz filtered down to the 4 scripted questions', async ({ sharedPage: page }) => {
    await page.getByRole('button', { name: texts.startQuizCta }).click()
    await configureFilteredQuiz(page, { topic: topicFilter, themeGroup, themeValues })
    await expectMatchingCount(page, scriptedQuestions.length)

    await freezeTimeAt(page, quizStartedAt)
    await startConfiguredQuiz(page)
    await expect(page.locator('.progress-text')).toHaveText(texts.questionOf(1, scriptedQuestions.length))
  })

  test('answers all 4 questions with the scripted correct/incorrect results', async ({ sharedPage: page }) => {
    const [q1, q2, q3, q4] = scriptedQuestions

    await selectAnswer(page, q1.selectAnswers)
    await flagQuestion(page)
    await submitAnswer(page)
    await expectCorrectFeedback(page)
    await goToNextQuestion(page)

    await selectAnswer(page, q2.selectAnswers)
    await flagQuestion(page)
    await unflagQuestion(page)
    await submitAnswer(page)
    await expectCorrectFeedback(page)
    await goToNextQuestion(page)

    await selectAnswer(page, q3.selectAnswers)
    await submitAnswer(page)
    await expectIncorrectFeedback(page, q3.correctAnswers)
    await goToNextQuestion(page)

    await selectAnswer(page, q4.selectAnswers)
    await submitAnswer(page)
    await expectIncorrectFeedback(page, q4.correctAnswers)
    await freezeTimeAt(page, quizFinishedAt)
    await finishQuiz(page)

    await expect(page).toHaveURL(new RegExp(`/certs/${certCode}/quiz/review$`))
  })

  test('shows the pass/fail banner and score card', async ({ sharedPage: page }) => {
    await expectPassFailBanner(page, expectedResult.passed)
    await expectScoreCard(page, {
      percent: expectedResult.percent,
      correctCount: expectedResult.correctCount,
      totalAnswered: expectedResult.totalQuestions,
      projectedScore: expectedResult.projectedScore,
      scale: expectedResult.scale,
    })
  })

  test('shows the score by topic and score by theme breakdown', async ({ sharedPage: page }) => {
    for (const row of topicBreakdown) {
      await expectTopicBreakdownRow(page, row)
    }

    await expect(page.locator('.breakdown__group-label')).toHaveText(themeGroupsInOrder)

    for (const group of themeGroupsInOrder) {
      await expandThemeGroup(page, group)
      for (const row of themeBreakdown[group]) {
        await expectThemeBreakdownRow(page, group, row)
      }
    }
  })

  test('shows the 4 summary cards with the scripted correctness and flag state', async ({ sharedPage: page }) => {
    for (const [i, question] of scriptedQuestions.entries()) {
      await expectSummaryCard(page, i + 1, { correct: question.correct, flagged: question.flaggedAfterQuiz })
    }
  })

  test('shows full question detail per card, then unflags the first and flags the last', async ({ sharedPage: page }) => {
    await expectQuestionDetail(page, topicFilter, scriptedQuestions[0])
    for (const [i, question] of scriptedQuestions.entries()) {
      if (i === 0) continue
      await openQuestionDetail(page, i + 1)
      await expectQuestionDetail(page, topicFilter, question)
    }

    await openQuestionDetail(page, 1)
    await unflagQuestion(page)
    await openQuestionDetail(page, 4)
    await flagQuestion(page)

    await expectSummaryCard(page, 1, { correct: true, flagged: false })
    await expectSummaryCard(page, 4, { correct: false, flagged: true })
  })

  test('shows this quizz score on the dashboard', async ({ sharedPage: page }) => {
    await goBackToCertDashboard(page)
    await expect(page).toHaveURL(new RegExp(`/certs/${certCode}$`))

    await expectDashboardStat(page, texts.quizzesTaken, '1')
    await expectDashboardStat(page, texts.overallAccuracy, `${expectedResult.percent}%`)
    await expectDashboardStat(page, texts.correctAnswers, `${expectedResult.correctCount} / ${expectedResult.totalQuestions}`)

    for (const row of topicBreakdown) {
      await expectTopicBreakdownRow(page, row)
    }
    for (const group of themeGroupsInOrder) {
      await expandThemeGroup(page, group)
      for (const row of themeBreakdown[group]) {
        await expectThemeBreakdownRow(page, group, row)
      }
    }

    await expectFlaggedReviewEnabled(page, true)
    await expectSingleHistoryEntry(page, {
      mode: texts.modePreparation,
      dateText: expectedHistoryDate,
      duration: '13 min',
      percent: expectedResult.percent,
    })
  })

  test('reviewing flagged questions only shows question 4, then removing its flag empties the list', async ({ sharedPage: page }) => {
    await openFlaggedReviewOnly(page)
    await expect(page.locator('.summary-card')).toHaveCount(1)
    await expectQuestionDetail(page, topicFilter, scriptedQuestions[3])

    await unflagQuestion(page)
    await expect(page.getByText(texts.noQuestionsFoundMessage)).toBeVisible()

    await goBackToDashboard(page)
    await expect(page).toHaveURL(new RegExp(`/certs/${certCode}$`))
    await expectFlaggedReviewEnabled(page, false)
  })

  test('signing out returns to the welcome page with practice first and sync buttons', async ({ sharedPage: page }) => {
    await signOut(page)

    await expect(page.getByRole('button', { name: texts.welcomeNoAccountCta })).toBeVisible()
    await expect(page.getByText(texts.welcomeSyncTitle)).toBeVisible()
    await expect(page.getByRole('button', { name: texts.welcomeExistingAccountCta })).toBeVisible()
    await expect(page.getByRole('button', { name: texts.welcomeNewAccountCta })).toBeVisible()
  })
})
