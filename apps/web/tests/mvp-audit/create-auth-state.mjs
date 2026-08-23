import { chromium } from '@playwright/test'

const statePath = process.env.MVP_AUDIT_STORAGE_STATE
const email = process.env.MVP_AUDIT_EMAIL
const password = process.env.MVP_AUDIT_PASSWORD
const baseUrl = process.env.MVP_AUDIT_BASE_URL ?? 'http://127.0.0.1:3000'

if (!statePath || !email || !password) {
  throw new Error('MVP_AUDIT_STORAGE_STATE, MVP_AUDIT_EMAIL, and MVP_AUDIT_PASSWORD are required.')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.getByLabel('Email or username').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForFunction(
    () =>
      !window.location.pathname.startsWith('/sign-in') ||
      document.querySelector('[role="alert"], [role="status"]'),
    undefined,
    { timeout: 30_000 }
  )

  const error = await page
    .getByRole('alert')
    .textContent()
    .catch(() => null)
  if (error) throw new Error(`Sign-in failed: ${error.trim()}`)

  await context.storageState({ path: statePath })
} finally {
  await browser.close()
}
