import { mkdir } from 'node:fs/promises'
import { chromium, expect, type Page } from '@playwright/test'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { watchNavigationAbortedRequests } from './campaignCollaboration'

type AccountEntitlementsVerificationInput = {
  email: string
  password: string
  evidenceDirectory: string
  upgrade: () => Promise<void>
  createDraft: () => Promise<void>
  discardDraft: () => Promise<void>
}

const origin = 'http://localhost:3000'

export async function verifyAccountEntitlementsBrowser(
  input: AccountEntitlementsVerificationInput
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  let page: Page | undefined

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(90_000)
    page = await context.newPage()
    captureDiagnostics(page, diagnostics)

    await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('textbox', { name: 'Email or username' }).fill(input.email)
    await page.locator('input[name="password"]').fill(input.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60_000 })
    await expect(
      page.getByRole('heading', { name: 'Start with Library or Create', exact: true })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Open account menu', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click()
    await page.getByRole('link', { name: 'Account', exact: true }).click()
    await assertHealthyAccountPage(page)
    await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible()
    await expect(page.getByText('Free', { exact: true })).toBeVisible()
    await expect(personalCharactersRow(page)).toHaveText([
      'Personal Characters',
      '0',
      String(ENTITLEMENT_LIMITS.FREE.personalCharacters)
    ])
    await page.screenshot({
      path: `${input.evidenceDirectory}/account-entitlements-free.png`,
      fullPage: true,
      caret: 'initial',
      mask: [page.getByText(input.email, { exact: true })]
    })

    await input.upgrade()
    await expect(page.getByText('GM', { exact: true })).toBeVisible()
    await expect(personalCharactersRow(page)).toHaveText(['Personal Characters', '0', 'Unlimited'])

    await input.createDraft()
    await expect(personalCharactersRow(page)).toHaveText(['Personal Characters', '1', 'Unlimited'])
    await input.discardDraft()
    await expect(personalCharactersRow(page)).toHaveText(['Personal Characters', '0', 'Unlimited'])

    await page.reload({ waitUntil: 'domcontentloaded' })
    await assertHealthyAccountPage(page)
    await expect(page.getByText('GM', { exact: true })).toBeVisible()
    await expect(personalCharactersRow(page)).toHaveText(['Personal Characters', '0', 'Unlimited'])
    await page.screenshot({
      path: `${input.evidenceDirectory}/account-entitlements-gm-reload.png`,
      fullPage: true,
      caret: 'initial',
      mask: [page.getByText(input.email, { exact: true })]
    })

    if (diagnostics.length > 0)
      throw new Error(`Account entitlement diagnostics: ${diagnostics.join(' | ')}`)
  } catch (error) {
    const body = page
      ? await page
          .locator('body')
          .innerText()
          .catch(() => '')
      : ''
    const message = error instanceof Error ? error.message : 'Account entitlement browser failed.'
    throw new Error(scrub(`${message} ${body.slice(0, 3000)}`, input))
  } finally {
    await browser.close()
  }
}

function personalCharactersRow(page: Page) {
  return page.getByRole('row', { name: /Personal Characters/ }).locator('th, td')
}

async function assertHealthyAccountPage(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page).toHaveTitle(/Artificer/i)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open account menu', exact: true })).toBeEnabled()
}

function captureDiagnostics(page: Page, diagnostics: string[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error')
      diagnostics.push(`${new URL(page.url()).pathname}: ${message.text().slice(0, 8000)}`)
  })
  page.on('pageerror', (error) => diagnostics.push(error.message.slice(0, 1000)))
  const tolerateNavigationAbort = watchNavigationAbortedRequests(page)
  page.on('requestfailed', (request) => {
    if (!['fetch', 'xhr'].includes(request.resourceType())) return
    const entry = `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? 'request failed'}`
    diagnostics.push(entry)
    tolerateNavigationAbort(request, () => diagnostics.splice(diagnostics.lastIndexOf(entry), 1))
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      diagnostics.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/trpc'))
      diagnostics.push(`legacy request ${url.hostname}${url.pathname}`)
  })
}

function scrub(value: string, input: AccountEntitlementsVerificationInput): string {
  return value
    .replaceAll(input.email, '[fixture email]')
    .replaceAll(input.password, '[fixture password]')
}
