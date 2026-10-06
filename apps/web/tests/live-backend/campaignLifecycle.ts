/** Real native Campaign UI lifecycle with complete indexed state comparisons. */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type Page } from '@playwright/test'
import type { CampaignCopyProgress } from '@artificer-toolkit/schema/api/campaignCopy'
import {
  waitForRouterIdle,
  watchAuthenticatedSession,
  watchNavigationAbortedRequests
} from './campaignCollaboration'

export type CampaignLifecycleStage =
  | 'before-copy'
  | 'before-delete'
  | 'created'
  | 'updated'
  | 'default-copy'
  | 'selected-copy-started'
  | 'selected-copy-completed'
  | 'archived'
  | 'archived-general-copy'
  | 'deleted'

type Credential = { email: string; password: string }
type NotebookCategory = CampaignCopyProgress['notebookCategories'][number]
type StageInput = {
  stage: CampaignLifecycleStage
  publicId: string
  notebookCategories?: readonly NotebookCategory[]
}

export type CampaignLifecycleBrowserInput = {
  owner: Credential
  evidenceDirectory: string
  srdSystemLabel: string
  srdCatalogueLabel: string
  /** Primary-owned Native adapter: public note producers and complete scope/privacy assertions. */
  verifyStage: (input: StageInput) => Promise<void>
  /** Finds the selected job by Native identity, waits it to COMPLETED, and asserts its copied rows. */
  waitForSelectedCopy: (input: {
    sourcePublicId: string
    notebookCategories: readonly NotebookCategory[]
  }) => Promise<{ copyId: string; destinationPublicId: string }>
}

const origin = 'http://localhost:3000'
const fixtureName = 'Encounter execution fixture'
const detailRoute = /^http:\/\/localhost:3000\/campaigns\/(?!new(?:\/|$))[^/]+\/[^/?#]+(?:\?.*)?$/

export async function verifyCampaignLifecycleBrowser(
  input: CampaignLifecycleBrowserInput
): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce'
  })
  const diagnostics: string[] = []
  let stage = 'sign in'
  const trace = `${input.evidenceDirectory}/campaign-lifecycle.trace.zip`
  const finalShot = `${input.evidenceDirectory}/campaign-lifecycle-final.png`

  try {
    context.setDefaultTimeout(30_000)
    context.setDefaultNavigationTimeout(90_000)
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    const page = await context.newPage()
    const session = watchAuthenticatedSession(page)
    captureDiagnostics(page, () => stage, diagnostics)

    await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('textbox', { name: 'Email or username' }).fill(input.owner.email)
    await page.locator('input[name="password"]').fill(input.owner.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).not.toHaveURL(/\/sign-in/)
    await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)

    stage = 'create owner Campaign'
    await navigateAuthenticated(page, session, () =>
      page.goto(`${origin}/campaigns/new`, { waitUntil: 'domcontentloaded' })
    )
    await selectOption(page, 'Game System', input.srdSystemLabel)
    await selectOption(page, 'Primary Rules Catalogue', input.srdCatalogueLabel)
    await page.getByLabel('Campaign name').fill(fixtureName)
    await page.getByRole('button', { name: 'Create Campaign', exact: true }).click()
    await expect(page).toHaveURL(detailRoute)
    const originalId = campaignPublicId(page)
    await input.verifyStage({ stage: 'created', publicId: originalId }) // creates exactly 12 public-native notes

    stage = 'edit tone details and reload'
    await page.getByRole('tab', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Tone details').fill('Browser lifecycle copy proof')
    await page.getByRole('button', { name: 'Save Campaign', exact: true }).click()
    await input.verifyStage({ stage: 'updated', publicId: originalId })
    await navigateAuthenticated(page, session, () => page.reload({ waitUntil: 'domcontentloaded' }))
    await page.getByRole('tab', { name: 'Settings', exact: true }).click()
    await expect(page.getByLabel('Tone details')).toHaveValue('Browser lifecycle copy proof')

    stage = 'default copy has no categories'
    await navigateAuthenticated(page, session, () =>
      page.goto(`${origin}/campaigns`, { waitUntil: 'domcontentloaded' })
    )
    await openCopy(page, originalId)
    for (const label of ['Notes', 'People / NPC notes', 'Places / cities'])
      await expect(page.getByRole('checkbox', { name: label, exact: true })).not.toBeChecked()
    await input.verifyStage({ stage: 'before-copy', publicId: originalId, notebookCategories: [] })
    await page.getByRole('button', { name: 'Copy Campaign', exact: true }).click()
    await expect(page).toHaveURL(detailRoute)
    const defaultCopyId = campaignPublicId(page)
    await input.verifyStage({ stage: 'default-copy', publicId: defaultCopyId })

    stage = 'selected PEOPLE and PLACES copy'
    await navigateAuthenticated(page, session, () =>
      page.goto(`${origin}/campaigns`, { waitUntil: 'domcontentloaded' })
    )
    await openCopy(page, originalId)
    await page.getByRole('checkbox', { name: 'People / NPC notes', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Places / cities', exact: true }).check()
    await expect(page.getByRole('checkbox', { name: 'Notes', exact: true })).not.toBeChecked()
    await input.verifyStage({
      stage: 'before-copy',
      publicId: originalId,
      notebookCategories: ['PEOPLE', 'PLACES']
    })
    await page.getByRole('button', { name: 'Copy Campaign', exact: true }).click()
    await expect(page.getByText(/Copying .* in the background/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await navigateAuthenticated(page, session, () => page.reload({ waitUntil: 'domcontentloaded' }))
    await input.verifyStage({ stage: 'selected-copy-started', publicId: originalId })
    const { copyId, destinationPublicId: selectedDestinationPublicId } =
      await input.waitForSelectedCopy({
        sourcePublicId: originalId,
        notebookCategories: ['PEOPLE', 'PLACES']
      })
    const selectedJob = page.getByTestId(`campaign-copy-${copyId}`)
    await expect(selectedJob.getByText('Ready', { exact: true })).toBeVisible()
    await input.verifyStage({ stage: 'selected-copy-completed', publicId: originalId })
    await selectedJob.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(page).toHaveURL(detailRoute)
    const selectedCopyId = campaignPublicId(page)
    expect(selectedCopyId).toBe(selectedDestinationPublicId)

    stage = 'archive original and copy GENERAL only'
    await navigateAuthenticated(page, session, () =>
      page.goto(`${origin}/campaigns/${originalId}/encounter-execution-fixture`, {
        waitUntil: 'domcontentloaded'
      })
    )
    await page.getByRole('tab', { name: 'Settings', exact: true }).click()
    await acceptExactConfirm(
      page,
      'Archive this Campaign? It will become read-only.',
      page.getByRole('button', { name: 'Archive', exact: true })
    )
    await input.verifyStage({ stage: 'archived', publicId: originalId })
    await navigateAuthenticated(page, session, () => page.reload({ waitUntil: 'domcontentloaded' }))
    await expect(page.getByText('Archived Campaign', { exact: true })).toBeVisible()
    await navigateAuthenticated(page, session, () =>
      page.goto(`${origin}/campaigns`, { waitUntil: 'domcontentloaded' })
    )
    await openCopy(page, originalId)
    await page.getByRole('checkbox', { name: 'Notes', exact: true }).check()
    await input.verifyStage({
      stage: 'before-copy',
      publicId: originalId,
      notebookCategories: ['GENERAL']
    })
    await page.getByRole('button', { name: 'Copy Campaign', exact: true }).click()
    await expect(page.getByText(/Copying .* in the background/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await navigateAuthenticated(page, session, () => page.reload({ waitUntil: 'domcontentloaded' }))
    const { copyId: archivedCopyJobId, destinationPublicId: archivedDestinationPublicId } =
      await input.waitForSelectedCopy({
        sourcePublicId: originalId,
        notebookCategories: ['GENERAL']
      })
    const archivedCopyJob = page.getByTestId(`campaign-copy-${archivedCopyJobId}`)
    await expect(archivedCopyJob.getByText('Ready', { exact: true })).toBeVisible()
    await archivedCopyJob.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(page).toHaveURL(detailRoute)
    const archivedCopyId = campaignPublicId(page)
    expect(archivedCopyId).toBe(archivedDestinationPublicId)
    await input.verifyStage({ stage: 'archived-general-copy', publicId: archivedCopyId })

    stage = 'literal DELETE every root'
    for (const publicId of [defaultCopyId, selectedCopyId, archivedCopyId, originalId]) {
      await input.verifyStage({ stage: 'before-delete', publicId })
      await navigateAuthenticated(page, session, () =>
        page.goto(`${origin}/campaigns/${publicId}/encounter-execution-fixture`, {
          waitUntil: 'domcontentloaded'
        })
      )
      await page.getByRole('tab', { name: 'Settings', exact: true }).click()
      await acceptExactConfirm(
        page,
        'Permanently delete this Campaign?',
        page.getByRole('button', { name: 'Delete', exact: true })
      )
      await expect(page).toHaveURL(
        (url) =>
          url.origin === origin &&
          url.pathname === '/campaigns' &&
          Boolean(url.searchParams.get('campaignId'))
      )
      await expect(
        page
          .getByRole('region', { name: 'Campaign deletion progress' })
          .getByText(/^(Deleting|Deleted)$/)
      ).toBeVisible()
    }
    await input.verifyStage({ stage: 'deleted', publicId: originalId })
    await assertHealthy(page, diagnostics)
    await navigateAuthenticated(page, session, () =>
      page.goto(`${origin}/campaigns`, { waitUntil: 'domcontentloaded' })
    )
    await page.screenshot({ caret: 'initial', fullPage: true, path: finalShot })
    await assertHealthy(page, diagnostics)
  } finally {
    // Existing fixture traces are retained only in ignored local evidence; do not print their payloads.
    await context.tracing.stop({ path: trace }).catch(() => undefined)
    await context.close().catch(() => undefined)
    await browser.close()
    await writeFile(
      `${input.evidenceDirectory}/campaign-lifecycle-diagnostics.json`,
      JSON.stringify({ diagnostics }, null, 2)
    )
  }
}

function campaignPublicId(page: Page): string {
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean)
  if (
    segments.length !== 3 ||
    segments[0] !== 'campaigns' ||
    segments[1] === 'new' ||
    !segments[1] ||
    !segments[2]
  )
    throw new Error(`Expected a Campaign detail route, received ${page.url()}.`)
  return segments[1]
}

async function openCopy(page: Page, publicId: string) {
  await page
    .getByTestId(`campaign-${publicId}`)
    .getByRole('button', { name: 'Copy', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Copy Campaign', exact: true })).toBeVisible()
}

async function navigateAuthenticated(
  page: Page,
  session: { authenticated: boolean },
  navigation: () => Promise<unknown>
) {
  session.authenticated = false
  await navigation()
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await waitForRouterIdle(page)
}

function captureDiagnostics(page: Page, currentStage: () => string, diagnostics: string[]) {
  const record = (kind: string, detail: string) => {
    const entry = `${currentStage()}: ${kind} ${detail.slice(0, 3000)}`
    diagnostics.push(entry)
    return entry
  }
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      record('console', message.text())
  })
  page.on('pageerror', (error) => record('pageerror', error.message))
  const tolerateNavigationAbort = watchNavigationAbortedRequests(page)
  page.on('requestfailed', (request) => {
    const entry = record(
      'requestfailed',
      `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ''}`
    )
    tolerateNavigationAbort(request, () => diagnostics.splice(diagnostics.lastIndexOf(entry), 1))
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      record('response', `${response.status()} ${new URL(response.url()).pathname}`)
  })
}

async function assertHealthy(page: Page, diagnostics: string[]) {
  await expect(page.locator('[data-legacy-campaign], [data-legacy-api]')).toHaveCount(0)
  if (diagnostics.length > 0)
    throw new Error(`Campaign lifecycle diagnostics: ${diagnostics.join(' | ')}`)
}
async function acceptExactConfirm(
  page: Page,
  message: string,
  trigger: ReturnType<Page['getByRole']>
) {
  const confirmation = new Promise<void>((resolve, reject) => {
    page.once('dialog', (dialog) => {
      if (dialog.type() !== 'confirm' || dialog.message() !== message) {
        void dialog.dismiss()
        reject(new Error(`Unexpected confirmation: ${dialog.type()} ${dialog.message()}`))
        return
      }
      void dialog.accept().then(resolve, reject)
    })
  })
  await Promise.all([trigger.click(), confirmation])
}

async function selectOption(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
