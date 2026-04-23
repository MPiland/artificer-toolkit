import { expect, test } from '@playwright/test'

test('marketing page story renders in Storybook', async ({ page }) => {
  await page.goto('/iframe.html?id=public-marketing--page&viewMode=story')

  await expect(page.getByTestId('marketing-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run your table from one toolkit.' })).toBeVisible()
})

test('auth shell story renders in Storybook', async ({ page }) => {
  await page.goto('/iframe.html?id=public-auth-authpageshell--login&viewMode=story')

  await expect(page.getByTestId('auth-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('password update story renders in Storybook', async ({ page }) => {
  await page.goto('/iframe.html?id=public-auth-authpageshell--update-password&viewMode=story')

  await expect(page.getByTestId('auth-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible()
})

test('app shell story renders in Storybook', async ({ page }) => {
  await page.goto('/iframe.html?id=platform-shells-appshellframe--default&viewMode=story')

  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Authenticated shell foundation' })).toBeVisible()
})
