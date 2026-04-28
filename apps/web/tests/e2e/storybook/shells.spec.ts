import { expect, test, type Page } from '@playwright/test'

const storyExpect = expect.configure({ timeout: 20_000 })

test.describe.configure({ mode: 'serial' })

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`, { waitUntil: 'domcontentloaded' })
}

async function getGridColumnCount(page: Page) {
  return page.getByTestId('authored-list-card-row').first().evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ))
}

test('marketing page story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-marketing--page')

  await storyExpect(page.getByTestId('marketing-page')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Create the content you want to run, then bring it straight into play.' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('auth shell story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-auth-authpageshell--login')

  await storyExpect(page.getByTestId('auth-shell')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('password update story renders in Storybook', async ({ page }) => {
  await openStory(page, 'guest-auth-authpageshell--update-password')

  await storyExpect(page.getByTestId('auth-shell')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Update password' })).toBeVisible()
})

test('app shell story renders in Storybook', async ({ page }) => {
  await openStory(page, 'platform-shells-appshellframe--default')

  await storyExpect(page.getByTestId('app-shell')).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Authenticated shell foundation' })).toBeVisible()
})

test('authored list story renders locked and owned states in Storybook', async ({ page }) => {
  await openStory(page, 'platform-authored-list-authoredlistpage--default')

  await storyExpect(page.getByRole('heading', { name: 'Spells' })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /magic missile/i })).toBeVisible()
  await storyExpect(page.getByRole('row', { name: /ember lace/i })).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Create Spell' })).toBeVisible()
})

test('authored list card view renders locked and owned states in Storybook', async ({ page }) => {
  await openStory(page, 'platform-authored-list-authoredlistpage--card-view')

  await storyExpect(page.getByRole('heading', { name: 'Spells' })).toBeVisible()
  await storyExpect(page.getByLabel(/view magic missile/i)).toBeVisible()
  await storyExpect(page.getByLabel(/view ember lace/i)).toBeVisible()
  await storyExpect(page.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'false')
  await storyExpect(page.getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'true')
  await storyExpect.poll(() => getGridColumnCount(page)).toBe(3)
})

test('authored list mobile card menu exposes permission-aware actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openStory(page, 'platform-authored-list-authoredlistpage--mobile')

  await storyExpect(page.getByLabel(/view magic missile/i)).toBeVisible()
  await storyExpect.poll(() => getGridColumnCount(page)).toBe(1)
  await page.getByRole('button', { name: /more actions for magic missile/i }).click()
  const magicMissileMenu = page.getByRole('menu', { name: /more actions for magic missile/i })
  await storyExpect(magicMissileMenu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
  await storyExpect(magicMissileMenu.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /more actions for ember lace/i }).click()
  const emberLaceMenu = page.getByRole('menu', { name: /more actions for ember lace/i })
  await storyExpect(emberLaceMenu.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
  await storyExpect(emberLaceMenu.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
  await storyExpect(emberLaceMenu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
})

test('theme toggle story switches between light and dark', async ({ page }) => {
  await openStory(page, 'platform-theme-themetoggle--default')

  await storyExpect(page.getByRole('button', { name: 'Switch to light mode' })).toBeEnabled()
  await storyExpect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /dark/)
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await storyExpect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /light/)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await storyExpect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /dark/)
})
