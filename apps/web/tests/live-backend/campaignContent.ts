import { mkdir } from 'node:fs/promises'
import { chromium, expect, type Page } from '@playwright/test'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'

type CampaignContentVerificationInput = {
  email: string
  password: string
  publicId: string
  evidenceDirectory: string
  verifyRemoved: (count: number) => Promise<void>
}

const origin = 'http://localhost:3000'
const campaignSlug = 'encounter-execution-fixture'

export async function verifyCampaignContentBrowser(
  input: CampaignContentVerificationInput
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const errors: string[] = []
  const failedResponses: string[] = []
  const failedRequests: string[] = []
  let page: Page | undefined

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(90_000)
    page = await context.newPage()
    captureDiagnostics(page, errors, failedResponses, failedRequests)
    let authenticatedSessionObserved = false
    page.on('websocket', (socket) => {
      socket.on('framereceived', ({ payload }) => {
        const message: unknown = JSON.parse(payload.toString())
        if (!message || typeof message !== 'object' || !('modifications' in message)) return
        if (!Array.isArray(message.modifications)) return
        for (const modification of message.modifications) {
          if (!modification || typeof modification !== 'object' || !('value' in modification))
            continue
          const snapshot = authSessionSnapshotDtoSchema.safeParse(modification.value)
          if (snapshot.success && snapshot.data.user !== null) authenticatedSessionObserved = true
        }
      })
    })

    await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await page.getByRole('textbox', { name: 'Email or username' }).fill(input.email)
    await page.locator('input[name="password"]').fill(input.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60_000 })
    await expect.poll(() => authenticatedSessionObserved, { timeout: 30_000 }).toBe(true)

    authenticatedSessionObserved = false
    await openContent(page, input.publicId)
    await expect.poll(() => authenticatedSessionObserved, { timeout: 30_000 }).toBe(true)
    await selectContentTab(page)
    await assertHealthyPage(page)
    await expect(page.getByRole('heading', { name: 'Campaign content', exact: true })).toBeVisible()
    const removeShares = page.getByRole('button', { name: 'Remove share', exact: true })
    await expect(removeShares).toHaveCount(2)
    await page.screenshot({
      path: `${input.evidenceDirectory}/campaign-content-initial.png`,
      fullPage: true
    })

    await removeShares.first().click()
    await expect(removeShares).toHaveCount(1)
    await input.verifyRemoved(1)
    await removeShares.first().click()
    await expect(removeShares).toHaveCount(0)
    await expect(
      page.getByText('No homebrew is shared with this Campaign.', { exact: true })
    ).toBeVisible()
    await input.verifyRemoved(2)
    await page.screenshot({
      path: `${input.evidenceDirectory}/campaign-content-final.png`,
      fullPage: true
    })

    authenticatedSessionObserved = false
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect.poll(() => authenticatedSessionObserved, { timeout: 30_000 }).toBe(true)
    await selectContentTab(page)
    await expect(page.getByRole('heading', { name: 'Campaign content', exact: true })).toBeVisible()
    await expect(removeShares).toHaveCount(0)
    await expect(
      page.getByText('No homebrew is shared with this Campaign.', { exact: true })
    ).toBeVisible()
    await assertHealthyPage(page)
    await input.verifyRemoved(2)

    const diagnostics = [...errors, ...failedResponses, ...failedRequests]
    if (diagnostics.length > 0)
      throw new Error(`Campaign content diagnostics: ${diagnostics.join(' | ')}`)
  } catch (error) {
    const body = page
      ? await page
          .locator('body')
          .innerText()
          .catch(() => '')
      : ''
    const diagnostic = JSON.stringify({
      route: page ? new URL(page.url()).pathname : '',
      body: scrub(body.slice(0, 3000), input),
      errors: errors.slice(-6),
      failedResponses: failedResponses.slice(-6),
      failedRequests: failedRequests.slice(-6)
    })
    const message =
      error instanceof Error ? error.message : 'Campaign content browser verification failed.'
    throw new Error(scrub(`${message} ${diagnostic}`, input))
  } finally {
    await browser.close()
  }
}

async function openContent(page: Page, publicId: string): Promise<void> {
  await page.goto(`${origin}/campaigns/${publicId}/${campaignSlug}?tab=content`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  })
}

async function selectContentTab(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const router = (
      window as Window & {
        __TSR_ROUTER__?: { state: { status: string; isLoading: boolean } }
      }
    ).__TSR_ROUTER__
    return router?.state.status === 'idle' && !router.state.isLoading
  })
  await page.getByRole('tab', { name: 'Content', exact: true }).click()
}

async function assertHealthyPage(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toBeEmpty()
  await expect(page).toHaveTitle(/Artificer/i)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

function captureDiagnostics(
  page: Page,
  errors: string[],
  failedResponses: string[],
  failedRequests: string[]
): void {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 3000))
  })
  page.on('pageerror', (error) => errors.push(error.message.slice(0, 3000)))
  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ''}`
    )
  })
  page.on('response', (response) => {
    if (response.status() < 400) return
    failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
}

function scrub(value: string, input: CampaignContentVerificationInput): string {
  return value
    .replaceAll(input.email, '[fixture email]')
    .replaceAll(input.password, '[fixture password]')
}
