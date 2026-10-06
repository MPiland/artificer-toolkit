import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect as playwrightExpect, type Locator, type Page } from '@playwright/test'
import { authSessionSnapshotDtoSchema } from '@artificer-toolkit/schema/api/auth'

export type SocialBrowserStage =
  | 'listing-open'
  | 'application-submitted'
  | 'application-accepted'
  | 'invitation-accepted'
  | 'preference-mature'
  | 'preference-standard'
  | 'profile-reported'
  | 'profile-review'
  | 'profile-suspended'
  | 'profile-restored'
  | 'profile-resolved'
  | 'listing-reported'
  | 'listing-review'
  | 'listing-hidden'
  | 'listing-restored'
  | 'listing-resolved'
  | 'blocked'
  | 'unblocked'
  | 'listing-updated'
  | 'listing-closed'
  | 'listing-draft'
  | 'listing-reopened'

type SocialAccount = {
  email: string
  password: string
  username: string
  profileId: string
}

type SocialBrowserInput = {
  owner: SocialAccount
  player: SocialAccount
  invitee: SocialAccount
  moderator: SocialAccount
  evidenceDirectory: string
  verifyState: (stage: SocialBrowserStage) => Promise<void>
  readHandles: () => Promise<{
    listingId: string | null
    profileReportId: string | null
    listingReportId: string | null
  }>
}

const origin = 'http://localhost:3000'
const expect = playwrightExpect.configure({ timeout: 30_000 })
const listingSummary = 'P17 shitstorm discovery fixture'

export async function verifySocialBrowser(input: SocialBrowserInput): Promise<void> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const successfulRequests = new Set<string>()
  const privacy = {
    documents: 0,
    queryFrames: 0,
    maskedQueryFrames: 0,
    mutations: 0,
    consoleMessages: 0,
    requestBodies: 0,
    outgoingFrames: 0
  }
  const privacyReads: Promise<void>[] = []
  let stage = 'sign in'
  let owner: Page | undefined
  let player: Page | undefined
  let invitee: Page | undefined
  let moderator: Page | undefined

  try {
    const contexts = await Promise.all(
      ['owner', 'player', 'invitee', 'moderator'].map(async (actor) => {
        const context = await browser.newContext({
          viewport:
            actor === 'player' || actor === 'invitee'
              ? { width: 390, height: 844 }
              : { width: 1280, height: 900 },
          reducedMotion: 'reduce'
        })
        context.setDefaultTimeout(30_000)
        context.setDefaultNavigationTimeout(90_000)
        return context
      })
    )
    ;[owner, player, invitee, moderator] = await Promise.all(
      contexts.map((context) => context.newPage())
    )
    if (!owner || !player || !invitee || !moderator) throw new Error('Could not open Social pages.')
    for (const page of [player, invitee]) {
      const inspect = (body: string, channel: string) => {
        if (body.includes('shitstorm'))
          diagnostics.push(`Standard source text leaked through ${channel}.`)
      }
      page.on('response', (response) => {
        if (
          response.status() !== 200 ||
          response.request().resourceType() !== 'document' ||
          new URL(response.url()).origin !== origin
        )
          return
        privacyReads.push(
          (async () => {
            try {
              const body = await response.text()
              privacy.documents++
              inspect(body, 'SSR document')
            } catch {
              diagnostics.push('Standard SSR document could not be inspected.')
            }
          })()
        )
      })
      page.on('websocket', (socket) => {
        socket.on('framesent', ({ payload }) => {
          privacy.outgoingFrames++
          inspect(payload.toString(), 'outgoing WebSocket request')
        })
        socket.on('framereceived', ({ payload }) => {
          const body = payload.toString()
          const message: unknown = JSON.parse(body)
          inspect(body, 'Realtime payload or server log')
          if (!message || typeof message !== 'object' || !('type' in message)) return
          if (message.type === 'Transition') {
            privacy.queryFrames++
            if (body.includes('****storm')) privacy.maskedQueryFrames++
          }
          if (message.type === 'MutationResponse') privacy.mutations++
        })
      })
      page.on('console', (message) => {
        privacy.consoleMessages++
        inspect(message.text(), 'browser console')
      })
      page.on('request', (request) => {
        const body = request.postData()
        if (body) {
          privacy.requestBodies++
          inspect(body, 'outgoing request or telemetry')
        }
      })
    }
    const ownerSession = watchAuthenticatedSession(owner)
    const playerSession = watchAuthenticatedSession(player)
    const inviteeSession = watchAuthenticatedSession(invitee)
    const moderatorSession = watchAuthenticatedSession(moderator)
    captureDiagnostics(
      owner,
      'owner',
      () => stage,
      diagnostics,
      abortedRequests,
      successfulRequests
    )
    captureDiagnostics(
      player,
      'player',
      () => stage,
      diagnostics,
      abortedRequests,
      successfulRequests
    )
    captureDiagnostics(
      invitee,
      'invitee',
      () => stage,
      diagnostics,
      abortedRequests,
      successfulRequests
    )
    captureDiagnostics(
      moderator,
      'moderator',
      () => stage,
      diagnostics,
      abortedRequests,
      successfulRequests
    )

    // Better Auth resets this counter after ten idle seconds, not a fixed window.
    await owner.waitForTimeout(11_000)
    await signIn(owner, input.owner, ownerSession)
    await player.waitForTimeout(11_000)
    await signIn(player, input.player, playerSession)
    await invitee.waitForTimeout(11_000)
    await signIn(invitee, input.invitee, inviteeSession)
    await moderator.waitForTimeout(11_000)
    await signIn(moderator, input.moderator, moderatorSession)

    stage = 'create listing'
    await owner.goto(`${origin}/social`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await owner.getByRole('button', { name: 'New Post', exact: true }).click()
    await selectOption(owner, 'Campaign', 'Encounter execution fixture')
    await getField(owner, 'Summary').fill(listingSummary)
    await selectOption(owner, 'Audience', 'Public — discovery and applications')
    await selectFirstOption(owner, 'System and ruleset')
    await selectOption(owner, 'Play mode', 'Online')
    await getField(owner, 'Seat capacity').fill('2')
    await selectOption(owner, 'Schedule type', 'Flexible')
    await getField(owner, 'IANA timezone').fill('America/Chicago')
    await getField(owner, 'Schedule summary').fill('Flexible fixture schedule')
    await getField(owner, 'Lines and veils').check()
    await getField(owner, 'Content guidance').fill('Content guidance fixture.')
    await getField(owner, 'Attendance policy').fill('Attendance policy fixture.')
    await getField(owner, 'Allowed content and rules').fill('Allowed content fixture.')
    await getField(owner, 'Table conduct').fill('Table conduct fixture.')
    await getField(owner, 'Content boundaries').fill('Content boundaries fixture.')
    await getField(owner, 'How safety practices are used').fill('Safety details fixture.')
    await owner.getByRole('button', { name: 'Save listing', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'Open listing', exact: true })).toBeVisible()
    await owner.getByRole('button', { name: 'Open listing', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'Close listing', exact: true })).toBeVisible()
    await input.verifyState('listing-open')
    const listingId = (await input.readHandles()).listingId
    if (!listingId) throw new Error('Listing handle was unavailable after opening the listing.')

    stage = 'submit application'
    await player.goto(`${origin}/social?view=discover&query=P17`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    const discoveryResults = player.locator('[aria-label="Open public tables"]')
    await expect(player.getByRole('button', { name: 'New Post', exact: true })).toBeDisabled()
    const fixtureLink = discoveryResults.locator(`a[href*="${listingId}"]`)
    await expect(fixtureLink).toBeVisible()
    await expect(discoveryResults).not.toContainText('shitstorm')
    await captureMobile(player, `${input.evidenceDirectory}/social-mobile-discovery.png`)
    await fixtureLink.click()
    await expect(player.getByRole('button', { name: 'Apply to join', exact: true })).toBeVisible()
    await player.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
    await player.getByRole('button', { name: 'Apply to join', exact: true }).click()
    await getField(player, 'Message to the host').fill('P17 application message')
    await player.getByRole('button', { name: 'Send application', exact: true }).click()
    await expect(player.getByText('Application sent to the host.', { exact: true })).toBeVisible()
    await input.verifyState('application-submitted')

    stage = 'accept application'
    await owner.setViewportSize({ width: 390, height: 844 })
    await owner.goto(`${origin}/social/hosting/${listingId}/edit?section=applications`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await expect(owner.getByRole('heading', { name: 'Applications for this table' })).toBeVisible()
    await owner.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(owner.getByText('Accepted', { exact: true })).toBeVisible()
    await input.verifyState('application-accepted')
    await captureMobile(owner, `${input.evidenceDirectory}/social-mobile-host-applications.png`)
    await player.goto(`${origin}/social?view=applications`, { waitUntil: 'domcontentloaded' })
    await expect(player.getByText('Accepted', { exact: true })).toBeVisible()
    await captureMobile(player, `${input.evidenceDirectory}/social-mobile-applications.png`)

    stage = 'accept invitation'
    await owner.getByRole('button', { name: 'Invite player', exact: true }).click()
    await getField(owner, 'Username').fill(input.invitee.username)
    await owner.getByRole('button', { name: 'Send invitation', exact: true }).click()
    await expect(
      owner.getByText('Invitation added to the player inbox.', { exact: true })
    ).toBeVisible()
    await invitee.goto(`${origin}/social?view=invitations`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await invitee.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(invitee.getByText('Invitation accepted.', { exact: true })).toBeVisible()
    await input.verifyState('invitation-accepted')
    await captureMobile(invitee, `${input.evidenceDirectory}/social-mobile-invitations.png`)

    stage = 'mature preference'
    await player.goto(`${origin}/settings/preferences`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await expect(player.getByRole('radio', { name: 'Mature', exact: true })).toBeEnabled()
    await player
      .locator('label')
      .filter({ hasText: /^Mature$/ })
      .click()
    const ageDialog = player.getByRole('dialog', { name: 'Confirm you are 18 or older' })
    await getField(ageDialog, 'Date of birth').fill('1990-01-01')
    await ageDialog
      .getByRole('button', { name: 'Confirm age and show mature text', exact: true })
      .click()
    await expect(ageDialog).toHaveCount(0)
    await input.verifyState('preference-mature')
    await player.goto(`${origin}/settings/preferences`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await player.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(player.getByRole('radio', { name: 'Mature', exact: true })).toBeChecked()
    await expect(player.getByRole('radio', { name: 'Standard', exact: true })).toBeEnabled()
    await player
      .locator('label')
      .filter({ hasText: /^Standard$/ })
      .click()
    await expect(player.getByRole('radio', { name: 'Standard', exact: true })).toBeChecked()
    await input.verifyState('preference-standard')

    stage = 'report profile'
    await owner.goto(`${origin}/social/profiles/${input.invitee.profileId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await submitReport(owner, 'Harassment', 'P17 fixture profile report')
    await input.verifyState('profile-reported')
    const profileReportId = (await input.readHandles()).profileReportId
    if (!profileReportId) throw new Error('Profile report handle was unavailable.')
    await Promise.all([
      owner.goto(`${origin}/social/hosting/${listingId}/edit?section=listing`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000
      }),
      invitee.goto(`${origin}/settings/preferences`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000
      })
    ])

    stage = 'moderate profile'
    await moderator.setViewportSize({ width: 390, height: 844 })
    await moderator.goto(`${origin}/social/moderation`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await openReport(moderator, profileReportId)
    await captureMobile(moderator, `${input.evidenceDirectory}/social-mobile-moderation.png`)
    await recordModerationAction(moderator, 'Start review', 'P17 profile review')
    await input.verifyState('profile-review')
    await recordModerationAction(moderator, 'Suspend profile', 'P17 profile suspend')
    await input.verifyState('profile-suspended')
    await recordModerationAction(moderator, 'Restore profile', 'P17 profile restore')
    await input.verifyState('profile-restored')
    await recordModerationAction(moderator, 'Resolve report', 'P17 profile resolve')
    await input.verifyState('profile-resolved')

    stage = 'report listing'
    await player.goto(`${origin}/social/listings/${listingId}/fixture`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await submitReport(player, 'Privacy', 'P17 fixture listing report')
    await input.verifyState('listing-reported')
    const listingReportId = (await input.readHandles()).listingReportId
    if (!listingReportId) throw new Error('Listing report handle was unavailable.')
    await player.goto(`${origin}/social?view=discover&query=P17`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    const fixtureDiscoveryLink = player
      .locator('[aria-label="Open public tables"]')
      .locator(`a[href*="${listingId}"]`)
    await expect(fixtureDiscoveryLink).toBeVisible()

    stage = 'moderate listing'
    await openReport(moderator, listingReportId)
    await recordModerationAction(moderator, 'Start review', 'P17 listing review')
    await input.verifyState('listing-review')
    await recordModerationAction(moderator, 'Hide listing', 'P17 listing hide')
    // The player's page learns of the moderator's action through its own live subscription.
    await expect(fixtureDiscoveryLink).toHaveCount(0, { timeout: 30_000 })
    await input.verifyState('listing-hidden')
    await recordModerationAction(moderator, 'Restore listing', 'P17 listing restore')
    await expect(fixtureDiscoveryLink).toBeVisible({ timeout: 30_000 })
    await input.verifyState('listing-restored')
    await recordModerationAction(moderator, 'Resolve report', 'P17 listing resolve')
    await input.verifyState('listing-resolved')

    stage = 'block profile'
    await owner.goto(`${origin}/social/profiles/${input.invitee.profileId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await owner.getByRole('button', { name: 'Block', exact: true }).click()
    await expect(owner.getByRole('heading', { name: 'Blocked profile', exact: true })).toBeVisible()
    await input.verifyState('blocked')
    await owner.getByRole('button', { name: 'Unblock', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'Block', exact: true })).toBeVisible()
    await input.verifyState('unblocked')

    stage = 'update listing'
    await owner.goto(`${origin}/social/hosting/${listingId}/edit?section=listing`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000
    })
    await getField(owner, 'Summary').fill('P17 updated fixture summary')
    await owner.getByRole('button', { name: 'Save listing', exact: true }).click()
    await expect(owner.getByText('Listing saved.', { exact: true })).toBeVisible()
    await input.verifyState('listing-updated')
    await owner.getByRole('button', { name: 'Close listing', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'Return to draft', exact: true })).toBeVisible()
    await input.verifyState('listing-closed')
    await owner.getByRole('button', { name: 'Return to draft', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'Open listing', exact: true })).toBeVisible()
    await input.verifyState('listing-draft')
    await owner.getByRole('button', { name: 'Open listing', exact: true }).click()
    await expect(owner.getByRole('button', { name: 'Close listing', exact: true })).toBeVisible()
    await input.verifyState('listing-reopened')
    await safeScreenshot(owner, `${input.evidenceDirectory}/social-final.png`)

    await Promise.all(privacyReads)
    expect(privacy.documents).toBeGreaterThan(0)
    expect(privacy.maskedQueryFrames).toBeGreaterThan(0)
    expect(privacy.mutations).toBeGreaterThan(0)
    reconcileAbortedRequests(abortedRequests, successfulRequests, diagnostics)
    if (diagnostics.length)
      throw new Error(`Social browser diagnostics: ${diagnostics.join(' | ')}`)
  } catch (error) {
    await Promise.allSettled([
      owner && safeScreenshot(owner, `${input.evidenceDirectory}/social-owner-failure.png`),
      player && safeScreenshot(player, `${input.evidenceDirectory}/social-player-failure.png`),
      invitee && safeScreenshot(invitee, `${input.evidenceDirectory}/social-invitee-failure.png`),
      moderator &&
        safeScreenshot(moderator, `${input.evidenceDirectory}/social-moderator-failure.png`)
    ])
    const message = error instanceof Error ? error.message : 'Social browser failed.'
    throw new Error(
      scrub(`${message} | stage: ${stage} | diagnostics: ${diagnostics.join(' | ')}`, input)
    )
  } finally {
    await browser.close()
    await writeFile(
      `${input.evidenceDirectory}/standard-transport.json`,
      JSON.stringify(privacy, null, 2)
    )
    await writeFile(
      `${input.evidenceDirectory}/social-diagnostics.json`,
      JSON.stringify(
        { stage, diagnostics: diagnostics.map((value) => scrub(value, input)) },
        null,
        2
      )
    )
  }
}

async function captureMobile(page: Page, path: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow, 'Mobile Social page must fit the viewport.').toBeLessThanOrEqual(1)
  await safeScreenshot(page, path)
}

function watchAuthenticatedSession(page: Page) {
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

async function signIn(
  page: Page,
  account: SocialAccount,
  session: { authenticated: boolean }
): Promise<void> {
  await page.goto(`${origin}/sign-in`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.getByRole('textbox', { name: 'Email or username' }).fill(account.email)
  await page.locator('input[name="password"]').fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 60_000 })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
}

async function selectOption(page: Page | Locator, label: string, option: string): Promise<void> {
  await getField(page, label).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function selectFirstOption(page: Page, label: string): Promise<void> {
  await getField(page, label).click()
  await page.locator('[role="option"]:visible').first().click()
}

async function submitReport(page: Page, reason: string, details: string): Promise<void> {
  await page.getByRole('button', { name: 'Report', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Report to moderators' })
  await getField(dialog, 'Reason').click()
  await page.getByRole('option', { name: reason, exact: true }).click()
  await getField(dialog, 'What happened?').fill(details)
  await dialog.getByRole('button', { name: 'Submit report', exact: true }).click()
  await expect(page.getByText('Report submitted for review.', { exact: true })).toBeVisible()
}

async function openReport(page: Page, reportId: string): Promise<void> {
  const report = page.locator(`article[data-report-id="${reportId}"]`)
  while ((await report.count()) === 0) {
    const loadMore = page.getByRole('button', { name: 'Load more reports', exact: true })
    if (!(await loadMore.isVisible().catch(() => false))) break
    await loadMore.click()
    await page.waitForTimeout(100)
  }
  await expect(report).toHaveCount(1)
  await expect(report).toBeVisible()
  await report.getByRole('button', { name: 'Open report', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Opened report', exact: true })).toBeVisible()
}

async function recordModerationAction(page: Page, action: string, reason: string): Promise<void> {
  await selectOption(page, 'Action', action)
  await getField(page, 'Audit reason').fill(reason)
  await page.getByRole('button', { name: 'Record action', exact: true }).click()
  await expect(getField(page, 'Audit reason')).toHaveValue('')
}

async function safeScreenshot(page: Page, path: string): Promise<void> {
  await page.screenshot({
    caret: 'initial',
    fullPage: true,
    mask: [page.locator('input')],
    path
  })
}

function getField(page: Page | Locator, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return page
    .getByLabel(new RegExp(`^${escaped}\\s*\\*?\\s*$`))
    .and(page.locator('input, textarea, select'))
}

function captureDiagnostics(
  page: Page,
  actor: string,
  currentStage: () => string,
  diagnostics: string[],
  abortedRequests: Map<string, string>,
  successfulRequests: Set<string>
): void {
  const record = (kind: string, detail: string) =>
    diagnostics.push(`${actor} ${currentStage()}: ${kind} ${detail.slice(0, 3000)}`)
  page.on('console', (message) => {
    if (message.type() === 'error') record('console', message.text())
  })
  page.on('pageerror', (error) => record('pageerror', error.message))
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/trpc/')) record('legacy request', path)
  })
  page.on('requestfailed', (request) => {
    const detail = `${request.method()} ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ''}`
    if (request.failure()?.errorText === 'net::ERR_ABORTED') {
      abortedRequests.set(
        `${request.method()} ${request.url()}`,
        `${actor} ${currentStage()}: requestfailed ${detail}`
      )
      return
    }
    record('requestfailed', detail)
  })
  page.on('response', (response) => {
    if (response.status() < 400) {
      successfulRequests.add(`${response.request().method()} ${response.url()}`)
    } else {
      record('response', `${response.status()} ${new URL(response.url()).pathname}`)
    }
  })
}

function reconcileAbortedRequests(
  abortedRequests: Map<string, string>,
  successfulRequests: Set<string>,
  diagnostics: string[]
): void {
  for (const [request, diagnostic] of abortedRequests) {
    if (!successfulRequests.has(request)) diagnostics.push(diagnostic)
  }
}

function scrub(value: string, input: SocialBrowserInput): string {
  return [input.owner, input.player, input.invitee, input.moderator].reduce(
    (safe, account) =>
      safe
        .replaceAll(account.email, '[fixture email]')
        .replaceAll(account.password, '[fixture password]'),
    value.replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
  )
}
