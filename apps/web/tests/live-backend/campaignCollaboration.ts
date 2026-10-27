import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect, type Page, type Request } from '@playwright/test'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'

type CampaignCollaborationStage =
  | 'table-sent'
  | 'table-edited'
  | 'table-unsent'
  | 'party-sent'
  | 'direct-sent'
  | 'notebook-created'
  | 'notebook-updated'
  | 'notebook-deleted'
  | 'gm-private-rolled'
  | 'gm-table-rolled'

type CampaignAccount = {
  email: string
  password: string
  username: string
}

type CampaignCollaborationVerificationInput = {
  owner: CampaignAccount
  player: CampaignAccount
  publicId: string
  evidenceDirectory: string
  verifyState: (stage: CampaignCollaborationStage) => Promise<void>
}

type CampaignCollaborationVerificationResult = {
  globalDiagnostics: string[]
}

const origin = 'http://localhost:3000'
const tableOriginal = 'P14 table original'
const tableEdited = 'P14 table edited'
const directOnly = 'P14 direct only'
const sharedNote = 'P14 shared note'
const sharedNoteUpdated = 'P14 shared note updated'
const privateNote = 'P14 private note'

export async function verifyCampaignCollaborationBrowser(
  input: CampaignCollaborationVerificationInput
): Promise<CampaignCollaborationVerificationResult> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  let stage = 'sign in'
  let owner: Page | undefined
  let player: Page | undefined

  try {
    const ownerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    const playerContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce'
    })
    // Each actor reaches the web app from its own client IP, as two players do behind the
    // Cloudflare edge. Local workerd keeps a supplied CF-Connecting-IP, so the auth proxy signs it
    // and sign-in rate limits key per actor. Only same-origin requests carry it.
    for (const [context, clientIp] of [
      [ownerContext, '198.51.100.11'],
      [playerContext, '198.51.100.12']
    ] as const) {
      await context.route(`${origin}/**`, (route) =>
        route.fallback({ headers: { ...route.request().headers(), 'cf-connecting-ip': clientIp } })
      )
    }
    ownerContext.setDefaultTimeout(30_000)
    playerContext.setDefaultTimeout(30_000)
    ownerContext.setDefaultNavigationTimeout(90_000)
    playerContext.setDefaultNavigationTimeout(90_000)
    owner = await ownerContext.newPage()
    player = await playerContext.newPage()
    const ownerSession = watchAuthenticatedSession(owner)
    const playerSession = watchAuthenticatedSession(player)
    captureDiagnostics(owner, 'owner', () => stage, diagnostics, abortedRequests)
    captureDiagnostics(player, 'player', () => stage, diagnostics, abortedRequests)

    await Promise.all([
      signIn(owner, input.owner, ownerSession),
      signIn(player, input.player, playerSession)
    ])

    stage = 'open campaign'
    await Promise.all([
      openCampaign(owner, input.publicId, ownerSession),
      openCampaign(player, input.publicId, playerSession)
    ])
    await Promise.all([openChat(owner), openChat(player)])
    await expect(player.getByRole('button', { name: 'Party', exact: true })).toBeVisible()
    await expect(owner.getByRole('button', { name: 'Party', exact: true })).toHaveCount(0)

    stage = 'table message'
    await owner.getByRole('textbox', { name: 'Message Table' }).fill(tableOriginal)
    await owner.getByRole('textbox', { name: 'Message Table' }).press('Enter')
    await expect(player.getByRole('log', { name: 'Table history' })).toContainText(tableOriginal)
    await input.verifyState('table-sent')

    stage = 'table edit'
    owner.once('dialog', (dialog) => void dialog.accept(tableEdited))
    await owner.getByRole('button', { name: 'Message actions' }).click()
    await owner.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    await expect(player.getByRole('log', { name: 'Table history' })).toContainText(tableEdited)
    await input.verifyState('table-edited')

    stage = 'table unsend'
    await owner.getByRole('button', { name: 'Message actions' }).click()
    await owner.getByRole('menuitem', { name: 'Unsend', exact: true }).click()
    await expect(player.getByRole('log', { name: 'Table history' })).toContainText('Message unsent')
    await expect(player.getByRole('log', { name: 'Table history' })).not.toContainText(tableEdited)
    await input.verifyState('table-unsent')

    stage = 'party message'
    await player.getByRole('button', { name: 'Party', exact: true }).click()
    await player.getByRole('textbox', { name: 'Message Party' }).fill('P14 party only')
    await player.getByRole('textbox', { name: 'Message Party' }).press('Enter')
    await expect(player.getByRole('log', { name: 'Party history' })).toContainText('P14 party only')
    await expect(owner.getByRole('log', { name: 'Table history' })).not.toContainText(
      'P14 party only'
    )
    await input.verifyState('party-sent')

    stage = 'direct message'
    await owner.getByRole('button', { name: 'Direct messages' }).click()
    await owner.getByRole('menuitem', { name: `@${input.player.username}`, exact: true }).click()
    await owner.getByRole('textbox', { name: `Message @${input.player.username}` }).fill(directOnly)
    await owner.getByRole('textbox', { name: `Message @${input.player.username}` }).press('Enter')
    await expect(
      owner.getByRole('log', { name: `@${input.player.username} history` })
    ).toContainText(directOnly)
    await input.verifyState('direct-sent')
    await player.getByRole('button', { name: 'Direct messages' }).click()
    await player.getByRole('menuitem', { name: new RegExp(`@${input.owner.username}`) }).click()
    await expect(
      player.getByRole('log', { name: `@${input.owner.username} history` })
    ).toContainText(directOnly)
    await owner.getByRole('button', { name: 'Table', exact: true }).click()
    await expect(owner.getByRole('log', { name: 'Table history' })).toContainText('Message unsent')
    await expect(owner.getByRole('log', { name: 'Table history' })).not.toContainText(directOnly)
    await owner.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/campaign-collaboration-chat.png`,
      fullPage: true
    })

    stage = 'notebook create'
    await Promise.all([selectNotes(owner), selectNotes(player)])
    await expect(player.getByText(privateNote, { exact: true })).toHaveCount(0)
    const ownerNotebook = owner.getByRole('region', { name: 'General notes' })
    const creator = ownerNotebook
      .getByRole('heading', { name: 'New section', exact: true })
      .locator('..')
    await creator.getByRole('textbox', { name: 'Section title' }).fill(sharedNote)
    const visibility = creator.getByRole('combobox', { name: 'Visibility' })
    await expect(visibility).toHaveValue('Private')
    await visibility.click()
    await owner.getByRole('option', { name: 'Shared with party', exact: true }).click()
    await expect(visibility).toHaveValue('Shared with party')
    await creator.getByLabel('Notes', { exact: true }).fill('Shared preparation')
    await creator.getByRole('button', { name: 'Create section', exact: true }).click()
    await expect(creator.getByRole('textbox', { name: 'Section title' })).toHaveValue('')
    await input.verifyState('notebook-created')
    await expect(player.getByRole('heading', { name: sharedNote, exact: true })).toBeVisible()

    // The GM also lists the driver's own private note, and the list order shifts as notes save, so
    // each section is found by the title it currently holds.
    const sectionTitled = (title: string) => ownerNotebook.locator(`input[value="${title}"]`)
    stage = 'notebook update'
    await sectionTitled(sharedNote).fill(sharedNoteUpdated)
    await expect(player.getByText(sharedNoteUpdated, { exact: true })).toBeVisible()
    await input.verifyState('notebook-updated')

    stage = 'notebook delete'
    await sectionTitled(sharedNoteUpdated)
      .locator('xpath=ancestor::*[.//button[normalize-space()="Delete"]][1]')
      .getByRole('button', { name: 'Delete', exact: true })
      .click()
    await expect(player.getByText(sharedNoteUpdated, { exact: true })).toHaveCount(0)
    await input.verifyState('notebook-deleted')
    await player.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/campaign-collaboration-notes.png`,
      fullPage: true
    })

    stage = 'GM private roll'
    await openChat(player)
    const playerTableHistory = player.getByRole('log', { name: 'Table history' })
    await expect(playerTableHistory).toContainText('Message unsent')
    const playerTableBeforePrivateRoll = await playerTableHistory.textContent()
    await rollManualDice(owner, 'PRIVATE')
    await expect(owner.getByText(/^Rolled \d+$/).last()).toBeVisible()
    await expect.poll(() => playerTableHistory.textContent()).toBe(playerTableBeforePrivateRoll)
    await input.verifyState('gm-private-rolled')

    stage = 'GM table roll'
    await rollManualDice(owner, 'TABLE')
    await expect(playerTableHistory).toContainText('Rolled 1d20:')
    await input.verifyState('gm-table-rolled')
    await owner.screenshot({
      caret: 'initial',
      path: `${input.evidenceDirectory}/campaign-collaboration-rolls.png`,
      fullPage: true
    })

    return { globalDiagnostics: diagnostics }
  } catch (error) {
    await Promise.all([
      owner?.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/campaign-collaboration-owner-failure.png`,
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/campaign-collaboration-player-failure.png`,
        fullPage: true
      })
    ])
    const message =
      error instanceof Error ? error.message : 'Campaign collaboration browser failed.'
    throw new Error(scrub(`${message} | global diagnostics: ${diagnostics.join(' | ')}`, input))
  } finally {
    await browser.close()
    diagnostics.push(...abortedRequests.values())
    await writeFile(
      `${input.evidenceDirectory}/campaign-collaboration-diagnostics.json`,
      JSON.stringify({ diagnostics: diagnostics.map((value) => scrub(value, input)) }, null, 2)
    )
  }
}

export function watchAuthenticatedSession(page: Page) {
  const session = { authenticated: false }
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const message: unknown = JSON.parse(payload.toString())
      if (!message || typeof message !== 'object' || !('modifications' in message)) return
      if (!Array.isArray(message.modifications)) return
      for (const modification of message.modifications) {
        if (!modification || typeof modification !== 'object' || !('value' in modification))
          continue
        const snapshot = authSessionSnapshotDtoSchema.safeParse(modification.value)
        if (snapshot.success && snapshot.data.user !== null) session.authenticated = true
      }
    })
  })
  return session
}

export async function signIn(
  page: Page,
  account: CampaignAccount,
  session: { authenticated: boolean }
): Promise<void> {
  await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await waitForRouterIdle(page)
  await page.getByRole('textbox', { name: 'Email or username' }).fill(account.email)
  await page.locator('input[name="password"]').fill(account.password)
  const submit = async () => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' &&
          new URL(candidate.url()).pathname === '/api/auth/sign-in/email'
      ),
      page.getByRole('button', { name: 'Sign in', exact: true }).click()
    ])
    return response
  }
  let response = await submit()
  if (response.status() === 429 || response.status() === 500) {
    const retrySeconds = response.status() === 500 ? 1 : Number(response.headers()['x-retry-after'])
    if (!Number.isInteger(retrySeconds) || retrySeconds < 1 || retrySeconds > 10)
      throw new Error("Browser sign-in requires the server's bounded retry delay.")
    await page.waitForTimeout(retrySeconds * 1000)
    response = await submit()
  }
  if (response.status() >= 400)
    throw new Error('Browser sign-in failed with status ' + response.status() + '.')
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60_000 })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await page.waitForLoadState('load')
  await waitForRouterIdle(page)
}

async function openCampaign(
  page: Page,
  publicId: string,
  session: { authenticated: boolean }
): Promise<void> {
  session.authenticated = false
  await page.goto(`${origin}/campaigns/${publicId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await waitForRouterIdle(page)
  await expect(page).toHaveTitle(/Artificer/i)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

async function openChat(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open Campaign chat', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Campaign conversations' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Message Table' })).toBeVisible()
}

async function selectNotes(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close Campaign chat', exact: true }).click()
  await page.getByRole('tab', { name: 'Notes', exact: true }).click()
  await expect(page.getByRole('region', { name: 'General notes' })).toBeVisible()
}

async function rollManualDice(page: Page, destination: 'PRIVATE' | 'TABLE'): Promise<void> {
  await page.getByRole('button', { name: 'Open manual dice roller', exact: true }).click()
  const roller = page.getByRole('dialog')
  // The GM roller offers Public or Private and a new profile starts Public (Q14), so choose explicitly.
  const label = destination === 'TABLE' ? 'Public' : 'Private'
  await roller.getByText(label, { exact: true }).click()
  await expect(roller.getByRole('radio', { name: label, exact: true })).toBeChecked()
  await roller.getByRole('button', { name: 'Roll', exact: true }).click()
  await page.keyboard.press('Escape')
}

/**
 * Waits until the router has no load in flight. `state.status` is not used: TanStack Router sets it
 * back to idle from a mounted Transitioner, so a navigation that finishes during hydration can leave
 * it `pending` on a fully loaded page.
 */
export async function waitForRouterIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const state = (
      window as Window & {
        __TSR_ROUTER__?: {
          state: { isLoading: boolean; matches: { status: string }[] }
        }
      }
    ).__TSR_ROUTER__?.state
    return !!state && !state.isLoading && state.matches.every((match) => match.status !== 'pending')
  })
}

/**
 * Sign-in ends in a hard navigation (`window.location.assign`), which aborts the old document's
 * in-flight requests (session verification, lazy route chunks). The abort is reported before the
 * navigation's own request or commit event, so it cannot be judged when it arrives. Callers record
 * every failure as a diagnostic, then pass the failed request and a function that removes that
 * diagnostic. The returned function evaluates deferred: only an exact `net::ERR_ABORTED` is
 * retracted, and only once a main-frame commit has happened after the request was issued (at once if
 * that commit is already counted, otherwise at the next one). Any other failure text, or an abort
 * with no later commit, stays a diagnostic for the caller's assertion.
 */
export function watchNavigationAbortedRequests(
  page: Page
): (request: Request, retract: () => void) => void {
  const commitsAtIssue = new WeakMap<Request, number>()
  const awaitingCommit: (() => void)[] = []
  let commits = 0
  page.on('request', (request) => commitsAtIssue.set(request, commits))
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return
    commits++
    for (const retract of awaitingCommit.splice(0)) retract()
  })
  return (request, retract) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') return
    if ((commitsAtIssue.get(request) ?? commits) < commits) retract()
    else awaitingCommit.push(retract)
  }
}

export function captureDiagnostics(
  page: Page,
  account: 'owner' | 'player',
  currentStage: () => string,
  diagnostics: string[],
  abortedRequests: Map<string, string>
): void {
  const tolerateNavigationAbort = watchNavigationAbortedRequests(page)
  const record = (kind: string, detail: string) => {
    const entry = `${account} ${currentStage()}: ${kind} ${detail.slice(0, 3000)}`
    diagnostics.push(entry)
  }
  page.on('console', (message) => {
    if (message.type() === 'error') record('console', message.text())
  })
  page.on('pageerror', (error) => record('pageerror', error.message))
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') {
      const key = `${request.method()} ${request.url()}`
      abortedRequests.set(
        key,
        `${account} ${currentStage()}: requestfailed ${request.method()} ${new URL(request.url()).pathname} net::ERR_ABORTED`
      )
      tolerateNavigationAbort(request, () => abortedRequests.delete(key))
      return
    }
    record(
      'requestfailed',
      `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ''}`
    )
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      record('response', `${response.status()} ${new URL(response.url()).pathname}`)
  })
}

function scrub(value: string, input: CampaignCollaborationVerificationInput): string {
  return value
    .replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
    .replaceAll(input.owner.email, '[owner email]')
    .replaceAll(input.owner.password, '[owner password]')
    .replaceAll(input.player.email, '[player email]')
    .replaceAll(input.player.password, '[player password]')
}
