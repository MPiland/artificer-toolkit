import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type Response
} from '@playwright/test'

const tabletopPath = requiredPath('MANAGED_VTT_TABLETOP_PATH', '/tabletop/')
const campaignName = requiredValue('MANAGED_VTT_CAMPAIGN_NAME')
const gmCredentials = credentials('GM')
const gmOnlyTokenLabel = requiredValue('MANAGED_VTT_GM_ONLY_TOKEN_LABEL')
const characterSheetPath = requiredPath('MANAGED_VTT_CHARACTER_SHEET_PATH', '/characters/')
const liveSessionEndpoint = requiredHttpsOrigin('MANAGED_LIVE_SESSION_ENDPOINT')
const playerCredentials = credentials('PLAYER')
const player2Credentials = credentials('PLAYER2')
const ruleActionLabel = requiredValue('MANAGED_VTT_RULE_ACTION_LABEL')
const doorIndex = 1
const authorityReleaseWaitMs = 30_000
const liveSessionWebSocketOrigin = liveSessionEndpoint.replace(/^https:/, 'wss:')
const warmupPairs = 2
const measuredPairs = 10

test('connects three users through the managed room and recovers a reversible scene commit', async ({
  browser
}, testInfo) => {
  test.setTimeout(10 * 60_000)
  const clients: ManagedClient[] = []
  let failure: unknown
  let cleanupFailure: unknown
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

    const readyStartedAt = performance.now()
    await Promise.all([openTabletop(gm), openTabletop(player), openTabletop(player2)])
    timings.readyMs = performance.now() - readyStartedAt

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
    await collectRuleHostTimings(player, hostTimings.ruleBound)
    expect(nearestRankP95(hostTimings.sceneOnly)).toBeLessThan(100)
    expect(nearestRankP95(hostTimings.ruleBound)).toBeLessThan(250)

    await Promise.all([gm.context.close(), player.context.close(), player2.context.close()])
    timings.authorityReleaseWaitMs = authorityReleaseWaitMs
    await delay(authorityReleaseWaitMs)

    const recoveryStartedAt = performance.now()
    player2 = await openManagedClient(browser, 'PLAYER2', player2Credentials)
    clients.push(player2)
    await openTabletop(player2)
    await expectManagedSocket(player2)
    await expectDoorAction(player2.page, currentDoorAction)

    player = await openManagedClient(browser, 'PLAYER', playerCredentials)
    clients.push(player)
    await openTabletop(player)
    await expectManagedSocket(player)
    await expectDoorAction(player.page, currentDoorAction)

    gm = await openManagedClient(browser, 'GM', gmCredentials)
    clients.push(gm)
    await openTabletop(gm)
    await expectManagedSocket(gm)
    await expectDoorAction(gm.page, currentDoorAction)
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
      await restoreDoorFromAuthoritativeState(browser, clients, originalDoorAction)
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

async function collectDoorHostTimings(
  gm: ManagedClient,
  players: readonly ManagedClient[],
  originalAction: string,
  samples: number[],
  diagnostics: Record<string, number>
): Promise<string> {
  let action = originalAction
  for (let index = 0; index < 3 + 20; index += 1) {
    const startedAt = performance.now()
    const priorFrameCount = gm.liveSessionFrames.length
    await clickDoorAction(gm.page, action)
    action = oppositeDoorAction(action)
    await Promise.all([
      expectDoorAction(gm.page, action),
      ...players.map((player) => expectDoorAction(player.page, action))
    ])
    diagnostics[`doorCommit${index + 1}Ms`] = performance.now() - startedAt
    const timing = await waitForOriginHostTiming(gm, priorFrameCount, 'SCENE_ONLY')
    if (index >= 3) samples.push(timing)
  }
  return action
}

async function collectRuleHostTimings(client: ManagedClient, samples: number[]): Promise<void> {
  const sheet = await client.context.newPage()
  try {
    await gotoManagedPage(sheet, characterSheetPath)
    const restoreLabel = oppositeRuleActionLabel(ruleActionLabel)
    for (let index = 0; index < warmupPairs + measuredPairs; index += 1) {
      await clickRuleActionAndCollect(client, sheet, ruleActionLabel, index >= warmupPairs, samples)
      await clickRuleActionAndCollect(client, sheet, restoreLabel, index >= warmupPairs, samples)
    }
  } finally {
    await sheet.close()
  }
}

async function clickRuleActionAndCollect(
  client: ManagedClient,
  sheet: Page,
  action: string,
  collect: boolean,
  samples: number[]
): Promise<void> {
  const priorFrameCount = client.liveSessionFrames.length
  await sheet.getByRole('button', { name: action, exact: true }).click()
  const timing = await waitForOriginHostTiming(client, priorFrameCount, 'RULE_BOUND')
  if (collect) samples.push(timing)
}

async function waitForOriginHostTiming(
  client: ManagedClient,
  priorFrameCount: number,
  category: 'RULE_BOUND' | 'SCENE_ONLY'
): Promise<number> {
  await expect
    .poll(() => {
      const frame = client.liveSessionFrames.slice(priorFrameCount).find((value) => {
        const parsed = parseHostTiming(value)
        return parsed?.category === category
      })
      return frame ?? null
    })
    .not.toBeNull()
  const frame = client.liveSessionFrames.slice(priorFrameCount).find((value) => {
    const parsed = parseHostTiming(value)
    return parsed?.category === category
  })
  const timing = frame ? parseHostTiming(frame) : null
  if (!timing) throw new Error(`Missing ${category} host timing.`)
  return timing.durationMs
}

function parseHostTiming(value: string): { category: string; durationMs: number } | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null
    const hostTiming = (parsed as { hostTiming?: unknown }).hostTiming
    if (!hostTiming || typeof hostTiming !== 'object') return null
    const { category, durationMs } = hostTiming as { category?: unknown; durationMs?: unknown }
    return typeof category === 'string' && typeof durationMs === 'number'
      ? { category, durationMs }
      : null
  } catch {
    return null
  }
}

function oppositeRuleActionLabel(action: string): string {
  if (action.startsWith('Use ')) return action.replace(/^Use /, 'Restore ')
  if (action.startsWith('Restore ')) return action.replace(/^Restore /, 'Use ')
  throw new Error('MANAGED_VTT_RULE_ACTION_LABEL must begin with "Use " or "Restore ".')
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
  try {
    const page = await context.newPage()
    const client: ManagedClient = {
      assetResponses: [],
      browserErrors: [],
      context,
      deliveryResponses: [],
      failedRequests: [],
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
    page.on('websocket', (socket) => {
      if (!isLiveSessionSocket(socket.url())) return
      client.liveSessionUrls.push(socket.url())
      socket.on('framereceived', ({ payload }) => client.liveSessionFrames.push(payload.toString()))
    })
    await test.step(`${role} signs in`, () => signIn(page, account.email, account.password))
    return client
  } catch (error) {
    await context.close()
    throw error
  }
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

async function openTabletop(client: ManagedClient): Promise<void> {
  await gotoManagedPage(client.page, tabletopPath)
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
    throw new Error(
      `${client.role} map did not become ready. Browser errors: ${client.browserErrors.slice(-10).join(' | ') || 'none'}. Failed requests: ${client.failedRequests.slice(-10).join(' | ') || 'none'}.`,
      { cause: error }
    )
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
  originalDoorAction: string
): Promise<void> {
  let gm = [...clients].reverse().find((client) => client.role === 'GM' && !client.page.isClosed())
  if (!gm) {
    gm = await openManagedClient(browser, 'GM', gmCredentials)
    clients.push(gm)
    await openTabletop(gm)
    await expectManagedSocket(gm)
  }
  const currentDoorAction = await readDoorAction(gm.page, doorIndex)
  if (currentDoorAction === originalDoorAction) return
  await clickDoorAction(gm.page, currentDoorAction)
  await expectDoorAction(gm.page, originalDoorAction)
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await gotoManagedPage(page, '/sign-in')
  const emailInput = page.getByRole('textbox', { name: 'Email or username' })
  const passwordInput = page.getByRole('textbox', { name: 'Password' })
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

async function expectDoorAction(page: Page, action: string): Promise<void> {
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: 'Scene controls' }).click()
      const visible = await page.getByRole('menuitem', { name: action, exact: true }).isVisible()
      await page.keyboard.press('Escape')
      return visible
    })
    .toBe(true)
}

function oppositeDoorAction(action: string): string {
  if (action.endsWith(': Open')) return action.replace(/: Open$/, ': Close')
  if (action.endsWith(': Close')) return action.replace(/: Close$/, ': Open')
  throw new Error(`Managed smoke door is not interactive: ${action}`)
}

function isVttMapAsset(response: Response): boolean {
  return (
    response.request().resourceType() === 'image' &&
    response.url().includes('/storage/v1/object/sign/media/')
  )
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

function requiredPath(name: string, prefix: string): string {
  const value = requiredValue(name)
  if (!value.startsWith(prefix) || value.includes('://')) {
    throw new Error(`${name} must be an application path beginning with ${prefix}.`)
  }
  return value
}

function requiredHttpsOrigin(name: string): string {
  const value = requiredValue(name)
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '')) {
    throw new Error(`${name} must be an exact HTTPS origin.`)
  }
  return url.origin
}

function requiredValue(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}
