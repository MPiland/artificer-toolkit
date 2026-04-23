import { expect, test } from '@playwright/test'

test('public shell story renders in Storybook', async ({ page }) => {
  await page.goto('/iframe.html?id=platform-shells-publicshellframe--default&viewMode=story')

  await expect(page.getByTestId('public-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Public shell foundation' })).toBeVisible()
})

test('app shell story renders in Storybook', async ({ page }) => {
  await page.goto('/iframe.html?id=platform-shells-appshellframe--default&viewMode=story')

  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Authenticated shell foundation' })).toBeVisible()
})
