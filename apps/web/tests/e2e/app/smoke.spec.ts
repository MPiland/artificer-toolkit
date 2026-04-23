import { expect, test } from '@playwright/test'

test('marketing route renders the Phase 9.2 public page', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Run your table from one toolkit.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'One place for the whole table' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('public auth routes render the rebuilt auth shell', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByTestId('auth-shell')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()

  await page.getByRole('link', { name: 'Sign up ->' }).click()
  await expect(page).toHaveURL(/\/signup$/)
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
  await expect(page.getByLabel('Name')).toBeVisible()

  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()

  await page.goto('/update-password')
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'New password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible()

  await page.goto('/auth/confirmed')
  await expect(page.getByRole('heading', { name: 'Your confirmation link has been accepted.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue to login' })).toBeVisible()
})
