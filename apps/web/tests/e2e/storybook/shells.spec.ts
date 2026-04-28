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

test('form runtime field primitives accept input in Storybook', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--field-primitives')

  const nameField = page.getByRole('textbox', { name: 'Name' })
  await storyExpect(nameField).toHaveValue('Ember Ward')
  await nameField.fill('Frost Lace')
  await storyExpect(nameField).toHaveValue('Frost Lace')
  await storyExpect(page.getByText('Rich Text Notes')).toBeVisible()
  await storyExpect(page.getByText('Use this field for formatted longform notes.')).toBeVisible()
})

test('form runtime sectioned node map switches sections in Storybook', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--sectioned-node-map')

  await storyExpect(page.getByRole('heading', { name: 'Basics' })).toBeVisible()
  await page.getByRole('button', { name: 'Casting' }).click()
  await storyExpect(page.getByRole('heading', { name: 'Casting' })).toBeVisible()
  await storyExpect(page.getByRole('heading', { name: 'Basics' })).toHaveCount(0)
})

test('form runtime locked master story is read-only and copyable', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--locked-master-readonly')

  await storyExpect(page.getByRole('button', { name: 'Copy to edit' })).toBeVisible()
  await storyExpect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly')
})

test('form runtime nested collection story adds items', async ({ page }) => {
  await openStory(page, 'platform-form-runtime--nested-collection')

  await storyExpect(page.getByText('Useful for playtest encounters')).toBeVisible()
  await page.getByRole('button', { name: 'Add note' }).click()
  await storyExpect(page.getByText('Note 1')).toBeVisible()
})
