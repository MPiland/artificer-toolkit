import { expect, test } from '@playwright/test'

test('marketing route renders the Phase 9.1 shell', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'The frontend rebuild now has a dedicated platform slice.' })).toBeVisible()
  await expect(page.getByText('Phase 9.1 live')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})
