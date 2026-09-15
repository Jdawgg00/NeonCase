import { expect, test } from '@playwright/test'

/**
 * Requires a running app with a migrated + seeded database
 * (`npx prisma migrate dev` + `npm run db:seed`).
 *
 * Logs in with a freshly generated name each run. Name-only login creates
 * the account on first use, so every run gets a clean user — which is what
 * makes this repeatable, since the daily bonus can only be claimed once per
 * day per account.
 */

const DAILY_BONUS_AMOUNT = Number(process.env.DAILY_BONUS_AMOUNT ?? 250)

test('bruker kan hente daglig bonus én gang, deretter blokkeres', async ({ page }) => {
  const name = `e2e-${Date.now()}`

  await page.goto('/login')
  await page.getByTestId('name-login-input').fill(name)
  await page.getByTestId('name-login-submit').click()

  await page.waitForURL('**/dashboard')

  const balanceText = await page.getByTestId('wallet-balance').innerText()
  const startingBalance = Number(balanceText.replace(/[^\d]/g, ''))

  await page.getByTestId('claim-daily-bonus').click()
  await expect(page.getByTestId('claim-success')).toBeVisible()

  const newBalanceText = await page.getByTestId('wallet-balance').innerText()
  const newBalance = Number(newBalanceText.replace(/[^\d]/g, ''))
  expect(newBalance).toBe(startingBalance + DAILY_BONUS_AMOUNT)

  // Second claim same day must be rejected, and must not add more.
  await page.getByTestId('claim-daily-bonus').click()
  await expect(page.getByTestId('claim-error')).toBeVisible()

  const finalBalanceText = await page.getByTestId('wallet-balance').innerText()
  expect(Number(finalBalanceText.replace(/[^\d]/g, ''))).toBe(newBalance)
})
