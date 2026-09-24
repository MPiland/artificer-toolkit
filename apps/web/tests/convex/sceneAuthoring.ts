import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type Page } from '@playwright/test'
import {
  captureDiagnostics,
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession
} from './campaignCollaboration'

type SceneAuthoringAccount = {
  email: string
  password: string
  username: string
}

type SceneAuthoringVerificationInput = {
  owner: SceneAuthoringAccount
  publicId: string
  sessionNumber: number
  mapPath: string
  evidenceDirectory: string
  verifyState: (stage: 'created' | 'edited' | 'reloaded') => Promise<void>
}

const origin = 'http://localhost:3000'

export async function verifySceneAuthoringBrowser(
  input: SceneAuthoringVerificationInput
): Promise<{ globalDiagnostics: string[] }> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const allowedChromiumWarnings: string[] = []
  const forbiddenLegacyRequests: string[] = []
  const successfulMapPuts: string[] = []
  const abortedRequests = new Map<string, string>()
  let stage = 'sign in'
  let failure: string | undefined
  let page: Page | undefined

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(90_000)
    page = await context.newPage()
    const session = watchAuthenticatedSession(page)
    captureDiagnostics(page, 'owner', () => stage, diagnostics, abortedRequests)
    page.on('console', (message) => {
      if (message.type() !== 'warning') return
      if (/GL Driver Message.*GPU stall due to ReadPixels/i.test(message.text())) {
        allowedChromiumWarnings.push(message.text())
        return
      }
      diagnostics.push(`owner ${stage}: console warning ${message.text().slice(0, 3000)}`)
    })
    page.on('request', (request) => {
      if (/campaigns\.scenes|media\.vttMap/i.test(new URL(request.url()).pathname))
        forbiddenLegacyRequests.push(`${request.method()} ${new URL(request.url()).pathname}`)
    })
    page.on('response', (response) => {
      if (
        response.request().method() === 'PUT' &&
        response.url().includes('/pending/') &&
        response.ok()
      )
        successfulMapPuts.push(response.url())
    })

    await signIn(page, input.owner, session)
    stage = 'open campaign'
    session.authenticated = false
    await page.goto(`${origin}/campaigns/${input.publicId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
    await waitForRouterIdle(page)
    const campaignPath = new URL(page.url()).pathname.split('/').filter(Boolean)
    const slug = campaignPath[2]
    if (!slug) throw new Error(`Campaign route did not resolve a canonical slug: ${page.url()}`)

    stage = 'open session prepare'
    session.authenticated = false
    await page.goto(
      `${origin}/campaigns/${input.publicId}/${slug}/sessions/${input.sessionNumber}`,
      { waitUntil: 'domcontentloaded', timeout: 90_000 }
    )
    await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
    await waitForRouterIdle(page)
    await expect(page.getByRole('tab', { name: 'Prepare', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Live maps', exact: true })).toBeVisible()

    stage = 'upload map'
    await page
      .getByRole('region', { name: 'Live maps', exact: true })
      .locator('input[type="file"]')
      .setInputFiles(input.mapPath)
    await page.getByRole('button', { name: 'Upload map', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Scene name', exact: true })).toBeVisible({
      timeout: 90_000
    })
    await page
      .getByRole('textbox', { name: 'Scene name', exact: true })
      .fill('V02 native owner scene')
    await page.getByRole('button', { name: 'Save scene', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'Scene editor: V02 native owner scene', exact: true })
    ).toBeVisible({ timeout: 90_000 })
    await expect.poll(() => successfulMapPuts.length, { timeout: 90_000 }).toBe(1)
    await input.verifyState('created')

    stage = 'edit scene'
    await page.getByRole('button', { name: 'Create wall', exact: true }).click()
    const editor = page.getByRole('region', {
      name: 'Scene editor: V02 native owner scene',
      exact: true
    })
    const saveButton = editor.getByRole('button', { name: 'Save scene', exact: true })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expect(page.getByRole('button', { name: /^V02 native owner scene/ })).toContainText(
      'v2',
      {
        timeout: 90_000
      }
    )
    await expect(saveButton).not.toHaveAttribute('data-loading')
    await expect(saveButton).toBeDisabled()
    await input.verifyState('edited')

    stage = 'reload scene'
    session.authenticated = false
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
    await waitForRouterIdle(page)
    const reloadedEditor = page.getByRole('region', {
      name: 'Scene editor: V02 native owner scene',
      exact: true
    })
    await expect(reloadedEditor).toBeVisible({ timeout: 90_000 })
    await expect(
      reloadedEditor.getByRole('img', { name: 'Interactive campaign scene' })
    ).toBeVisible()
    await expect(
      reloadedEditor.getByRole('group', { name: 'Scene object properties' })
    ).toContainText('0 tokens · 1 barriers · 0 lights')
    await input.verifyState('reloaded')
    await page.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/scene-authoring.png`,
      fullPage: true
    })
    expect(forbiddenLegacyRequests).toEqual([])
    expect(diagnostics).toEqual([])
    return { globalDiagnostics: diagnostics }
  } catch (error) {
    failure = scrub(
      error instanceof Error ? error.message : 'Scene authoring browser failed.',
      input
    )
    await page?.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/scene-authoring-failure.png`,
      fullPage: true
    })
    throw new Error(scrub(`${failure} | diagnostics: ${diagnostics.join(' | ')}`, input))
  } finally {
    await browser.close()
    for (const [request, diagnostic] of abortedRequests) {
      if (!successfulMapPuts.some((url) => request === `PUT ${url}`)) diagnostics.push(diagnostic)
    }
    await writeFile(
      `${input.evidenceDirectory}/scene-authoring-diagnostics.json`,
      JSON.stringify(
        {
          stage,
          failure,
          diagnostics: diagnostics.map((value) => scrub(value, input)),
          allowedChromiumWarnings,
          abortedRequests: [...abortedRequests.values()],
          forbiddenLegacyRequests,
          successfulMapPuts: successfulMapPuts.map((value) => scrub(value, input))
        },
        null,
        2
      )
    )
    if (!failure) expect(diagnostics.map((value) => scrub(value, input))).toEqual([])
  }
}

function scrub(value: string, input: SceneAuthoringVerificationInput): string {
  return value
    .replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
    .replaceAll(input.owner.email, '[owner email]')
    .replaceAll(input.owner.password, '[owner password]')
}
