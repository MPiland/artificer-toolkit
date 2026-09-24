import { expect, test } from '@playwright/test'

test.beforeEach(({ baseURL }) => {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
    throw new Error('Auth confirmation checks require the local app.')
  }
})

test('confirmation is informational and returns to sign in without a session', async ({ page }) => {
  await page.goto('/auth/confirmed')
  await expect(page.getByRole('heading', { name: 'Your account is confirmed.' })).toBeVisible()
  await page.getByRole('link', { name: 'Continue to sign in' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.goto('/home')
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/)
})

test('invalid confirmation links offer a safe recovery path on mobile', async ({
  page
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/auth/confirmed?error=TOKEN_EXPIRED%3Cprivate-provider-detail%3E')
  await expect(
    page.getByRole('heading', {
      name: 'This confirmation link is unavailable'
    })
  ).toBeVisible()
  await expect(page.getByText(/request a new confirmation link/)).toBeVisible()
  await expect(page.getByText('private-provider-detail', { exact: false })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await page.screenshot({
    path: testInfo.outputPath('confirmation-mobile.png'),
    fullPage: true
  })
  await page.getByRole('link', { name: 'Continue to sign in' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('unverified sign-in renders recovery feedback without navigating or sending email', async ({
  page
}) => {
  await page.route('**/api/auth/sign-in/email', async (route) => {
    expect(route.request().postDataJSON()).not.toHaveProperty('callbackURL')
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Private provider detail'
      })
    })
  })
  await page.goto('/sign-in')
  await page.getByLabel('Email or username').fill('unverified@example.invalid')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Confirm your email before signing in. Check your inbox for a new confirmation link.'
  )
  await expect(page).toHaveURL(/\/sign-in$/)
})
