import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type Response
} from '@playwright/test'

const campaignName = requiredValue('MANAGED_VTT_CAMPAIGN_NAME')
const gmCredentials = credentials('GM')
const gmOnlyTokenLabel = requiredValue('MANAGED_VTT_GM_ONLY_TOKEN_LABEL')
const topology = requiredTopology()
const liveSessionEndpoint = requiredLiveSessionOrigin('MANAGED_LIVE_SESSION_ENDPOINT', topology)
const playerCredentials = credentials('PLAYER')
const player2Credentials = credentials('PLAYER2')
const doorIndex = 1
const authorityReleaseWaitMs = 30_000
const liveSessionWebSocketOrigin = liveSessionEndpoint.replace(/^http/, (protocol) =>
  protocol === 'https' ? 'wss' : 'ws'
)
const warmupPairs = boundedSampleCount('VTT_USAGE_WARMUP_PAIRS', 2, 0)
const measuredPairs = boundedSampleCount('VTT_USAGE_MEASURED_PAIRS', 10, 1)
const hostTimingP95Limits =
  topology === 'MANAGED' ? { ruleBound: 250, sceneOnly: 100 } : { ruleBound: 1_500, sceneOnly: 500 }
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
      timings
    )
    await collectRuleHostTimings(player, managedPaths, hostTimings.ruleBound)
    const hostTimingSummary = summarizeHostTimings(hostTimings)
    await testInfo.attach('managed-vtt-host-timings', {
      body: JSON.stringify(hostTimingSummary, null, 2),
      contentType: 'application/json'
    })
    console.info(`Managed VTT host timings: ${JSON.stringify(hostTimingSummary)}`)
    expect(hostTimingSummary.sceneOnly.p95).toBeLessThan(hostTimingP95Limits.sceneOnly)
    expect(hostTimingSummary.ruleBound.p95).toBeLessThan(hostTimingP95Limits.ruleBound)

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
          hostProcessingMs: summarizeHostTimings(hostTimings)
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
  liveSessionUrls: string[]
  page: Page
  role: 'GM' | 'PLAYER' | 'PLAYER2'
  ticketResponses: Response[]
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
  diagnostics: Record<string, number>
): Promise<string> {
  let action = originalAction
  for (let index = 0; index < warmupPairs + measuredPairs; index += 1) {
    const startedAt = performance.now()
    const priorFrameCount = gm.liveSessionFrames.length
    await clickDoorAction(gm.page, action)
    action = oppositeDoorAction(action)
    const timing = await waitForCorrelatedHostTiming(gm, priorFrameCount, 'SCENE_ONLY')
    await Promise.all([
      expectDoorAction(gm, action),
      ...players.map((player) => expectDoorAction(player, action))
    ])
    diagnostics[`doorCommit${index + 1}Ms`] = performance.now() - startedAt
    if (index >= warmupPairs) samples.push(timing)
  }
  return action
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
      liveSessionUrls: [],
      page,
      role,
      ticketResponses: []
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
    socket.on('framereceived', ({ payload }) => client.liveSessionFrames.push(payload.toString()))
  })
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
  if (typeof value === 'string') {
    if (value.includes('/storage/v1/object/sign/media/')) urls.add(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSignedMediaUrls(item, urls)
    return
  }
  if (!value || typeof value !== 'object') return
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
  return response.url().includes('/storage/v1/object/sign/media/')
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
