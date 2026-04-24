import { expect, test, type Page } from '@playwright/test'

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
  await page.waitForLoadState('networkidle')
}

test('marketing page story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-marketing--page')

  await expect(page.getByTestId('marketing-page')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Run your table from one toolkit.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('auth shell story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-auth-authpageshell--login')

  await expect(page.getByTestId('auth-shell')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('password update story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-auth-authpageshell--update-password')

  await expect(page.getByTestId('auth-shell')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible()
})

test('app shell story renders in Storybook', async ({ page }) => {
  await openStory(page, 'platform-shells-appshellframe--default')

  await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Authenticated shell foundation' })).toBeVisible()
})

test('theme toggle story switches between light and dark', async ({ page }) => {
  await openStory(page, 'platform-theme-themetoggle--default')

  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeEnabled({ timeout: 10000 })
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /dark/)
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /light/)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /dark/)
})
