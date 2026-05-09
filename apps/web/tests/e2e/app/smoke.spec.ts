import { expect, test } from '@playwright/test'

test('marketing route renders the Phase 9.2 public page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Create the content you want to run, then bring it straight into play.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Characters stay playable, not just editable' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('public auth routes render the rebuilt auth shell', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page.getByTestId('auth-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.locator('form').filter({ has: page.getByRole('button', { name: 'Sign in' }) })).toHaveAttribute('method', 'post')
  await expect(page.getByLabel('Email address')).toHaveAttribute('autocomplete', 'username')
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'current-password')

  await page.getByRole('link', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await expect(page.getByLabel('Name')).toBeVisible()

  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()

  await page.goto('/update-password')
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'New password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible()

  await page.goto('/auth/confirmed')
  await expect(page.getByRole('heading', { name: 'Your account is confirmed.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue to sign in' })).toBeVisible()
})

test('sign-in submit does not serialize credentials into the address bar', async ({ page }) => {
  const email = 'player@example.com'
  const password = 'password123'

  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).not.toHaveURL(new RegExp(`email|password|${email}|${password}`))
})

test('logged-out routes share the same theme provider state', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeEnabled()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.waitForFunction(() => {
    return document.documentElement.getAttribute('data-mantine-color-scheme') === 'light'
  })

  await Promise.all([
    page.waitForURL(/\/sign-in$/),
    page.getByRole('link', { name: 'Sign in' }).click()
  ])
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', /light/)
  await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeEnabled()

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.waitForFunction(() => {
    return document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark'
  })
})
