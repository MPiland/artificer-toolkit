import { expect, test as base, type Page } from '@playwright/test'
import { createE2ECharacterCleanup, type E2ECharacterCleanup } from './characterCleanup'
import { installDevtoolLauncherHiding } from './devtools'

const storageState = process.env.MVP_AUDIT_STORAGE_STATE

export const test = base.extend<{
  authenticatedPage: Page
  characterCleanup: E2ECharacterCleanup
}>({
  characterCleanup: async ({ baseURL }, use) => {
    assertLocalApplication(baseURL)
    const cleanup = createE2ECharacterCleanup()
    try {
      await use(cleanup.tracker)
    } finally {
      await cleanup.cleanup()
    }
  },
  authenticatedPage: async ({ characterCleanup: _characterCleanup, page }, use, testInfo) => {
    assertLocalApplication(testInfo.project.use.baseURL)
    await installDevtoolLauncherHiding(page)
    await page.goto('/characters', { waitUntil: 'networkidle' })

    if (new URL(page.url()).pathname.startsWith('/sign-in')) {
      await signIn(page)
    }

    await expect(page).not.toHaveURL(/\/(?:auth|sign-in|sign-up|reset-password)(?:\/|$)/)
    try {
      await use(page)
    } finally {
      await page.close()
    }
  }
})

if (storageState) test.use({ storageState })

export { expect }

async function signIn(page: Page): Promise<void> {
  const email = process.env.MVP_AUDIT_EMAIL
  const password = process.env.MVP_AUDIT_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Local app E2E requires MVP_AUDIT_STORAGE_STATE or both MVP_AUDIT_EMAIL and MVP_AUDIT_PASSWORD.'
    )
  }

  await page.getByLabel('Email or username').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
}

function assertLocalApplication(baseURL: unknown): void {
  if (typeof baseURL !== 'string') {
    throw new Error('The local app E2E project requires a baseURL.')
  }

  const hostname = new URL(baseURL).hostname
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    throw new Error(`Refusing to run character acceptance against non-local host ${hostname}.`)
  }
}
