import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Response
} from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const campaignName = requiredValue('MANAGED_VTT_CAMPAIGN_NAME')
const gmCredentials = credentials('GM')
const gmOnlyTokenLabel = requiredValue('MANAGED_VTT_GM_ONLY_TOKEN_LABEL')
const topology = requiredTopology()
const liveSessionEndpoint = requiredLiveSessionOrigin('MANAGED_LIVE_SESSION_ENDPOINT', topology)
const playerCredentials = credentials('PLAYER')
const player2Credentials = credentials('PLAYER2')
const doorIndex = 1
const dragTokenLabel = 'Managed second player token'
const authorityReleaseWaitMs = 30_000
const liveSessionWebSocketOrigin = liveSessionEndpoint.replace(/^http/, (protocol) =>
  protocol === 'https' ? 'wss' : 'ws'
)
const warmupPairs = boundedSampleCount('VTT_USAGE_WARMUP_PAIRS', 2, 0)
const measuredPairs = boundedSampleCount('VTT_USAGE_MEASURED_PAIRS', 10, 1)
const browserLimits = {
  authoritativeP95: 1_000,
  durableP95: 250,
  durableP99: 500,
  ephemeralP95: 150,
  ruleConvergenceP95: 1_500,
  sceneConvergenceP95: 1_500
}
const pageReadyTimeoutMs = topology === 'LOCAL' ? 60_000 : 15_000
const diagnosticSections = [
  'fixture-ready',
  'door-convergence',
  'token-drag',
  'rule-convergence',
  'recovery'
] as const
const checkpointPath = process.env.MANAGED_VTT_CHECKPOINT_PATH?.trim() || null
const cleanupSignalPath = process.env.MANAGED_VTT_CLEANUP_SIGNAL?.trim() || null
const cleanupHandshakeTimeoutMs = 3 * 60_000
const startSection = diagnosticSection(process.env.MANAGED_VTT_START_SECTION, 'fixture-ready')
const endSection = diagnosticSection(process.env.MANAGED_VTT_END_SECTION, 'recovery')
const startSectionIndex = diagnosticSections.indexOf(startSection)
const endSectionIndex = diagnosticSections.indexOf(endSection)
if (endSectionIndex < startSectionIndex)
  throw new Error('Managed VTT diagnostic end section precedes its start section.')

test('connects three users through the live room and recovers a reversible scene commit', async ({
  browser
}, testInfo) => {
  test.setTimeout(10 * 60_000 + (cleanupSignalPath ? cleanupHandshakeTimeoutMs : 0))
  const clients: ManagedClient[] = []
  let failure: unknown
  let cleanupFailure: unknown
  let managedPaths: ManagedPaths | null = null
  let originalDoorAction: string | null = null
  const timings: Record<string, number> = {}
  const convergenceTimings = {
    authoritative: [] as number[],
    durable: [] as number[],
    ephemeral: [] as number[],
    ruleBound: [] as number[],
    sceneOnly: [] as number[]
  }
  const tokenDragTimings = {
    durable: [] as number[],
    ephemeral: [] as number[],
    inputToSend: [] as number[]
  }

  try {
    let gm = await openManagedClient(browser, 'GM', gmCredentials)
    clients.push(gm)
    let player = await openManagedClient(browser, 'PLAYER', playerCredentials)
    clients.push(player)
    let player2 = await openManagedClient(browser, 'PLAYER2', player2Credentials)
    clients.push(player2)
    await Promise.all([
      expectCampaignMembershipRole(gm.page, 'GM', 'OWNER'),
      expectCampaignMembershipRole(player.page, 'PLAYER', 'PLAYER'),
      expectCampaignMembershipRole(player2.page, 'PLAYER2', 'PLAYER')
    ])
    const readyStartedAt = performance.now()
    managedPaths = await resolveManagedPaths(player.page, gm)
    await openTabletop(player, managedPaths)
    await openTabletop(player2, managedPaths)
    timings.readyMs = performance.now() - readyStartedAt
    console.info(`Managed VTT ready: ${timings.readyMs.toFixed(1)}ms`)

    await expect(gm.page.getByText('Live editing available')).toBeVisible()
    await expect(gm.page.getByRole('radiogroup', { name: 'Tabletop mode' })).toBeVisible()
    await expect(player.page.getByText('Play view')).toBeVisible()
    await expect(player.page.getByRole('radiogroup', { name: 'Tabletop mode' })).toHaveCount(0)
    await expect(player2.page.getByText('Play view')).toBeVisible()
    await expect(player2.page.getByRole('radiogroup', { name: 'Tabletop mode' })).toHaveCount(0)
    await Promise.all([
      expectManagedSocket(gm),
      expectManagedSocket(player),
      expectManagedSocket(player2)
    ])
    await expectPrivateSnapshot(gm, [player, player2])
    await Promise.all([expectExactVttMapDelivery(player), expectExactVttMapDelivery(player2)])
    await recordDiagnosticCheckpoint('fixture-ready')

    originalDoorAction = await readDoorAction(gm.page, doorIndex)
    let currentDoorAction = originalDoorAction
    if (shouldRunDiagnosticSection('door-convergence')) {
      currentDoorAction = await collectDoorConvergenceTimings(
        gm,
        [player, player2],
        originalDoorAction,
        convergenceTimings,
        timings
      )
      assertConvergenceThresholds(convergenceTimings)
      await recordDiagnosticCheckpoint('door-convergence')
    }
    if (shouldRunDiagnosticSection('token-drag')) {
      await collectTokenDragTimings(
        gm,
        [player, player2],
        [player2],
        tokenDragTimings,
        convergenceTimings
      )
      assertConvergenceThresholds(convergenceTimings)
      await recordDiagnosticCheckpoint('token-drag')
    }
    if (shouldRunDiagnosticSection('rule-convergence')) {
      await collectRuleConvergenceTimings(player, managedPaths, convergenceTimings)
      assertConvergenceThresholds(convergenceTimings)
      await recordDiagnosticCheckpoint('rule-convergence')
    }
    const convergenceSummary = summarizeConvergenceTimings(convergenceTimings)

    await testInfo.attach('managed-vtt-convergence-timings', {
      body: JSON.stringify(convergenceSummary, null, 2),
      contentType: 'application/json'
    })
    console.info(`Managed VTT convergence timings: ${JSON.stringify(convergenceSummary)}`)

    await Promise.all([gm.context.close(), player.context.close(), player2.context.close()])
    timings.authorityReleaseWaitMs = authorityReleaseWaitMs
    await delay(authorityReleaseWaitMs)

    const recoveryStartedAt = performance.now()
    player2 = await openManagedClient(browser, 'PLAYER2', player2Credentials)
    clients.push(player2)
    await openTabletop(player2, managedPaths)
    await expectManagedSocket(player2)
    await expectDoorHidden(player2)

    player = await openManagedClient(browser, 'PLAYER', playerCredentials)
    clients.push(player)
    await openTabletop(player, managedPaths)
    await expectManagedSocket(player)
    await expectDoorHidden(player)

    gm = await openManagedClient(browser, 'GM', gmCredentials)
    clients.push(gm)
    await openTabletop(gm, managedPaths)
    await expectManagedSocket(gm)
    await expectDoorAction(gm, currentDoorAction)
    timings.recoveryMs = performance.now() - recoveryStartedAt
    await recordDiagnosticCheckpoint('recovery')

    await testInfo.attach('managed-vtt-timings', {
      body: JSON.stringify(
        {
          e2eDiagnosticMs: timings,
          convergenceMs: convergenceSummary,
          tokenDragVisualMs: {
            durable: tokenDragTimings.durable.length
              ? summarizeTimings(tokenDragTimings.durable)
              : null,
            ephemeral: tokenDragTimings.ephemeral.length
              ? summarizeTimings(tokenDragTimings.ephemeral)
              : null,
            inputToSend: tokenDragTimings.inputToSend.length
              ? summarizeTimings(tokenDragTimings.inputToSend)
              : null
          }
        },
        null,
        2
      ),
      contentType: 'application/json'
    })
    console.info(`Managed VTT smoke: ${JSON.stringify(timings)}`)
  } catch (error) {
    failure = error
    await testInfo.attach('managed-vtt-runtime-diagnostics', {
      body: JSON.stringify(
        clients.map(({ browserErrors, failedRequests, page, role }) => ({
          browserErrors,
          failedRequests,
          role,
          url: page.url()
        })),
        null,
        2
      ),
      contentType: 'application/json'
    })
  }

  try {
    if (originalDoorAction) {
      if (!managedPaths) throw new Error('Managed route paths were not resolved before cleanup.')
      await restoreDoorFromAuthoritativeState(browser, clients, originalDoorAction, managedPaths)
    }
  } catch (error) {
    cleanupFailure = error
    await testInfo.attach('managed-vtt-cleanup-error', {
      body: error instanceof Error ? error.message : 'Unknown cleanup failure.',
      contentType: 'text/plain'
    })
  } finally {
    await Promise.all(clients.map((client) => client.context.close()))
  }

  if (failure) throw failure
  if (cleanupFailure) throw cleanupFailure
  if (cleanupSignalPath) await requestCampaignCleanup(cleanupSignalPath)
})

/**
 * Asks the driver to delete the fixture Campaign while this run's Session Worker is still up:
 * deletion drops the Campaign's live room through that Worker.
 */
async function requestCampaignCleanup(signalPath: string): Promise<void> {
  await writeFile(`${signalPath}.requested`, '')
  await expect
    .poll(
      () =>
        readFile(`${signalPath}.done`).then(
          () => true,
          () => false
        ),
      {
        message: 'The driver did not finish deleting the fixture Campaign.',
        timeout: cleanupHandshakeTimeoutMs
      }
    )
    .toBe(true)
}

type DiagnosticSection = (typeof diagnosticSections)[number]

function diagnosticSection(
  value: string | undefined,
  fallback: DiagnosticSection
): DiagnosticSection {
  const section = value?.trim() || fallback
  if (!diagnosticSections.includes(section as DiagnosticSection))
    throw new Error(`Unknown managed VTT diagnostic section: ${section}.`)
  return section as DiagnosticSection
}

function shouldRunDiagnosticSection(section: DiagnosticSection): boolean {
  const index = diagnosticSections.indexOf(section)
  return index >= startSectionIndex && index <= endSectionIndex
}

async function recordDiagnosticCheckpoint(section: DiagnosticSection): Promise<void> {
  if (!checkpointPath || !shouldRunDiagnosticSection(section)) return
  const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')) as Record<string, unknown>
  await writeFile(
    checkpointPath,
    `${JSON.stringify({ ...checkpoint, lastCompletedSection: section }, null, 2)}\n`
  )
}

interface ManagedClient {
  assetResponses: Response[]
  browserErrors: string[]
  context: BrowserContext
  failedRequests: string[]
  liveSessionFrames: string[]
  liveSessionSentFrameTimes: number[]
  liveSessionSentFrames: string[]
  liveSessionUrls: string[]
  page: Page
  role: 'GM' | 'PLAYER' | 'PLAYER2'
  visualFramePaintPending: boolean
  visualFramePaints: VisualFramePaint[]
  visualFrameTracking: boolean
}

interface VisualFramePaint {
  paintedAt: number | null
  payload: string
  receivedAt: number
}

interface TokenDragPreview {
  position: { x: number; y: number }
  sequence: number
  tokenId: string
}

interface ManagedPaths {
  characterSheet: string
  tabletop: string
}

interface ConvergenceTimings {
  authoritative: number[]
  durable: number[]
  ephemeral: number[]
  ruleBound: number[]
  sceneOnly: number[]
}

type ConvergenceSummary = Record<
  keyof ConvergenceTimings,
  ReturnType<typeof summarizeTimings> | null
>

function summarizeConvergenceTimings(timings: ConvergenceTimings): ConvergenceSummary {
  return Object.fromEntries(
    Object.entries(timings).map(([name, values]) => [
      name,
      values.length ? summarizeTimings(values) : null
    ])
  ) as ConvergenceSummary
}

function assertConvergenceThresholds(timings: ConvergenceTimings): void {
  const summary = summarizeConvergenceTimings(timings)
  console.info(`Managed VTT convergence checkpoint: ${JSON.stringify(summary)}`)
  if (summary.sceneOnly)
    expect(summary.sceneOnly.p95).toBeLessThan(browserLimits.sceneConvergenceP95)
  if (summary.ruleBound)
    expect(summary.ruleBound.p95).toBeLessThan(browserLimits.ruleConvergenceP95)
  if (summary.authoritative)
    expect(summary.authoritative.p95).toBeLessThanOrEqual(browserLimits.authoritativeP95)
  if (summary.ephemeral)
    expect(summary.ephemeral.p95).toBeLessThanOrEqual(browserLimits.ephemeralP95)
  if (summary.durable) {
    expect(summary.durable.p95).toBeLessThanOrEqual(browserLimits.durableP95)
    expect(summary.durable.p99).toBeLessThanOrEqual(browserLimits.durableP99)
  }
}

async function campaignCard(page: Page): Promise<Locator> {
  await gotoManagedPage(page, '/campaigns')
  const cards = page.locator('article').filter({
    has: page.getByRole('heading', { name: campaignName, exact: true })
  })
  await expect(cards).toHaveCount(1, { timeout: pageReadyTimeoutMs })
  return cards.first()
}

async function resolveManagedPaths(page: Page, gm: ManagedClient): Promise<ManagedPaths> {
  const card = await campaignCard(page)
  const testId = await card.getAttribute('data-testid')
  if (!testId?.startsWith('campaign-')) {
    throw new Error(`Managed smoke Campaign ${JSON.stringify(campaignName)} has no route identity.`)
  }
  const campaignPublicId = testId.slice('campaign-'.length)
  const tabletop = `/tabletop/campaigns/${encodeURIComponent(campaignPublicId)}`
  await openTabletop(gm, { tabletop })
  await expectManagedSocket(gm)
  const playCharacter = card.getByRole('button', { name: 'Play Character' })
  await expect(playCharacter).toHaveCount(1)
  await playCharacter.click()
  await page.waitForURL((url) => /^\/characters\/[^/]+\/[^/]+\/?$/.test(url.pathname))
  const characterPath = new URL(page.url()).pathname.replace(/\/$/, '')
  return {
    characterSheet: characterPath,
    tabletop
  }
}

async function expectCampaignMembershipRole(
  page: Page,
  clientRole: ManagedClient['role'],
  expectedCampaignRole: 'OWNER' | 'PLAYER'
): Promise<void> {
  const card = await campaignCard(page)
  const expectedLabel = expectedCampaignRole === 'OWNER' ? 'GM' : 'Player'
  try {
    await expect(card.getByText(expectedLabel, { exact: true })).toBeVisible()
  } catch (error) {
    throw new Error(
      `${clientRole} expected ${expectedCampaignRole} membership in ${JSON.stringify(campaignName)}.`,
      { cause: error }
    )
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function collectDoorConvergenceTimings(
  gm: ManagedClient,
  players: readonly ManagedClient[],
  originalAction: string,
  samples: ConvergenceTimings,
  diagnostics: Record<string, number>
): Promise<string> {
  let action = originalAction
  for (let index = 0; index < warmupPairs + measuredPairs; index += 1) {
    const priorVersion = await readSceneVersion(gm.page)
    await gm.page.getByRole('button', { name: 'Scene controls' }).click()
    const gmAction = gm.page.getByRole('menuitem', { name: action, exact: true })
    await expect(gmAction).toBeVisible()
    const nextAction = oppositeDoorAction(action)
    await gmAction.evaluate((element) => {
      element.addEventListener(
        'click',
        () => {
          ;(window as unknown as Record<string, unknown>).__vttActionSubmittedAt = Date.now()
        },
        { once: true }
      )
    })
    const sentFrameStart = gm.liveSessionSentFrames.length
    const clients = [gm, ...players]
    await Promise.all(clients.map((client) => armSceneVersionShown(client.page, priorVersion + 1)))
    const liveSceneConvergence = Promise.all(
      clients.map((client) => waitForSceneVersion(client.page, priorVersion + 1))
    )
    await gmAction.click()
    action = nextAction
    await expect
      .poll(() =>
        gm.liveSessionSentFrames
          .slice(sentFrameStart)
          .some((payload) => isSceneDoorCommandFrame(payload))
      )
      .toBe(true)
    const [liveSceneResult] = await Promise.allSettled([liveSceneConvergence])
    if (liveSceneResult.status === 'rejected') {
      const alerts = await gm.page.getByRole('alert').allTextContents()
      throw new Error(
        `Door convergence failed. GM alerts: ${JSON.stringify(alerts)}. Recent received frames: ${JSON.stringify(summarizeFrames(gm.liveSessionFrames.slice(-10)))}. Recent sent frames: ${JSON.stringify(summarizeFrames(gm.liveSessionSentFrames.slice(-10)))}.`,
        { cause: liveSceneResult.reason }
      )
    }
    const observedAt = await Promise.all(clients.map((client) => sceneVersionShownAt(client.page)))
    const submittedAt = await gm.page.evaluate(
      () => (window as unknown as Record<string, unknown>).__vttActionSubmittedAt
    )
    assertTimestamp(submittedAt)
    const sceneOnlyMs = observedAt[0]! - submittedAt
    const durableMs = Math.max(...observedAt.slice(1)) - submittedAt
    await Promise.all([
      expectDoorAction(gm, action),
      ...players.map((player) => expectDoorHidden(player))
    ])
    diagnostics[`doorCommit${index + 1}Ms`] = durableMs
    if (index >= warmupPairs) {
      samples.authoritative.push(Math.max(...observedAt) - submittedAt)
      samples.durable.push(durableMs)
      samples.sceneOnly.push(sceneOnlyMs)
    }
  }
  return action
}

function assertTimestamp(value: unknown): asserts value is number {
  expect(typeof value).toBe('number')
}

async function collectTokenDragTimings(
  gm: ManagedClient,
  players: readonly ManagedClient[],
  previewPlayers: readonly ManagedClient[],
  samples: { durable: number[]; ephemeral: number[]; inputToSend: number[] },
  convergence: ConvergenceTimings
): Promise<void> {
  const totalSamples = warmupPairs + measuredPairs
  const sentToReceived: number[] = []
  const receivedToPaint: number[] = []
  const clients = [gm, ...players]
  const previewPlayerSet = new Set(previewPlayers)
  const privatePlayers = players.filter((player) => !previewPlayerSet.has(player))
  // GM previews are private by default (live-sessions.md audience rule); this section measures shared ones.
  const sharePreviews = gm.page.getByRole('button', {
    name: 'Show my previews to players',
    exact: true
  })
  await sharePreviews.click()
  await expect(sharePreviews).toHaveAttribute('aria-pressed', 'true')
  try {
    for (let index = 0; index < totalSamples; index += 1) {
      const priorVersion = await readSceneVersion(gm.page)
      await gm.page.getByRole('button', { name: 'Scene controls' }).click()
      await gm.page.getByRole('menuitem', { name: `Focus ${dragTokenLabel}`, exact: true }).click()
      await gm.page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
      const canvas = liveSceneRegion(gm.page).getByRole('img', {
        name: 'Interactive campaign scene'
      })
      const bounds = await canvas.boundingBox()
      if (!bounds) throw new Error('Managed VTT canvas has no layout bounds.')
      const from = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      const dragDistance = Math.min(80, bounds.height / 5)
      const to = {
        x: from.x,
        y: from.y + (index % 2 === 0 ? dragDistance : -dragDistance)
      }
      await gm.page.mouse.move(from.x, from.y)
      await expect
        .poll(() => canvas.evaluate((element) => getComputedStyle(element).cursor))
        .toBe('grab')
      await armLocalDragPaint(gm.page)
      const previewStarts = previewPlayers.map((player) => player.visualFramePaints.length)
      const privateStarts = privatePlayers.map((player) => player.liveSessionFrames.length)
      const originStart = gm.liveSessionFrames.length
      const originSentStart = gm.liveSessionSentFrames.length
      for (const player of previewPlayers) player.visualFrameTracking = true
      await gm.page.mouse.down()
      await gm.page.mouse.move(from.x + 1, from.y)
      await expect
        .poll(() => canvas.evaluate((element) => getComputedStyle(element).cursor))
        .toBe('grabbing')
      await gm.page.mouse.move(to.x, to.y, { steps: 6 })

      const localPaint = await waitForLocalDragPaint(gm.page)
      await expect
        .poll(() =>
          gm.liveSessionSentFrames
            .slice(originSentStart)
            .some((payload) => sentTokenDragPreview(payload))
        )
        .toBe(true)
      const originAccepted = () =>
        gm.liveSessionFrames
          .slice(originStart)
          .map(tokenDragAccepted)
          .find((value) => value !== null) ?? null
      try {
        await expect.poll(originAccepted).not.toBeNull()
      } catch (error) {
        throw new Error(
          `GM token preview received no authoritative response. Recent received frames: ${JSON.stringify(summarizeFrames(gm.liveSessionFrames.slice(originStart)))}. Recent sent frames: ${JSON.stringify(summarizeFrames(gm.liveSessionSentFrames.slice(originSentStart)))}.`,
          { cause: error }
        )
      }
      expect(originAccepted()).toBe(true)
      const peerPreviewPaints = await Promise.all(
        previewPlayers.map((player, playerIndex) =>
          waitForVisualFrame(
            player,
            previewStarts[playerIndex]!,
            (payload) => tokenDragPreview(payload) !== null
          )
        )
      )
      for (const player of previewPlayers) player.visualFrameTracking = false
      for (const [privateIndex, player] of privatePlayers.entries()) {
        await player.page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            })
        )
        expect(
          player.liveSessionFrames
            .slice(privateStarts[privateIndex]!)
            .some((payload) => tokenDragPreview(payload) !== null)
        ).toBe(false)
      }
      const resolvedTarget = tokenDragPreview(peerPreviewPaints[0]!.payload)
      if (!resolvedTarget) throw new Error('Managed VTT drag preview has no resolved position.')
      for (const preview of peerPreviewPaints.slice(1)) {
        const candidate = tokenDragPreview(preview.payload)
        if (
          candidate?.sequence !== resolvedTarget.sequence ||
          candidate?.tokenId !== resolvedTarget.tokenId ||
          !samePosition(candidate.position, resolvedTarget.position)
        ) {
          throw new Error('Managed VTT peers received different resolved drag positions.')
        }
      }
      const sentOffset = gm.liveSessionSentFrames
        .slice(originSentStart)
        .findIndex((payload) => sentTokenDragPreview(payload)?.sequence === resolvedTarget.sequence)
      if (sentOffset < 0)
        throw new Error('Managed VTT drag preview has no matching outbound frame timestamp.')
      const sentAt = gm.liveSessionSentFrameTimes[originSentStart + sentOffset]
      if (sentAt === undefined)
        throw new Error('Managed VTT drag preview has no matching outbound frame timestamp.')

      await armLocalDragRelease(gm.page)
      await Promise.all(
        clients.map((client) => armSceneVersionShown(client.page, priorVersion + 1))
      )
      await gm.page.mouse.up()
      const releasedAt = await waitForLocalDragRelease(gm.page)
      await Promise.all(clients.map((client) => waitForSceneVersion(client.page, priorVersion + 1)))
      const observedAt = await Promise.all(
        clients.map((client) => sceneVersionShownAt(client.page))
      )

      if (index >= warmupPairs) {
        const slowestPaint = peerPreviewPaints.reduce((slowest, next) =>
          slowest.paintedAt! >= next.paintedAt! ? slowest : next
        )
        const ephemeralMs = slowestPaint.paintedAt! - sentAt
        sentToReceived.push(slowestPaint.receivedAt - sentAt)
        receivedToPaint.push(slowestPaint.paintedAt! - slowestPaint.receivedAt)
        const durableMs = Math.max(...observedAt.slice(1)) - releasedAt
        samples.ephemeral.push(ephemeralMs)
        samples.durable.push(durableMs)
        samples.inputToSend.push(sentAt - localPaint.movedAt)
        convergence.ephemeral.push(ephemeralMs)
        convergence.durable.push(durableMs)
        convergence.authoritative.push(Math.max(...observedAt) - releasedAt)
      }

      await gm.page.getByRole('button', { name: 'Undo last token move' }).click()
      await Promise.all(clients.map((client) => waitForSceneVersion(client.page, priorVersion + 2)))
    }
  } finally {
    for (const client of clients) client.visualFrameTracking = false
  }
  console.info(
    `Managed VTT preview timing segments: ${JSON.stringify({
      sentToReceived: summarizeTimings(sentToReceived),
      receivedToPaint: summarizeTimings(receivedToPaint)
    })}`
  )
  console.info(
    `Managed VTT token drag timings: ${JSON.stringify({
      durable: summarizeTimings(samples.durable),
      ephemeral: summarizeTimings(samples.ephemeral),
      inputToSend: summarizeTimings(samples.inputToSend)
    })}`
  )
}

function liveSceneRegion(page: Page): Locator {
  return page.getByRole('region', { name: /^Live scene: / })
}

async function readSceneVersion(page: Page): Promise<number> {
  const label = await liveSceneRegion(page)
    .getByText(/^v\d+$/)
    .innerText()
  const version = Number(label.slice(1))
  if (!Number.isInteger(version)) throw new Error(`Invalid managed Scene version ${label}.`)
  return version
}

/**
 * Stamps, in the page's own clock, the moment the Scene version label commits to the DOM. Reading
 * `Date.now()` after a `toBeVisible` wait adds Playwright's retry gaps (0, 20, 50, 100, 100, 500 ms)
 * and a CDP round trip to every latency sample.
 */
async function armSceneVersionShown(page: Page, version: number): Promise<void> {
  await liveSceneRegion(page).evaluate((region, label) => {
    const state = window as unknown as Record<string, unknown>
    state.__vttSceneVersionAt = null
    const observer = new MutationObserver(() => {
      const shown = Array.from(region.querySelectorAll('*')).some(
        (element) => element.childElementCount === 0 && element.textContent === label
      )
      if (!shown) return
      state.__vttSceneVersionAt = Date.now()
      observer.disconnect()
    })
    observer.observe(region, { characterData: true, childList: true, subtree: true })
  }, `v${version}`)
}

async function sceneVersionShownAt(page: Page): Promise<number> {
  const stamp = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).__vttSceneVersionAt
  )
  assertTimestamp(stamp)
  return stamp
}

async function waitForSceneVersion(page: Page, version: number): Promise<void> {
  await expect(liveSceneRegion(page).getByText(`v${version}`, { exact: true })).toBeVisible()
}

async function armLocalDragPaint(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window as unknown as Record<string, unknown>
    state.__vttLocalDragPaint = null
    window.addEventListener(
      'pointermove',
      (event) => {
        if (!(event.target instanceof HTMLCanvasElement) || event.buttons !== 1) return
        const movedAt = Date.now()
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            state.__vttLocalDragPaint = { movedAt, paintedAt: Date.now() }
          })
        )
      },
      { capture: true, once: true }
    )
  })
}

async function waitForLocalDragPaint(page: Page): Promise<{ movedAt: number; paintedAt: number }> {
  const read = () =>
    page.evaluate(() => (window as unknown as Record<string, unknown>).__vttLocalDragPaint)
  await expect.poll(read).not.toBeNull()
  const value = record(await read())
  if (typeof value?.movedAt !== 'number' || typeof value.paintedAt !== 'number') {
    throw new Error('Managed VTT local drag paint marker is invalid.')
  }
  return { movedAt: value.movedAt, paintedAt: value.paintedAt }
}

async function armLocalDragRelease(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = window as unknown as Record<string, unknown>
    state.__vttLocalDragReleasedAt = null
    window.addEventListener(
      'pointerup',
      (event) => {
        if (event.target instanceof HTMLCanvasElement) state.__vttLocalDragReleasedAt = Date.now()
      },
      { capture: true, once: true }
    )
  })
}

async function waitForLocalDragRelease(page: Page): Promise<number> {
  const read = () =>
    page.evaluate(() => (window as unknown as Record<string, unknown>).__vttLocalDragReleasedAt)
  await expect.poll(read).not.toBeNull()
  const value = await read()
  assertTimestamp(value)
  return value
}

async function waitForVisualFrame(
  client: ManagedClient,
  startIndex: number,
  predicate: (payload: string) => boolean
): Promise<VisualFramePaint> {
  const read = () =>
    client.visualFramePaints
      .slice(startIndex)
      .find((frame) => frame.paintedAt !== null && predicate(frame.payload)) ?? null
  try {
    await expect.poll(read).not.toBeNull()
  } catch (error) {
    const received = [...client.liveSessionFrames]
      .reverse()
      .map(parsedFrame)
      .find((message) => message !== null)
    const sent = [...client.liveSessionSentFrames]
      .reverse()
      .map(parsedFrame)
      .find((message) => message !== null)
    throw new Error(
      `${client.role} did not paint the expected live-session frame. Last received: ${JSON.stringify(received)}. Last sent: ${JSON.stringify(sent)}.`,
      { cause: error }
    )
  }
  const result = read()
  if (!result) throw new Error(`${client.role} did not paint the expected live-session frame.`)
  return result
}

function tokenDragAccepted(payload: string): boolean | null {
  const message = parsedFrame(payload)
  const resolution = record(record(message?.message)?.tokenDragResolution)
  return message?.type === 'TRANSIENT' && typeof resolution?.accepted === 'boolean'
    ? resolution.accepted
    : null
}

function sentTokenDragPreview(payload: string): TokenDragPreview | null {
  const message = parsedFrame(payload)
  return message?.type === 'TRANSIENT' ? readTokenDragPreview(message.envelope) : null
}

function tokenDragPreview(payload: string): TokenDragPreview | null {
  const message = parsedFrame(payload)
  return message?.type === 'TRANSIENT'
    ? readTokenDragPreview(record(message.message)?.envelope)
    : null
}

function readTokenDragPreview(value: unknown): TokenDragPreview | null {
  const envelope = record(value)
  const position = record(envelope?.position)
  if (
    envelope?.kind !== 'TOKEN_DRAG_PREVIEW' ||
    typeof envelope.sequence !== 'number' ||
    typeof envelope.tokenId !== 'string' ||
    typeof position?.x !== 'number' ||
    typeof position.y !== 'number'
  ) {
    return null
  }
  return {
    position: { x: position.x, y: position.y },
    sequence: envelope.sequence,
    tokenId: envelope.tokenId
  }
}

function parsedFrame(payload: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(payload) as unknown)
  } catch {
    return null
  }
}

function isSceneDoorCommandFrame(payload: string): boolean {
  const message = parsedFrame(payload)
  const command = record(message?.command)
  const sceneCommand = record(command?.command)
  return (
    message?.type === 'COMMAND' &&
    command?.scope === 'SCENE' &&
    sceneCommand?.type === 'SET_SCENE_DOOR_STATE'
  )
}

function samePosition(value: unknown, expected: { x: number; y: number }): boolean {
  const position = record(value)
  return position?.x === expected.x && position.y === expected.y
}

async function collectRuleConvergenceTimings(
  client: ManagedClient,
  paths: ManagedPaths,
  samples: ConvergenceTimings
): Promise<void> {
  const sheet = await client.context.newPage()
  const peerSheet = await client.context.newPage()
  for (const page of [sheet, peerSheet]) {
    page.on('console', (message) => {
      if (message.type() === 'error')
        client.browserErrors.push(safeDiagnosticMessage(message.text()))
    })
    page.on('pageerror', (error) => client.browserErrors.push(safeDiagnosticMessage(error.message)))
    page.on('requestfailed', (request) => {
      client.failedRequests.push(
        `${request.method()} ${safeRequestUrl(request.url())}: ${request.failure()?.errorText ?? 'failed'}`
      )
    })
  }
  try {
    for (const page of [sheet, peerSheet]) {
      let renderError: unknown = new Error('Character Sheet did not render.')
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await gotoManagedPage(page, paths.characterSheet)
        try {
          await expect(page.getByText('Character Sheet', { exact: true })).toBeVisible({
            timeout: pageReadyTimeoutMs
          })
          await page.waitForLoadState('networkidle')
          renderError = null
          break
        } catch (error) {
          renderError = error
        }
      }
      if (renderError)
        throw new Error('Character Sheet did not render after one retry.', { cause: renderError })
    }
    const manageHitPoints = sheet.getByRole('button', { name: 'Manage hit points' })
    let editorError: unknown = new Error('Hit point editor did not open.')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(manageHitPoints).toBeEnabled({ timeout: pageReadyTimeoutMs })
      await manageHitPoints.click()
      try {
        await expect(manageHitPoints).toHaveAttribute('aria-expanded', 'true')
        editorError = null
        break
      } catch (error) {
        editorError = error
      }
    }
    if (editorError)
      throw new Error(
        `Hit point editor did not open after one retry. Browser errors: ${client.browserErrors.slice(-10).join(' | ') || 'none'}. Failed requests: ${client.failedRequests.slice(-10).join(' | ') || 'none'}.`,
        { cause: editorError }
      )
    const hitPointEditor = sheet.getByRole('dialog', { name: 'Manage Hit Points' })
    await expect(hitPointEditor).toBeVisible()
    const modifierInput = hitPointEditor.getByLabel('Max HP adjustment', { exact: true })
    await expect(modifierInput).toBeVisible()
    const originalModifier = Number(await modifierInput.inputValue())
    if (!Number.isFinite(originalModifier)) {
      throw new Error('The managed smoke Character has an invalid Max HP adjustment.')
    }
    const alternateModifier = originalModifier === 0 ? 1 : 0
    let currentModifier = originalModifier
    let currentMaxHitPoints = await readMaxHitPoints(peerSheet)
    for (let index = 0; index < warmupPairs + measuredPairs; index += 1) {
      let expectedMaxHitPoints = currentMaxHitPoints + alternateModifier - currentModifier
      await setMaxHpModifierAndCollect(
        sheet,
        peerSheet,
        alternateModifier,
        expectedMaxHitPoints,
        index >= warmupPairs,
        samples
      )
      currentModifier = alternateModifier
      currentMaxHitPoints = expectedMaxHitPoints
      expectedMaxHitPoints = currentMaxHitPoints + originalModifier - currentModifier
      await setMaxHpModifierAndCollect(
        sheet,
        peerSheet,
        originalModifier,
        expectedMaxHitPoints,
        index >= warmupPairs,
        samples
      )
      currentModifier = originalModifier
      currentMaxHitPoints = expectedMaxHitPoints
    }
  } finally {
    await Promise.all([sheet.close(), peerSheet.close()])
  }
}

async function setMaxHpModifierAndCollect(
  sheet: Page,
  peerSheet: Page,
  value: number,
  expectedMaxHitPoints: number,
  collect: boolean,
  samples: ConvergenceTimings
): Promise<void> {
  const input = sheet.getByLabel('Max HP adjustment', { exact: true })
  await input.fill(String(value))
  await input.evaluate((element) => {
    element.addEventListener(
      'blur',
      () => {
        ;(window as unknown as Record<string, unknown>).__vttActionSubmittedAt = Date.now()
      },
      { once: true }
    )
  })
  await input.press('Enter')
  await expect
    .poll(() => readMaxHitPoints(peerSheet), {
      intervals: [5, 10, 20],
      timeout: 30_000
    })
    .toBe(expectedMaxHitPoints)
  const observedAt = Date.now()
  const submittedAt = await sheet.evaluate(
    () => (window as unknown as Record<string, unknown>).__vttActionSubmittedAt
  )
  assertTimestamp(submittedAt)
  // A personal Sheet edit is a Convex command and a reactive Sheet read, not a room round trip, so it
  // is a rule-bound sample only (the frozen gate budgets ruleBound on its own).
  if (collect) samples.ruleBound.push(observedAt - submittedAt)
}

async function readMaxHitPoints(page: Page): Promise<number> {
  const readout = page.getByText('HP', { exact: true }).first().locator('..')
  await expect(readout).toBeVisible()
  const match = (await readout.innerText()).match(/HP\s*-?\d+\s*\/\s*(-?\d+)/)
  if (!match) throw new Error('The managed smoke Character has no visible HP readout.')
  return Number(match[1])
}

function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) throw new Error('Managed convergence timing has no samples.')
  return [...values].sort((left, right) => left - right)[Math.ceil(values.length * percentile) - 1]!
}

function summarizeTimings(values: readonly number[]) {
  return {
    max: Math.max(...values),
    p50: nearestRank(values, 0.5),
    p95: nearestRank(values, 0.95),
    p99: nearestRank(values, 0.99),
    raw: values
  }
}

async function openManagedClient(
  browser: Browser,
  role: ManagedClient['role'],
  account: { email: string; password: string }
): Promise<ManagedClient> {
  const context = await browser.newContext()
  const browserErrors: string[] = []
  const failedRequests: string[] = []
  try {
    const page = await context.newPage()
    const client: ManagedClient = {
      assetResponses: [],
      browserErrors,
      context,
      failedRequests,
      liveSessionFrames: [],
      liveSessionSentFrameTimes: [],
      liveSessionSentFrames: [],
      liveSessionUrls: [],
      page,
      role,
      visualFramePaintPending: false,
      visualFramePaints: [],
      visualFrameTracking: false
    }
    page.on('console', (message) => {
      if (message.type() === 'error')
        client.browserErrors.push(safeDiagnosticMessage(message.text()))
    })
    page.on('pageerror', (error) => client.browserErrors.push(safeDiagnosticMessage(error.message)))
    page.on('requestfailed', (request) => {
      client.failedRequests.push(
        `${request.method()} ${safeRequestUrl(request.url())}: ${request.failure()?.errorText ?? 'failed'}`
      )
    })
    page.on('response', (response) => {
      if (!response.ok()) {
        client.failedRequests.push(
          `${response.request().method()} ${safeRequestUrl(response.url())}: HTTP ${response.status()}`
        )
      }
      if (isVttMapAsset(response)) client.assetResponses.push(response)
    })
    observeLiveSessionSockets(page, client)
    await test.step(`${role} signs in`, () => signIn(page, account.email, account.password))
    return client
  } catch (error) {
    const diagnostics = ` Browser errors: ${JSON.stringify(browserErrors)}. Failed requests: ${JSON.stringify(failedRequests)}.`
    await context.close().catch(() => undefined)
    throw new Error(`${role} sign-in failed.${diagnostics}`, { cause: error })
  }
}

function observeLiveSessionSockets(page: Page, client: ManagedClient): void {
  page.on('websocket', (socket) => {
    if (!isLiveSessionSocket(socket.url())) return
    client.liveSessionUrls.push(socket.url())
    socket.on('framereceived', ({ payload }) => {
      const rawPayload = payload.toString()
      client.liveSessionFrames.push(rawPayload)
      if (
        !client.visualFrameTracking ||
        client.visualFramePaintPending ||
        !isVisualTimingFrame(rawPayload)
      )
        return
      client.visualFramePaintPending = true
      const frame: VisualFramePaint = {
        paintedAt: null,
        payload: rawPayload,
        receivedAt: Date.now()
      }
      client.visualFramePaints.push(frame)
      void page
        .evaluate(
          () =>
            new Promise<number>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve(Date.now())))
            })
        )
        .then((paintedAt) => {
          frame.paintedAt = paintedAt
        })
        .catch(() => undefined)
        .finally(() => {
          client.visualFramePaintPending = false
        })
    })
    socket.on('framesent', ({ payload }) => {
      client.liveSessionSentFrameTimes.push(Date.now())
      client.liveSessionSentFrames.push(payload.toString())
    })
  })
}

function isVisualTimingFrame(payload: string): boolean {
  const message = parsedFrame(payload)
  return (
    message?.type === 'TRANSIENT' &&
    record(record(message.message)?.envelope)?.kind === 'TOKEN_DRAG_PREVIEW'
  )
}

function safeRequestUrl(value: string): string {
  const url = new URL(value)
  return `${url.origin}${url.pathname}`
}

function safeDiagnosticMessage(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/g, (candidate) => {
      try {
        return safeRequestUrl(candidate)
      } catch {
        return '[url]'
      }
    })
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{40,})\b/g, '[redacted]')
    .slice(0, 1_000)
}

async function openTabletop(
  client: ManagedClient,
  paths: Pick<ManagedPaths, 'tabletop'>
): Promise<void> {
  let rendererError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const errorStart = client.browserErrors.length
    await gotoManagedPage(client.page, paths.tabletop)
    const renderer = { state: 'WAITING' as 'READY' | 'RETRY' | 'WAITING' }
    try {
      await expect
        .poll(
          async () => {
            renderer.state = (await client.page
              .getByRole('img', { name: 'Interactive campaign scene' })
              .isVisible())
              ? 'READY'
              : client.browserErrors
                    .slice(errorStart)
                    .some((value) => value.includes('Function execution timed out'))
                ? 'RETRY'
                : 'WAITING'
            return renderer.state
          },
          { timeout: 60_000 }
        )
        .not.toBe('WAITING')
    } catch (error) {
      rendererError = error
      break
    }
    if (renderer.state === 'READY') {
      rendererError = null
      break
    }
    rendererError = new Error('The local Convex read timed out.')
  }
  if (rendererError) {
    throw new Error(
      `${client.role} renderer did not start. Browser errors: ${client.browserErrors.slice(-10).join(' | ') || 'none'}. Failed requests: ${client.failedRequests.slice(-10).join(' | ') || 'none'}.`,
      { cause: rendererError }
    )
  }
  await expect(client.page.getByText(campaignName, { exact: true })).toBeVisible()
  try {
    await expect(client.page.getByText('Scene map ready.', { exact: true })).toBeVisible({
      timeout: 60_000
    })
  } catch (error) {
    const diagnostics = await describeMapDelivery(client)
    throw new Error(
      `${client.role} map did not become ready. Browser errors: ${client.browserErrors.slice(-10).join(' | ') || 'none'}. Failed requests: ${client.failedRequests.slice(-10).join(' | ') || 'none'}. Map delivery: ${JSON.stringify(diagnostics)}.`,
      { cause: error }
    )
  }
}

async function describeMapDelivery(client: ManagedClient): Promise<{
  assets: {
    contentLength: string | null
    contentType: string | null
    path: string
    resourceType: string
    status: number
  }[]
}> {
  return {
    assets: client.assetResponses.map((response) => ({
      contentLength: response.headers()['content-length'] ?? null,
      contentType: response.headers()['content-type'] ?? null,
      path: safeRequestUrl(response.url()),
      resourceType: response.request().resourceType(),
      status: response.status()
    }))
  }
}

async function expectManagedSocket(client: ManagedClient): Promise<void> {
  await expect.poll(() => client.liveSessionUrls.length).toBeGreaterThan(0)
  expect(
    client.liveSessionUrls.every((value) => {
      const url = new URL(value)
      return (
        url.origin === liveSessionWebSocketOrigin && /^\/live-session\/[^/]+$/.test(url.pathname)
      )
    })
  ).toBe(true)
  await expect
    .poll(() =>
      client.liveSessionFrames.some((frame) => parsedFrame(frame)?.type === 'TRANSIENT_READY')
    )
    .toBe(true)
}

async function expectPrivateSnapshot(
  gm: ManagedClient,
  players: readonly ManagedClient[]
): Promise<void> {
  await gm.page.getByRole('button', { name: 'Scene controls' }).click()
  await expect(gm.page.getByRole('menuitem', { name: `Focus ${gmOnlyTokenLabel}` })).toBeVisible()
  await gm.page.keyboard.press('Escape')
  for (const player of players) {
    await player.page.getByRole('button', { name: 'Scene controls' }).click()
    await expect(
      player.page.getByRole('menuitem', { name: `Focus ${gmOnlyTokenLabel}` })
    ).toHaveCount(0)
    await expect(
      player.page.getByRole('menuitem', { name: new RegExp(`^Door ${doorIndex}:`) })
    ).toHaveCount(0)
    await player.page.keyboard.press('Escape')
  }
}
async function expectExactVttMapDelivery(client: ManagedClient): Promise<void> {
  await expect.poll(() => client.assetResponses.some((response) => response.ok())).toBe(true)
  expect(
    client.assetResponses.every(
      (response) => response.ok() && response.headers()['content-type']?.startsWith('image/')
    )
  ).toBe(true)
}

async function restoreDoorFromAuthoritativeState(
  browser: Browser,
  clients: ManagedClient[],
  originalDoorAction: string,
  paths: ManagedPaths
): Promise<void> {
  let gm = [...clients].reverse().find((client) => client.role === 'GM' && !client.page.isClosed())
  if (!gm) {
    gm = await openManagedClient(browser, 'GM', gmCredentials)
    clients.push(gm)
    await openTabletop(gm, paths)
    await expectManagedSocket(gm)
  }
  const currentDoorAction = await readDoorAction(gm.page, doorIndex)
  if (currentDoorAction === originalDoorAction) return
  const priorVersion = await readSceneVersion(gm.page)
  await clickDoorAction(gm.page, currentDoorAction)
  await waitForSceneVersion(gm.page, priorVersion + 1)
  await expectDoorAction(gm, originalDoorAction)
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await gotoManagedPage(page, '/sign-in')
  const emailInput = page.getByRole('textbox', { name: 'Email or username' })
  const passwordInput = page.getByRole('textbox', { name: 'Password' })
  await expect(emailInput).toBeEnabled({ timeout: pageReadyTimeoutMs })
  await expect(passwordInput).toBeEnabled({ timeout: pageReadyTimeoutMs })
  await passwordInput.fill(password, { timeout: 15_000 })
  await emailInput.fill(email, { timeout: 15_000 })
  await expect(emailInput).toHaveValue(email)
  await expect(passwordInput).toHaveValue(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { waitUntil: 'commit' })
}

async function gotoManagedPage(page: Page, path: string): Promise<void> {
  const separator = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${separator}ntl-drawer-state=hidden`, { waitUntil: 'domcontentloaded' })
}

async function readDoorAction(page: Page, index: number): Promise<string> {
  await page.getByRole('button', { name: 'Scene controls' }).click()
  const item = page.getByRole('menuitem', { name: new RegExp(`^Door ${index}: (?:Open|Close)$`) })
  await expect(item).toBeVisible()
  const label = (await item.textContent())?.trim()
  await page.keyboard.press('Escape')
  if (!label) throw new Error(`Door ${index} is missing from the managed smoke scene.`)
  return label
}

async function clickDoorAction(page: Page, action: string): Promise<void> {
  await page.getByRole('button', { name: 'Scene controls' }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

async function expectDoorAction(client: ManagedClient, action: string): Promise<void> {
  await client.page.getByRole('button', { name: 'Scene controls' }).click()
  try {
    await expect(client.page.getByRole('menuitem', { name: action, exact: true })).toHaveCount(1)
  } catch (error) {
    const alerts = await client.page.getByRole('alert').allTextContents()
    throw new Error(
      `${client.role} did not project ${action}. Alerts: ${alerts.join(' | ') || 'none'}. Recent frames: ${JSON.stringify(summarizeFrames(client.liveSessionFrames.slice(-10)))}.`,
      { cause: error }
    )
  } finally {
    await client.page.keyboard.press('Escape')
  }
}

async function expectDoorHidden(client: ManagedClient): Promise<void> {
  await client.page.getByRole('button', { name: 'Scene controls' }).click()
  try {
    await expect(
      client.page.getByRole('menuitem', { name: new RegExp(`^Door ${doorIndex}:`) })
    ).toHaveCount(0)
  } finally {
    await client.page.keyboard.press('Escape')
  }
}

function summarizeFrames(frames: readonly string[]): unknown[] {
  return frames.flatMap((value) => {
    const message = parsedFrame(value)
    if (!message) return []
    const envelope = record(record(message.message)?.envelope) ?? record(message.envelope)
    const command = record(record(message.command)?.command)
    const state = record(message.state)
    const correctionState = record(record(message.correction)?.state)
    const scene = record(state?.scene) ?? correctionState
    const barriers = Array.isArray(scene?.barriers) ? scene.barriers : []
    return [
      {
        barrierCount: barriers.length,
        barrierId: typeof command?.barrierId === 'string' ? command.barrierId : null,
        code: typeof message.code === 'string' ? message.code : null,
        commandId:
          typeof message.commandId === 'string'
            ? message.commandId
            : typeof command?.commandId === 'string'
              ? command.commandId
              : null,
        currentSequence:
          typeof message.currentSequence === 'number' ? message.currentSequence : null,
        expectedSceneVersion:
          typeof command?.expectedSceneVersion === 'number' ? command.expectedSceneVersion : null,
        expectedSessionSequence:
          typeof message.expectedSessionSequence === 'number'
            ? message.expectedSessionSequence
            : null,
        sceneBarriers: barriers.slice(0, 8).map((barrier) => {
          const value = record(barrier)
          return {
            id: typeof value?.id === 'string' ? value.id : null,
            kind: typeof value?.kind === 'string' ? value.kind : null
          }
        }),
        sceneId:
          typeof command?.sceneId === 'string'
            ? command.sceneId
            : typeof scene?.id === 'string'
              ? scene.id
              : null,
        sceneVersion: typeof scene?.version === 'number' ? scene.version : null,
        sequence: typeof message.sequence === 'number' ? message.sequence : null,
        transientKind: typeof envelope?.kind === 'string' ? envelope.kind : null,
        type: typeof message.type === 'string' ? message.type : null
      }
    ]
  })
}

function oppositeDoorAction(action: string): string {
  if (action.endsWith(': Open')) return action.replace(/: Open$/, ': Close')
  if (action.endsWith(': Close')) return action.replace(/: Close$/, ': Open')
  throw new Error(`Managed smoke door is not interactive: ${action}`)
}

function isVttMapAsset(response: Response): boolean {
  return response.headers()['content-type']?.startsWith('image/') ?? false
}

function isLiveSessionSocket(value: string): boolean {
  try {
    return new URL(value).pathname.startsWith('/live-session/')
  } catch {
    return false
  }
}

function credentials(role: ManagedClient['role']): { email: string; password: string } {
  const email = process.env[`MANAGED_VTT_${role}_EMAIL`]
  const password = process.env[`MANAGED_VTT_${role}_PASSWORD`]
  if (!email || !password)
    throw new Error(`Managed VTT ${role.toLowerCase()} credentials are required.`)
  return { email, password }
}

function requiredTopology(): 'LOCAL' | 'MANAGED' {
  const value = requiredValue('MANAGED_VTT_TOPOLOGY')
  if (value !== 'LOCAL' && value !== 'MANAGED') {
    throw new Error('MANAGED_VTT_TOPOLOGY must be LOCAL or MANAGED.')
  }
  return value
}

function requiredLiveSessionOrigin(name: string, expectedTopology: 'LOCAL' | 'MANAGED'): string {
  const value = requiredValue(name)
  const url = new URL(value)
  const expectedProtocol = expectedTopology === 'MANAGED' ? 'https:' : 'http:'
  const allowedHost =
    expectedTopology === 'MANAGED' ? null : new Set(['127.0.0.1', 'localhost', '::1'])
  if (
    url.protocol !== expectedProtocol ||
    url.origin !== value.replace(/\/$/, '') ||
    (allowedHost !== null && !allowedHost.has(url.hostname.toLowerCase()))
  ) {
    throw new Error(
      expectedTopology === 'MANAGED'
        ? `${name} must be an exact HTTPS origin.`
        : `${name} must be an exact loopback HTTP origin.`
    )
  }
  return url.origin
}

function requiredValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function boundedSampleCount(name: string, fallback: number, minimum: number): number {
  const rawValue = process.env[name]?.trim()
  if (!rawValue) return fallback
  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < minimum || value > 20) {
    throw new Error(`${name} must be an integer between ${minimum} and 20.`)
  }
  return value
}
