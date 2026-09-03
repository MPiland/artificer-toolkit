import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Response
} from '@playwright/test'
import {
  campaignSceneStateDtoSchema,
  type CampaignSceneStateDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { signedVttMapDeliveryDtoSchema } from '@artificer-toolkit/schema/api/media'

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
const hostTimingP95Limits =
  topology === 'MANAGED' ? { ruleBound: 250, sceneOnly: 100 } : { ruleBound: 1_500, sceneOnly: 500 }
const managedLaunchP95Limits = {
  localPaint: 100,
  peerCommit: 1_500,
  peerPreview: 250,
  peerVisual: 1_500
}
const signInReadyTimeoutMs = topology === 'LOCAL' ? 60_000 : 15_000

test('connects three users through the live room and recovers a reversible scene commit', async ({
  browser
}, testInfo) => {
  test.setTimeout(10 * 60_000)
  const clients: ManagedClient[] = []
  let failure: unknown
  let cleanupFailure: unknown
  let managedPaths: ManagedPaths | null = null
  let originalDoorAction: string | null = null
  const timings: Record<string, number> = {}
  const hostTimings = { ruleBound: [] as number[], sceneOnly: [] as number[] }
  const peerVisualTimings: number[] = []
  const tokenDragTimings = {
    localPaint: [] as number[],
    peerCommit: [] as number[],
    peerPreview: [] as number[]
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
    managedPaths = await resolveManagedPaths(player.page)

    const readyStartedAt = performance.now()
    await Promise.all([
      openTabletop(gm, managedPaths),
      openTabletop(player, managedPaths),
      openTabletop(player2, managedPaths)
    ])
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
    await expect.poll(() => gm.ticketResponses.some((response) => response.ok())).toBe(true)
    await expect.poll(() => player.ticketResponses.some((response) => response.ok())).toBe(true)
    await expect.poll(() => player2.ticketResponses.some((response) => response.ok())).toBe(true)
    await expectPrivateSnapshot(gm, [player, player2])
    await Promise.all([expectExactVttMapDelivery(player), expectExactVttMapDelivery(player2)])

    originalDoorAction = await readDoorAction(gm.page, doorIndex)
    const currentDoorAction = await collectDoorHostTimings(
      gm,
      [player, player2],
      originalDoorAction,
      hostTimings.sceneOnly,
      peerVisualTimings,
      timings
    )
    await collectTokenDragTimings(gm, [player, player2], tokenDragTimings)
    await collectRuleHostTimings(player, managedPaths, hostTimings.ruleBound)
    const hostTimingSummary = summarizeHostTimings(hostTimings)
    await testInfo.attach('managed-vtt-host-timings', {
      body: JSON.stringify(hostTimingSummary, null, 2),
      contentType: 'application/json'
    })
    console.info(`Managed VTT host timings: ${JSON.stringify(hostTimingSummary)}`)
    expect(hostTimingSummary.sceneOnly.p95).toBeLessThan(hostTimingP95Limits.sceneOnly)
    expect(hostTimingSummary.ruleBound.p95).toBeLessThan(hostTimingP95Limits.ruleBound)
    if (topology === 'MANAGED') {
      expect(summarizeTimings(peerVisualTimings).p95).toBeLessThan(
        managedLaunchP95Limits.peerVisual
      )
      expect(summarizeTimings(tokenDragTimings.localPaint).p95).toBeLessThan(
        managedLaunchP95Limits.localPaint
      )
      expect(summarizeTimings(tokenDragTimings.peerPreview).p95).toBeLessThan(
        managedLaunchP95Limits.peerPreview
      )
      expect(summarizeTimings(tokenDragTimings.peerCommit).p95).toBeLessThan(
        managedLaunchP95Limits.peerCommit
      )
    }

    await Promise.all([gm.context.close(), player.context.close(), player2.context.close()])
    timings.authorityReleaseWaitMs = authorityReleaseWaitMs
    await delay(authorityReleaseWaitMs)

    const recoveryStartedAt = performance.now()
    player2 = await openManagedClient(browser, 'PLAYER2', player2Credentials)
    clients.push(player2)
    await openTabletop(player2, managedPaths)
    await expectManagedSocket(player2)
    await expectDoorAction(player2, currentDoorAction)

    player = await openManagedClient(browser, 'PLAYER', playerCredentials)
    clients.push(player)
    await openTabletop(player, managedPaths)
    await expectManagedSocket(player)
    await expectDoorAction(player, currentDoorAction)

    gm = await openManagedClient(browser, 'GM', gmCredentials)
    clients.push(gm)
    await openTabletop(gm, managedPaths)
    await expectManagedSocket(gm)
    await expectDoorAction(gm, currentDoorAction)
    timings.recoveryMs = performance.now() - recoveryStartedAt

    await testInfo.attach('managed-vtt-timings', {
      body: JSON.stringify(
        {
          e2eDiagnosticMs: timings,
          hostProcessingMs: summarizeHostTimings(hostTimings),
          peerVisualMs: summarizeTimings(peerVisualTimings),
          tokenDragVisualMs: {
            localPaint: summarizeTimings(tokenDragTimings.localPaint),
            peerCommit: summarizeTimings(tokenDragTimings.peerCommit),
            peerPreview: summarizeTimings(tokenDragTimings.peerPreview)
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
})

interface ManagedClient {
  assetResponses: Response[]
  browserErrors: string[]
  context: BrowserContext
  deliveryResponses: Response[]
  failedRequests: string[]
  liveSessionFrames: string[]
  liveSessionSentFrames: string[]
  liveSessionUrls: string[]
  page: Page
  role: 'GM' | 'PLAYER' | 'PLAYER2'
  ticketResponses: Response[]
  visualFramePaints: VisualFramePaint[]
  visualFrameTracking: boolean
}

interface VisualFramePaint {
  paintedAt: number | null
  payload: string
  receivedAt: number
}

interface ManagedPaths {
  characterSheet: string
  tabletop: string
}

interface ManagedCampaignSummary {
  assignedCharacter: { publicId: string } | null
  name: string
  publicId: string
  role: 'OWNER' | 'PLAYER'
}

interface ManagedCharacterListItem {
  publicId: string
}

async function resolveManagedPaths(page: Page): Promise<ManagedPaths> {
  const campaigns = parseCampaignSummaries(await queryManagedTrpc(page, 'campaigns.list'))
  const matches = campaigns.filter((campaign) => campaign.name === campaignName)
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one managed smoke Campaign named ${JSON.stringify(campaignName)}, found ${matches.length}.`
    )
  }
  const campaign = matches[0]!
  const assignedCharacter = campaign.assignedCharacter
  if (!assignedCharacter) {
    throw new Error(
      `Managed smoke Campaign ${JSON.stringify(campaignName)} has no Character assigned to the signed-in player.`
    )
  }

  const characters = parseCharacterList(await queryManagedTrpc(page, 'characters.list'))
  if (!characters.some((character) => character.publicId === assignedCharacter.publicId)) {
    throw new Error(
      `Assigned managed smoke Character ${JSON.stringify(assignedCharacter.publicId)} is not available to the signed-in player.`
    )
  }

  return {
    characterSheet: `/characters/${encodeURIComponent(assignedCharacter.publicId)}/sheet`,
    tabletop: `/tabletop/campaigns/${encodeURIComponent(campaign.publicId)}/sessions/1`
  }
}

async function expectCampaignMembershipRole(
  page: Page,
  clientRole: ManagedClient['role'],
  expectedCampaignRole: ManagedCampaignSummary['role']
): Promise<void> {
  const campaigns = parseCampaignSummaries(await queryManagedTrpc(page, 'campaigns.list'))
  const matches = campaigns.filter((campaign) => campaign.name === campaignName)
  if (matches.length !== 1) {
    throw new Error(
      `${clientRole} campaigns.list expected exactly one smoke Campaign named ${JSON.stringify(campaignName)}, found ${matches.length}.`
    )
  }
  if (matches[0]?.role !== expectedCampaignRole) {
    throw new Error(
      `${clientRole} campaigns.list expected ${expectedCampaignRole} for ${JSON.stringify(campaignName)}, received ${matches[0]?.role ?? 'none'}.`
    )
  }
}

async function queryManagedTrpc(page: Page, procedure: string): Promise<unknown> {
  const response = await page.evaluate(async (procedureName) => {
    const input = encodeURIComponent(JSON.stringify({ 0: null }))
    const result = await fetch(`/api/trpc/${procedureName}?batch=1&input=${input}`, {
      credentials: 'same-origin'
    })
    return { body: await result.text(), status: result.status }
  }, procedure)
  if (response.status !== 200) {
    throw new Error(`Managed ${procedure} query failed with HTTP ${response.status}.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(response.body) as unknown
  } catch (error) {
    throw new Error(`Managed ${procedure} query returned invalid JSON.`, { cause: error })
  }
  const envelope = Array.isArray(parsed) ? parsed[0] : parsed
  const envelopeRecord = record(envelope)
  const result = record(envelopeRecord?.result)
  const data = result?.data
  const dataRecord = record(data)
  if (dataRecord && Object.hasOwn(dataRecord, 'json')) return dataRecord.json
  if (data !== undefined) return data
  throw new Error(`Managed ${procedure} query returned no result data.`)
}

function parseCampaignSummaries(value: unknown): ManagedCampaignSummary[] {
  if (!Array.isArray(value)) throw new Error('Managed campaigns.list returned a non-list response.')
  return value.map((item, index) => {
    const candidate = record(item)
    const name = candidate?.name
    const publicId = candidate?.publicId
    const role = candidate?.role
    const assigned = candidate?.assignedCharacter
    if (
      !candidate ||
      typeof name !== 'string' ||
      typeof publicId !== 'string' ||
      (role !== 'OWNER' && role !== 'PLAYER')
    ) {
      throw new Error(`Managed campaigns.list item ${index} has an invalid shape.`)
    }
    if (assigned === null) return { assignedCharacter: null, name, publicId, role }
    const assignedRecord = record(assigned)
    if (!assignedRecord || typeof assignedRecord.publicId !== 'string') {
      throw new Error(`Managed campaigns.list item ${index} has an invalid shape.`)
    }
    return {
      assignedCharacter: { publicId: assignedRecord.publicId },
      name,
      publicId,
      role
    }
  })
}

function parseCharacterList(value: unknown): ManagedCharacterListItem[] {
  const response = record(value)
  const items = response?.items
  if (!Array.isArray(items))
    throw new Error('Managed characters.list returned an invalid response.')
  return items.map((item, index) => {
    const candidate = record(item)
    if (!candidate || typeof candidate.publicId !== 'string') {
      throw new Error(`Managed characters.list item ${index} has an invalid shape.`)
    }
    return { publicId: candidate.publicId }
  })
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function collectDoorHostTimings(
  gm: ManagedClient,
  players: readonly ManagedClient[],
  originalAction: string,
  samples: number[],
  peerVisualSamples: number[],
  diagnostics: Record<string, number>
): Promise<string> {
  let action = originalAction
  for (let index = 0; index < warmupPairs + measuredPairs; index += 1) {
    await Promise.all(
      players.map(async (player) => {
        await player.page.getByRole('button', { name: 'Scene controls' }).click()
        await expect(player.page.getByRole('menuitem', { name: action, exact: true })).toBeVisible()
      })
    )
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
    const priorFrameCount = gm.liveSessionFrames.length
    await gmAction.click()
    action = nextAction
    const hostTiming = waitForCorrelatedHostTiming(gm, priorFrameCount, 'SCENE_ONLY')
    await Promise.all(
      players.map((player) =>
        expect(player.page.getByRole('menuitem', { name: action, exact: true })).toBeVisible()
      )
    )
    const submittedAt = await gm.page.evaluate(
      () => (window as unknown as Record<string, unknown>).__vttActionSubmittedAt
    )
    assertTimestamp(submittedAt)
    const peerVisualMs = Date.now() - submittedAt
    const timing = await hostTiming
    await Promise.all(players.map((player) => player.page.keyboard.press('Escape')))
    await expectDoorAction(gm, action)
    diagnostics[`doorCommit${index + 1}Ms`] = peerVisualMs
    if (index >= warmupPairs) {
      samples.push(timing)
      peerVisualSamples.push(peerVisualMs)
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
  samples: { localPaint: number[]; peerCommit: number[]; peerPreview: number[] }
): Promise<void> {
  const scene = latestSceneState(gm)
  const token = scene.tokens.find((candidate) => candidate.label === dragTokenLabel)
  if (!token || token.locked) {
    throw new Error(
      `Managed smoke Scene is missing movable token ${JSON.stringify(dragTokenLabel)}.`
    )
  }
  for (const player of players) {
    if (!latestSceneState(player).tokens.some((candidate) => candidate.id === token.id)) {
      throw new Error(`${player.role} cannot observe the managed drag token.`)
    }
  }

  const origin = token.position
  if (scene.grid.kind === 'GRIDLESS') {
    throw new Error('Managed token-drag smoke requires a gridded Scene.')
  }
  const step = Math.max(scene.grid.cellSize, 10)
  const alternate = {
    x: origin.x,
    y: origin.y + step < scene.map.height ? origin.y + step : origin.y - step
  }
  const totalSamples = warmupPairs + measuredPairs
  for (const client of [gm, ...players]) client.visualFrameTracking = true
  try {
    for (let index = 0; index < totalSamples; index += 1) {
      const canvas = gm.page.getByRole('img', { name: 'Interactive campaign scene' })
      const from = await sceneToClient(canvas, scene, origin)
      const to = await sceneToClient(canvas, scene, alternate)
      await gm.page.mouse.move(from.x, from.y)
      await gm.page.mouse.down()
      await armLocalDragPaint(gm.page)
      const previewStarts = players.map((player) => player.visualFramePaints.length)
      await gm.page.mouse.move(to.x, to.y)

      const localPaint = await waitForLocalDragPaint(gm.page)
      const peerPreviewPaints = await Promise.all(
        players.map((player, playerIndex) =>
          waitForVisualFrame(player, previewStarts[playerIndex]!, (payload) =>
            framePreviewsToken(payload, token.id)
          )
        )
      )
      const resolvedTarget = tokenPreviewPosition(peerPreviewPaints[0]!.payload, token.id)
      if (!resolvedTarget) throw new Error('Managed VTT drag preview has no resolved position.')
      for (const preview of peerPreviewPaints.slice(1)) {
        if (!samePosition(tokenPreviewPosition(preview.payload, token.id), resolvedTarget)) {
          throw new Error('Managed VTT peers received different resolved drag positions.')
        }
      }

      await armLocalDragRelease(gm.page)
      const commitClients = [gm, ...players]
      const commitStarts = commitClients.map((client) => client.visualFramePaints.length)
      await gm.page.mouse.up()
      const releasedAt = await waitForLocalDragRelease(gm.page)
      const commitPaints = await Promise.all(
        commitClients.map((client, clientIndex) =>
          waitForVisualFrame(client, commitStarts[clientIndex]!, (payload) =>
            frameCommitsTokenAt(payload, token.id, resolvedTarget)
          )
        )
      )

      if (index >= warmupPairs) {
        samples.localPaint.push(localPaint.paintedAt - localPaint.movedAt)
        samples.peerPreview.push(
          Math.max(...peerPreviewPaints.map(({ paintedAt }) => paintedAt!)) - localPaint.movedAt
        )
        samples.peerCommit.push(
          Math.max(...commitPaints.slice(1).map(({ paintedAt }) => paintedAt!)) - releasedAt
        )
      }

      const restoreStarts = commitClients.map((client) => client.visualFramePaints.length)
      await gm.page.getByRole('button', { name: 'Undo last token move' }).click()
      await Promise.all(
        commitClients.map((client, clientIndex) =>
          waitForVisualFrame(client, restoreStarts[clientIndex]!, (payload) =>
            frameCommitsTokenAt(payload, token.id, origin)
          )
        )
      )
    }
  } finally {
    for (const client of [gm, ...players]) client.visualFrameTracking = false
  }
  console.info(
    `Managed VTT token drag timings: ${JSON.stringify({
      localPaint: summarizeTimings(samples.localPaint),
      peerCommit: summarizeTimings(samples.peerCommit),
      peerPreview: summarizeTimings(samples.peerPreview)
    })}`
  )
}

function latestSceneState(client: ManagedClient): CampaignSceneStateDto {
  for (const payload of [...client.liveSessionFrames].reverse()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(payload) as unknown
    } catch {
      continue
    }
    const message = record(parsed)
    if (!message) continue
    const snapshots = [
      ...(Array.isArray(message.sceneSnapshots) ? message.sceneSnapshots : []),
      ...(message.snapshot ? [message.snapshot] : [])
    ]
    for (const snapshot of snapshots) {
      const scene = record(snapshot)?.scene
      const result = campaignSceneStateDtoSchema.safeParse(scene)
      if (result.success) return result.data
    }
  }
  throw new Error(`${client.role} has no valid live Scene snapshot.`)
}

async function sceneToClient(
  canvas: Locator,
  scene: CampaignSceneStateDto,
  point: { x: number; y: number }
): Promise<{ x: number; y: number }> {
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Managed VTT canvas has no layout bounds.')
  const scale = Math.min(bounds.width / scene.map.width, bounds.height / scene.map.height) * 0.94
  return {
    x: bounds.x + (bounds.width - scene.map.width * scale) / 2 + point.x * scale,
    y: bounds.y + (bounds.height - scene.map.height * scale) / 2 + point.y * scale
  }
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
    const rejection = [...client.liveSessionFrames]
      .reverse()
      .map(parsedFrame)
      .find((message) => message?.type === 'COMMAND_REJECTED')
    const sent = [...client.liveSessionSentFrames]
      .reverse()
      .map(parsedFrame)
      .find((message) => message !== null)
    throw new Error(
      `${client.role} did not paint the expected live-session frame. Last rejection: ${JSON.stringify(rejection)}. Last sent: ${JSON.stringify(sent)}.`,
      { cause: error }
    )
  }
  const result = read()
  if (!result) throw new Error(`${client.role} did not paint the expected live-session frame.`)
  return result
}

function framePreviewsToken(payload: string, tokenId: string): boolean {
  const message = parsedFrame(payload)
  const envelope = record(record(message?.message)?.envelope)
  return (
    message?.type === 'TRANSIENT' &&
    envelope?.kind === 'TOKEN_DRAG_PREVIEW' &&
    envelope.tokenId === tokenId
  )
}

function tokenPreviewPosition(payload: string, tokenId: string): { x: number; y: number } | null {
  if (!framePreviewsToken(payload, tokenId)) return null
  const message = parsedFrame(payload)
  const position = record(record(record(message?.message)?.envelope)?.position)
  return typeof position?.x === 'number' && typeof position.y === 'number'
    ? { x: position.x, y: position.y }
    : null
}

function frameCommitsTokenAt(
  payload: string,
  tokenId: string,
  position: { x: number; y: number }
): boolean {
  const message = parsedFrame(payload)
  if (message?.type !== 'COMMAND_COMMITTED') return false
  const delta = record(message.delta)
  if (
    (delta?.kind === 'TOKEN_MOVED' || delta?.kind === 'TOKEN_MOVE_UNDONE') &&
    delta.tokenId === tokenId &&
    samePosition(delta.position, position)
  ) {
    return true
  }
  const snapshots = [
    ...(Array.isArray(message.sceneSnapshots) ? message.sceneSnapshots : []),
    ...(message.snapshot ? [message.snapshot] : [])
  ]
  return snapshots.some((snapshot) => {
    const tokens = record(record(snapshot)?.scene)?.tokens
    return (
      Array.isArray(tokens) &&
      tokens.some((token) => {
        const candidate = record(token)
        return candidate?.id === tokenId && samePosition(candidate.position, position)
      })
    )
  })
}

function parsedFrame(payload: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(payload) as unknown)
  } catch {
    return null
  }
}

function samePosition(value: unknown, expected: { x: number; y: number }): boolean {
  const position = record(value)
  return position?.x === expected.x && position.y === expected.y
}

async function collectRuleHostTimings(
  client: ManagedClient,
  paths: ManagedPaths,
  samples: number[]
): Promise<void> {
  const sheet = await client.context.newPage()
  try {
    observeLiveSessionSockets(sheet, client)
    await gotoManagedPage(sheet, paths.characterSheet)
    await sheet.getByRole('button', { name: 'Manage hit points' }).click()
    const modifierInput = sheet.getByLabel('Max HP adjustment', { exact: true })
    await expect(modifierInput).toBeVisible()
    const originalModifier = Number(await modifierInput.inputValue())
    if (!Number.isFinite(originalModifier)) {
      throw new Error('The managed smoke Character has an invalid Max HP adjustment.')
    }
    const alternateModifier = originalModifier === 0 ? 1 : 0
    for (let index = 0; index < warmupPairs + measuredPairs; index += 1) {
      await setMaxHpModifierAndCollect(
        client,
        sheet,
        alternateModifier,
        index >= warmupPairs,
        samples
      )
      await setMaxHpModifierAndCollect(
        client,
        sheet,
        originalModifier,
        index >= warmupPairs,
        samples
      )
    }
  } finally {
    await sheet.close()
  }
}

async function setMaxHpModifierAndCollect(
  client: ManagedClient,
  sheet: Page,
  value: number,
  collect: boolean,
  samples: number[]
): Promise<void> {
  const priorFrameCount = client.liveSessionFrames.length
  const input = sheet.getByLabel('Max HP adjustment', { exact: true })
  await input.fill(String(value))
  await input.press('Enter')
  const timing = await waitForCorrelatedHostTiming(client, priorFrameCount, 'RULE_BOUND')
  if (collect) samples.push(timing)
}

async function waitForCorrelatedHostTiming(
  client: ManagedClient,
  priorFrameCount: number,
  category: 'RULE_BOUND' | 'SCENE_ONLY'
): Promise<number> {
  const readAccepted = () =>
    client.liveSessionFrames
      .slice(priorFrameCount)
      .map(parseAcceptedCommand)
      .find((value): value is { acceptedSequence: number; commandId: string } => value !== null) ??
    null
  try {
    await expect.poll(readAccepted).not.toBeNull()
  } catch (error) {
    throw new Error(
      `${client.role} did not receive a ${category} command acknowledgement. Recent frames: ${JSON.stringify(summarizeFrames(client.liveSessionFrames.slice(-10)))}.`,
      { cause: error }
    )
  }
  const accepted = readAccepted()
  if (!accepted) throw new Error(`Missing ${category} command acknowledgement.`)
  const commandId = accepted.commandId
  const readOutcome = () =>
    client.liveSessionFrames
      .slice(priorFrameCount)
      .map((value) => parseCommandOutcome(value, category, commandId))
      .find((outcome) => outcome !== null) ?? null
  try {
    await expect.poll(readOutcome).not.toBeNull()
  } catch (error) {
    throw new Error(
      `${client.role} command ${commandId} acceptedSequence=${accepted.acceptedSequence} did not receive a terminal ${category} outcome. Last frames: ${JSON.stringify(summarizeFrames(client.liveSessionFrames.slice(-10)))}.`,
      { cause: error }
    )
  }
  const outcome = readOutcome()
  if (!outcome) throw new Error(`Missing ${category} command outcome for ${commandId}.`)
  if (outcome.kind === 'REJECTED') {
    throw new Error(
      `${category} command ${commandId} rejected (${outcome.code}): ${outcome.message}`
    )
  }
  return outcome.durationMs
}

function parseAcceptedCommand(
  value: string
): { acceptedSequence: number; commandId: string } | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    const message = parsed as Record<string, unknown>
    return message.type === 'COMMAND_ACCEPTED' &&
      typeof message.commandId === 'string' &&
      typeof message.acceptedSequence === 'number'
      ? { acceptedSequence: message.acceptedSequence, commandId: message.commandId }
      : null
  } catch {
    return null
  }
}

function parseCommandOutcome(
  value: string,
  category: 'RULE_BOUND' | 'SCENE_ONLY',
  commandId: string
):
  | { code: string; kind: 'REJECTED'; commandId: string; message: string }
  | { commandId: string; durationMs: number; kind: 'TIMING' }
  | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    const message = parsed as Record<string, unknown>
    if (message.type === 'COMMAND_REJECTED') {
      if (message.commandId !== commandId) return null
      return {
        code: typeof message.code === 'string' ? message.code : 'UNKNOWN',
        kind: 'REJECTED',
        commandId,
        message: typeof message.message === 'string' ? message.message : 'No rejection detail.'
      }
    }
    if (message.type !== 'COMMAND_COMMITTED' || message.originCommandId !== commandId) {
      return null
    }
    const hostTiming = message.hostTiming
    if (!hostTiming || typeof hostTiming !== 'object') return null
    const { category: timingCategory, durationMs } = hostTiming as {
      category?: unknown
      durationMs?: unknown
    }
    return timingCategory === category && typeof durationMs === 'number'
      ? { commandId, durationMs, kind: 'TIMING' }
      : null
  } catch {
    return null
  }
}

function nearestRankP95(samples: readonly number[]): number {
  if (samples.length === 0) throw new Error('Managed host timing has no samples.')
  return [...samples].sort((left, right) => left - right)[Math.ceil(samples.length * 0.95) - 1]!
}

function summarizeHostTimings(samples: { ruleBound: number[]; sceneOnly: number[] }) {
  const nearestRank = (values: readonly number[], percentile: number) => {
    if (values.length === 0) throw new Error('Managed host timing has no samples.')
    return [...values].sort((left, right) => left - right)[
      Math.ceil(values.length * percentile) - 1
    ]!
  }
  const summarize = (values: readonly number[]) => ({
    max: Math.max(...values),
    p50: nearestRank(values, 0.5),
    p95: nearestRankP95(values),
    raw: values
  })
  return { ruleBound: summarize(samples.ruleBound), sceneOnly: summarize(samples.sceneOnly) }
}

function summarizeTimings(values: readonly number[]) {
  return {
    max: Math.max(...values),
    p50: [...values].sort((left, right) => left - right)[Math.ceil(values.length * 0.5) - 1],
    p95: nearestRankP95(values),
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
      deliveryResponses: [],
      failedRequests,
      liveSessionFrames: [],
      liveSessionSentFrames: [],
      liveSessionUrls: [],
      page,
      role,
      ticketResponses: [],
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
      if (response.url().includes('media.getVttMapDelivery')) {
        client.deliveryResponses.push(response)
      }
      if (response.url().includes('/api/trpc/campaigns.sessions.ticket')) {
        client.ticketResponses.push(response)
      }
    })
    observeLiveSessionSockets(page, client)
    await test.step(`${role} signs in`, () => signIn(page, account.email, account.password))
    return client
  } catch (error) {
    const diagnostics = ` Browser errors: ${JSON.stringify(browserErrors)}. Failed requests: ${JSON.stringify(failedRequests)}.`
    await context.close()
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
      if (!client.visualFrameTracking || !isVisualTimingFrame(rawPayload)) return
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
    })
    socket.on('framesent', ({ payload }) => client.liveSessionSentFrames.push(payload.toString()))
  })
}

function isVisualTimingFrame(payload: string): boolean {
  const message = parsedFrame(payload)
  return (
    message?.type === 'COMMAND_COMMITTED' ||
    (message?.type === 'TRANSIENT' &&
      record(record(message.message)?.envelope)?.kind === 'TOKEN_DRAG_PREVIEW')
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

async function openTabletop(client: ManagedClient, paths: ManagedPaths): Promise<void> {
  await gotoManagedPage(client.page, paths.tabletop)
  try {
    await expect(client.page.getByRole('img', { name: 'Interactive campaign scene' })).toBeVisible({
      timeout: 60_000
    })
  } catch (error) {
    throw new Error(
      `${client.role} renderer did not start. Browser errors: ${client.browserErrors.slice(-10).join(' | ') || 'none'}. Failed requests: ${client.failedRequests.slice(-10).join(' | ') || 'none'}.`,
      { cause: error }
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
  deliveries: { metadata: MapDeliveryMetadata[]; status: number }[]
}> {
  const deliveries = await Promise.all(
    client.deliveryResponses.map(async (response) => {
      const metadata: MapDeliveryMetadata[] = []
      if (response.ok()) collectMapDeliveryMetadata(await response.json(), metadata)
      return { metadata, status: response.status() }
    })
  )
  return {
    assets: client.assetResponses.map((response) => ({
      contentLength: response.headers()['content-length'] ?? null,
      contentType: response.headers()['content-type'] ?? null,
      path: safeRequestUrl(response.url()),
      resourceType: response.request().resourceType(),
      status: response.status()
    })),
    deliveries
  }
}

interface MapDeliveryMetadata {
  assetId: string
  hasOverview: boolean
  height: number | null
  tileCount: number | null
  width: number | null
}

function collectMapDeliveryMetadata(value: unknown, result: MapDeliveryMetadata[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMapDeliveryMetadata(item, result)
    return
  }
  if (!value || typeof value !== 'object') return
  const candidate = value as Record<string, unknown>
  if (typeof candidate.assetId === 'string') {
    result.push({
      assetId: candidate.assetId,
      hasOverview: Boolean(candidate.overview),
      height: typeof candidate.height === 'number' ? candidate.height : null,
      tileCount: Array.isArray(candidate.tiles) ? candidate.tiles.length : null,
      width: typeof candidate.width === 'number' ? candidate.width : null
    })
  }
  for (const item of Object.values(candidate)) collectMapDeliveryMetadata(item, result)
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
}

async function expectPrivateSnapshot(
  gm: ManagedClient,
  players: readonly ManagedClient[]
): Promise<void> {
  await expect
    .poll(() => gm.liveSessionFrames.some((frame) => frame.includes(gmOnlyTokenLabel)))
    .toBe(true)
  for (const player of players) {
    expect(player.liveSessionFrames.some((frame) => frame.includes(gmOnlyTokenLabel))).toBe(false)
  }
}

async function expectExactVttMapDelivery(client: ManagedClient): Promise<void> {
  await expect.poll(() => client.deliveryResponses.some((response) => response.ok())).toBe(true)
  const expectedUrls = new Set<string>()
  for (const response of client.deliveryResponses.filter((candidate) => candidate.ok())) {
    const body: unknown = await response.json()
    collectSignedMediaUrls(body, expectedUrls)
  }
  expect(expectedUrls.size).toBeGreaterThan(0)
  await expect
    .poll(() =>
      [...expectedUrls].every((url) =>
        client.assetResponses.some((response) => response.ok() && response.url() === url)
      )
    )
    .toBe(true)
}

function collectSignedMediaUrls(value: unknown, urls: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSignedMediaUrls(item, urls)
    return
  }
  if (!value || typeof value !== 'object') return

  const delivery = signedVttMapDeliveryDtoSchema.safeParse(value)
  if (delivery.success) {
    urls.add(delivery.data.overview.url)
    for (const tile of delivery.data.tiles) urls.add(tile.url)
    return
  }

  for (const item of Object.values(value)) collectSignedMediaUrls(item, urls)
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
  await clickDoorAction(gm.page, currentDoorAction)
  await expectDoorAction(gm, originalDoorAction)
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await gotoManagedPage(page, '/sign-in')
  const emailInput = page.getByRole('textbox', { name: 'Email or username' })
  const passwordInput = page.getByRole('textbox', { name: 'Password' })
  await expect(emailInput).toBeEnabled({ timeout: signInReadyTimeoutMs })
  await expect(passwordInput).toBeEnabled({ timeout: signInReadyTimeoutMs })
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

function summarizeFrames(frames: readonly string[]): unknown[] {
  return frames.flatMap((value) => {
    try {
      const parsed: unknown = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object') return []
      const message = parsed as Record<string, unknown>
      const delta =
        message.delta && typeof message.delta === 'object'
          ? (message.delta as Record<string, unknown>)
          : null
      const hostTiming =
        message.hostTiming && typeof message.hostTiming === 'object'
          ? (message.hostTiming as Record<string, unknown>)
          : null
      return [
        {
          aggregateId: typeof message.aggregateId === 'string' ? message.aggregateId : null,
          aggregateKind: typeof message.aggregateKind === 'string' ? message.aggregateKind : null,
          code: typeof message.code === 'string' ? message.code : null,
          deltaKind: typeof delta?.kind === 'string' ? delta.kind : null,
          hasSnapshot: Boolean(message.snapshot),
          hostTimingCategory: typeof hostTiming?.category === 'string' ? hostTiming.category : null,
          replayed: message.replayed === true,
          type: typeof message.type === 'string' ? message.type : null,
          version: typeof message.version === 'number' ? message.version : null
        }
      ]
    } catch {
      return []
    }
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
