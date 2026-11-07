import { expect, type Page } from '@playwright/test'
import { texts } from '../../src/texts/en'

export function certCard(page: Page, code: string) {
  return page.locator('.cert-card', { hasText: code })
}

export async function openCertDashboardCard(page: Page, examName: string, code: string): Promise<void> {
  await certCard(page, code).getByRole('heading', { name: examName }).click()
}

export async function goBackToCertDashboard(page: Page): Promise<void> {
  await page.getByRole('button', { name: texts.goBackToDashboard, exact: true }).click()
}

export async function goBackToDashboard(page: Page): Promise<void> {
  await page.getByRole('button', { name: texts.goBackToDashboard, exact: true }).click()
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: texts.signOut, exact: true }).click()
}

export async function expectFlaggedReviewEnabled(page: Page, enabled: boolean): Promise<void> {
  const button = page.getByRole('button', { name: texts.reviewFlagged, exact: true })
  if (enabled) {
    await expect(button).toBeEnabled()
  } else {
    await expect(button).toBeDisabled()
  }
}

export async function openFlaggedReviewOnly(page: Page): Promise<void> {
  await page.getByRole('button', { name: texts.reviewFlagged, exact: true }).click()
}

export async function expectSingleHistoryEntry(
  page: Page,
  { mode, dateText, duration, percent }: { mode: string; dateText: string; duration: string; percent: number },
): Promise<void> {
  const entry = page.locator('.entry')
  await expect(entry).toHaveCount(1)
  await expect(entry.locator('.entry-mode')).toHaveText(mode)
  await expect(entry.locator('.entry-date')).toHaveText(dateText)
  await expect(entry.locator('.entry-duration')).toHaveText(texts.completedIn(duration))
  await expect(entry.locator('.entry-score')).toHaveText(`${percent}%`)
}
