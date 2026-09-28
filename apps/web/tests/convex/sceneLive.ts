import { mkdir, writeFile } from 'node:fs/promises'
import { isExpectedSceneLiveDiagnostic } from './sceneLiveDiagnostics'
import {
  chromium,
  expect as playwrightExpect,
  type BrowserContext,
  type Locator,
  type Page
} from '@playwright/test'
import {
  captureDiagnostics,
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession
} from './campaignCollaboration'
import {
  expectNativePingFanout,
  expectNativeLiveSessionAuthenticationRefresh,
  expectNativeLiveSessionPrivacy,
  expectNativeLiveSessionMessage,
  expectNativeLiveSessionClosed,
  expectNativeLiveSessionSocket,
  expectNativeLiveSessionTraffic,
  nativeLiveSessionMessageCount,
  nativeLiveSessionFrameSummary,
  traceNativeLiveSessionSockets
} from './nativeSceneLive'

const expect = playwrightExpect.configure({ timeout: 30_000 })

type SceneLiveAccount = {
  email: string
  password: string
  username: string
}

type SceneLiveVerificationInput = {
  owner: SceneLiveAccount
  player: SceneLiveAccount
  publicId: string
  sceneName: string
  publicTokenName: string
  privateTokenName: string
  privateTokenId: string
  onlinePublicTokenName: string
  evidenceDirectory: string
  liveSessionEndpoint?: string
  updateWhileDisconnected: () => Promise<string>
  revokePlayer?: () => Promise<void>
  verifyState: (stage: 'hydrated' | 'live-updated' | 'reconnected') => Promise<void>
}

type SceneLiveVerificationResult = {
  globalDiagnostics: string[]
}

const origin = 'http://localhost:3000'

export async function verifySceneLiveBrowser(
  input: SceneLiveVerificationInput
): Promise<SceneLiveVerificationResult> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let playerConvexSocketForDiagnostics: ConvexSocketTrace | undefined
  let nativeOwnerSocketsForDiagnostics: ReturnType<typeof traceNativeLiveSessionSockets> | undefined
  let nativePlayerSocketsForDiagnostics:
    | ReturnType<typeof traceNativeLiveSessionSockets>
    | undefined
  let nativeAuthenticationRefresh:
    | Awaited<ReturnType<typeof expectNativeLiveSessionAuthenticationRefresh>>
    | undefined
  let stage = 'sign in'
  let failure: string | undefined
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
    ownerContext.setDefaultTimeout(30_000)
    playerContext.setDefaultTimeout(30_000)
    ownerContext.setDefaultNavigationTimeout(90_000)
    playerContext.setDefaultNavigationTimeout(90_000)
    owner = await ownerContext.newPage()
    player = await playerContext.newPage()
    const nativeOwnerSockets = input.liveSessionEndpoint
      ? traceNativeLiveSessionSockets(owner, input.liveSessionEndpoint)
      : undefined
    const nativePlayerSockets = input.liveSessionEndpoint
      ? traceNativeLiveSessionSockets(player, input.liveSessionEndpoint)
      : undefined
    const playerConvexSocket = await traceConvexSocket(playerContext, player)
    nativeOwnerSocketsForDiagnostics = nativeOwnerSockets
    nativePlayerSocketsForDiagnostics = nativePlayerSockets
    playerConvexSocketForDiagnostics = playerConvexSocket
    const ownerSession = watchAuthenticatedSession(owner)
    const playerSession = watchAuthenticatedSession(player)
    captureDiagnostics(owner, 'owner', () => stage, diagnostics, abortedRequests)
    captureDiagnostics(player, 'player', () => stage, diagnostics, abortedRequests)
    captureLegacyRequests(owner, 'owner', () => stage, forbiddenLegacyRequests)
    captureLegacyRequests(player, 'player', () => stage, forbiddenLegacyRequests)

    await Promise.all([
      signIn(owner, input.owner, ownerSession),
      signIn(player, input.player, playerSession)
    ])
    expect(await player.evaluate('typeof window.closeSceneProofConvexSocket')).toBe('function')

    stage = 'hydrate live scene'
    await Promise.all([
      openTabletop(owner, input, ownerSession),
      openTabletop(player, input, playerSession)
    ])
    await Promise.all([
      assertOwnerScene(owner, input.sceneName, input.publicTokenName, input.privateTokenName),
      assertPlayerScene(player, input.sceneName, input.publicTokenName, input.privateTokenName)
    ])
    if (input.liveSessionEndpoint && nativeOwnerSockets && nativePlayerSockets) {
      await Promise.all([
        expectNativeLiveSessionSocket(nativeOwnerSockets, input.liveSessionEndpoint),
        expectNativeLiveSessionSocket(nativePlayerSockets, input.liveSessionEndpoint),
        expectNativeLiveSessionMessage(nativeOwnerSockets, 'TRANSIENT_READY'),
        expectNativeLiveSessionMessage(nativePlayerSockets, 'TRANSIENT_READY'),
        expectNativeLiveSessionTraffic(nativeOwnerSockets),
        expectNativeLiveSessionTraffic(nativePlayerSockets)
      ])
      expectPlayerWirePrivacy(nativePlayerSockets, playerConvexSocket, input)
      stage = 'verify native ping fanout'
      await expectPingFanoutBoth(
        owner,
        player,
        input.sceneName,
        nativeOwnerSockets,
        nativePlayerSockets
      )
    }
    await input.verifyState('hydrated')
    await Promise.all([
      owner.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/scene-live-owner-hydrated.png`,
        fullPage: true
      }),
      player.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/scene-live-player-hydrated.png`,
        fullPage: true
      })
    ])

    stage = 'commit live scene object edit'
    const sceneVersion = Number(
      (
        await owner
          .getByRole('region', { name: `Live scene: ${input.sceneName}` })
          .getByText(/^v\d+$/)
          .innerText()
      ).slice(1)
    )
    await owner.keyboard.press('Escape')
    await owner
      .getByRole('region', { name: `Live scene: ${input.sceneName}` })
      .getByText('Edit', { exact: true })
      .click()
    await owner.getByRole('button', { name: 'Edit objects', exact: true }).click()
    const objectEditor = owner.getByRole('dialog', { name: 'Edit live scene object', exact: true })
    await expect(objectEditor).toBeVisible()
    await objectEditor.getByRole('combobox', { name: 'Scene object', exact: true }).click()
    await owner
      .getByRole('option', { name: `Token · ${input.publicTokenName}`, exact: true })
      .click()
    await objectEditor
      .getByRole('textbox', { name: 'Label', exact: true })
      .fill(input.onlinePublicTokenName)
    await objectEditor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(objectEditor).toHaveCount(0)
    // A recipient revision rehydrates the Scene and remounts its controls.
    await expect(
      player
        .getByRole('region', { name: `Live scene: ${input.sceneName}` })
        .getByText(`v${sceneVersion + 1}`, { exact: true })
    ).toBeVisible()
    const liveUpdatedControls = await sceneControls(player)
    await expect(
      liveUpdatedControls.getByRole('menuitem', {
        name: `Focus ${input.onlinePublicTokenName}`,
        exact: true
      })
    ).toBeVisible({ timeout: 30_000 })
    await assertPrivateTokenAbsent(liveUpdatedControls, input.privateTokenName)
    if (nativePlayerSockets) expectPlayerWirePrivacy(nativePlayerSockets, playerConvexSocket, input)
    await input.verifyState('live-updated')

    if (nativeOwnerSockets && nativePlayerSockets) {
      stage = 'refresh live session authentication'
      nativeAuthenticationRefresh =
        await expectNativeLiveSessionAuthenticationRefresh(nativePlayerSockets)
      await expectPingFanoutBoth(
        owner,
        player,
        input.sceneName,
        nativeOwnerSockets,
        nativePlayerSockets
      )
    }

    stage = 'change while player disconnected'
    const openedBeforeDisconnect = playerConvexSocket.opened
    const closedBeforeDisconnect = playerConvexSocket.closed
    playerConvexSocket.checkpoints.openedBeforeDisconnect = openedBeforeDisconnect
    playerConvexSocket.checkpoints.closedBeforeDisconnect = closedBeforeDisconnect
    await playerContext.setOffline(true)
    await player.evaluate(() => {
      const close = (window as Window & { closeSceneProofConvexSocket?: () => void })
        .closeSceneProofConvexSocket
      if (!close) throw new Error('Scene proof socket instrumentation is unavailable.')
      close()
    })
    await expect.poll(() => playerConvexSocket.closed).toBeGreaterThan(closedBeforeDisconnect)
    playerConvexSocket.checkpoints.closedAfterDisconnect = playerConvexSocket.closed
    const updatedPublicTokenName = await input.updateWhileDisconnected()
    await playerContext.setOffline(false)
    await expect.poll(() => playerConvexSocket.opened).toBeGreaterThan(openedBeforeDisconnect)
    playerConvexSocket.checkpoints.openedAfterReconnect = playerConvexSocket.opened
    await expect(
      player
        .getByRole('region', { name: `Live scene: ${input.sceneName}` })
        .getByText(`v${sceneVersion + 2}`, { exact: true })
    ).toBeVisible()
    const playerControls = await sceneControls(player)
    await expect(
      playerControls.getByRole('menuitem', { name: `Focus ${updatedPublicTokenName}` })
    ).toBeVisible({
      timeout: 30_000
    })
    await assertPrivateTokenAbsent(playerControls, input.privateTokenName)

    stage = 'reload hydrated scene'
    const ownerReadyBeforeReload = nativeOwnerSockets
      ? nativeLiveSessionMessageCount(nativeOwnerSockets, 'TRANSIENT_READY')
      : 0
    const playerReadyBeforeReload = nativePlayerSockets
      ? nativeLiveSessionMessageCount(nativePlayerSockets, 'TRANSIENT_READY')
      : 0
    await Promise.all([reloadTabletop(owner, ownerSession), reloadTabletop(player, playerSession)])
    await Promise.all([
      assertOwnerScene(owner, input.sceneName, updatedPublicTokenName, input.privateTokenName),
      assertPlayerScene(player, input.sceneName, updatedPublicTokenName, input.privateTokenName)
    ])
    if (input.liveSessionEndpoint && nativeOwnerSockets && nativePlayerSockets) {
      await Promise.all([
        expect.poll(() => nativeOwnerSockets.opened).toBeGreaterThan(1),
        expect.poll(() => nativePlayerSockets.opened).toBeGreaterThan(1),
        expect
          .poll(() => nativeLiveSessionMessageCount(nativeOwnerSockets, 'TRANSIENT_READY'))
          .toBeGreaterThan(ownerReadyBeforeReload),
        expect
          .poll(() => nativeLiveSessionMessageCount(nativePlayerSockets, 'TRANSIENT_READY'))
          .toBeGreaterThan(playerReadyBeforeReload)
      ])
    }
    await input.verifyState('reconnected')
    if (nativePlayerSockets) expectPlayerWirePrivacy(nativePlayerSockets, playerConvexSocket, input)
    if (input.revokePlayer && nativePlayerSockets) {
      stage = 'verify departed player refusal'
      const closedBeforeDeparture = nativePlayerSockets.closed
      await input.revokePlayer()
      await expectNativeLiveSessionClosed(nativePlayerSockets, closedBeforeDeparture + 1)
      const readyBeforeDeparture = nativeLiveSessionMessageCount(
        nativePlayerSockets,
        'TRANSIENT_READY'
      )
      const departureResponse = await player.reload({
        waitUntil: 'domcontentloaded',
        timeout: 90_000
      })
      expect(departureResponse?.status()).toBe(404)
      await expect(
        player.getByRole('heading', { name: 'Page not found', exact: true })
      ).toBeVisible({
        timeout: 30_000
      })
      await expect(
        player.getByRole('region', { name: `Live scene: ${input.sceneName}` })
      ).toHaveCount(0)
      await player.waitForTimeout(30_000)
      expect(nativeLiveSessionMessageCount(nativePlayerSockets, 'TRANSIENT_READY')).toBe(
        readyBeforeDeparture
      )
    }
    await Promise.all([
      owner.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/scene-live-owner-reconnected.png`,
        fullPage: true
      }),
      player.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/scene-live-player-reconnected.png`,
        fullPage: true
      })
    ])
    expect(forbiddenLegacyRequests).toEqual([])
    return { globalDiagnostics: diagnostics }
  } catch (error) {
    failure = scrub(error instanceof Error ? error.message : 'Scene live browser failed.', input)
    await Promise.all([
      owner?.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/scene-live-owner-failure.png`,
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/scene-live-player-failure.png`,
        fullPage: true
      })
    ])
    throw new Error(scrub(`${failure} | diagnostics: ${diagnostics.join(' | ')}`, input))
  } finally {
    await browser.close()
    for (const diagnostic of abortedRequests.values()) diagnostics.push(diagnostic)
    const tabletopPath = `/tabletop/campaigns/${encodeURIComponent(input.publicId)}`
    const expectedDiagnostics = diagnostics.filter((entry) =>
      isExpectedSceneLiveDiagnostic(entry, tabletopPath)
    )
    const unexpectedDiagnostics = diagnostics.filter(
      (entry) => !isExpectedSceneLiveDiagnostic(entry, tabletopPath)
    )
    await writeFile(
      `${input.evidenceDirectory}/scene-live-diagnostics.json`,
      JSON.stringify(
        {
          stage,
          failure,
          diagnostics: diagnostics.map((value) => scrub(value, input)),
          expectedDiagnostics: expectedDiagnostics.map((value) => scrub(value, input)),
          unexpectedDiagnostics: unexpectedDiagnostics.map((value) => scrub(value, input)),
          forbiddenLegacyRequests,
          nativeSockets: [nativeOwnerSocketsForDiagnostics, nativePlayerSocketsForDiagnostics].map(
            (trace, index) => ({
              account: index === 0 ? 'owner' : 'player',
              expectedOrigin: trace?.expectedOrigin ?? null,
              opened: trace?.opened ?? 0,
              closed: trace?.closed ?? 0,
              framesSent: trace?.framesSent.length ?? 0,
              framesReceived: trace?.framesReceived.length ?? 0,
              recentFrames: trace ? nativeLiveSessionFrameSummary(trace) : [],
              observedEndpoints: [...new Set(trace?.observedEndpoints ?? [])],
              origins: [...new Set(trace?.urls.map((url) => new URL(url).origin) ?? [])]
            })
          ),
          playerConvexSocket: playerConvexSocketForDiagnostics
            ? {
                checkpoints: playerConvexSocketForDiagnostics.checkpoints,
                closed: playerConvexSocketForDiagnostics.closed,
                opened: playerConvexSocketForDiagnostics.opened
              }
            : null,
          nativeAuthenticationRefresh: nativeAuthenticationRefresh ?? null
        },
        null,
        2
      )
    )
    if (!failure) {
      expect(forbiddenLegacyRequests).toEqual([])
      expect(unexpectedDiagnostics.map((value) => scrub(value, input))).toEqual([])
    }
  }
}

async function openTabletop(
  page: Page,
  input: SceneLiveVerificationInput,
  session: { authenticated: boolean }
): Promise<void> {
  session.authenticated = false
  await page.goto(`${origin}/tabletop/campaigns/${encodeURIComponent(input.publicId)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await waitForRouterIdle(page)
}

async function reloadTabletop(page: Page, session: { authenticated: boolean }): Promise<void> {
  session.authenticated = false
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect.poll(() => session.authenticated, { timeout: 30_000 }).toBe(true)
  await waitForRouterIdle(page)
}

async function assertOwnerScene(
  page: Page,
  sceneName: string,
  publicTokenName: string,
  privateTokenName: string
): Promise<void> {
  await expect(page.getByRole('region', { name: `Live scene: ${sceneName}` })).toBeVisible({
    timeout: 90_000
  })
  await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(
    page
      .getByRole('region', { name: `Live scene: ${sceneName}` })
      .getByText('Edit', { exact: true })
  ).toBeVisible()
  const controls = await sceneControls(page)
  await expect(controls.getByRole('menuitem', { name: `Focus ${publicTokenName}` })).toBeVisible()
  await expect(controls.getByRole('menuitem', { name: `Focus ${privateTokenName}` })).toBeVisible()
}

async function assertPlayerScene(
  page: Page,
  sceneName: string,
  publicTokenName: string,
  privateTokenName: string
): Promise<void> {
  await expect(page.getByRole('region', { name: `Live scene: ${sceneName}` })).toBeVisible({
    timeout: 90_000
  })
  await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('radio', { name: 'Edit', exact: true })).toHaveCount(0)
  const controls = await sceneControls(page)
  await expect(controls.getByRole('menuitem', { name: `Focus ${publicTokenName}` })).toBeVisible()
  await assertPrivateTokenAbsent(controls, privateTokenName)
}

async function assertPrivateTokenAbsent(
  controls: Locator,
  privateTokenName: string
): Promise<void> {
  await expect(
    controls.getByRole('menuitem', { name: `Focus ${privateTokenName}`, exact: true })
  ).toHaveCount(0)
}

async function sceneControls(page: Page): Promise<Locator> {
  const menu = page.getByRole('menu', { name: 'Scene controls', exact: true })
  if (await menu.isVisible()) return menu
  await page.getByRole('button', { name: 'Scene controls', exact: true }).click()
  await expect(menu).toBeVisible()
  return menu
}

export function captureLegacyRequests(
  page: Page,
  account: 'owner' | 'player',
  currentStage: () => string,
  legacyRequests: string[]
): void {
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (
      /^(?:\/api\/trpc\/(?:campaigns\.scenes(?:[,.]|$)|encounters(?:[,.]|$)|campaigns\.sessions\.ticket(?:[,.]|$))|\/api\/trpc\/media\.(?:getVttMapDelivery|getImage)(?:[,.]|$))/.test(
        pathname
      )
    )
      legacyRequests.push(`${account} ${currentStage()}: ${request.method()} ${pathname}`)
  })
}

type ConvexSocketTrace = {
  checkpoints: {
    closedAfterDisconnect: number | null
    closedBeforeDisconnect: number | null
    openedAfterReconnect: number | null
    openedBeforeDisconnect: number | null
  }
  closed: number
  framesReceived: string[]
  opened: number
}

async function traceConvexSocket(context: BrowserContext, page: Page): Promise<ConvexSocketTrace> {
  const trace: ConvexSocketTrace = {
    checkpoints: {
      closedAfterDisconnect: null,
      closedBeforeDisconnect: null,
      openedAfterReconnect: null,
      openedBeforeDisconnect: null
    },
    closed: 0,
    framesReceived: [],
    opened: 0
  }
  // A literal browser script avoids tsx's external function-name helpers during serialization.
  await context.addInitScript({
    content: String.raw`
    const sockets = []
    window.WebSocket = new Proxy(window.WebSocket, {
      construct(target, args) {
        const socket = Reflect.construct(target, args)
        if (/^\/api\/[^/]+\/sync$/.test(new URL(socket.url).pathname)) sockets.push(socket)
        return socket
      }
    })
    Object.defineProperty(window, 'closeSceneProofConvexSocket', {
      value: () => {
        const socket = sockets.findLast((candidate) => candidate.readyState === WebSocket.OPEN)
        if (!socket) throw new Error('No active Convex WebSocket was observed.')
        socket.close(1000, 'Browser reconnect proof')
      }
    })
  `
  })
  page.on('websocket', (socket) => {
    if (!isConvexSyncSocket(new URL(socket.url()))) return
    trace.opened += 1
    socket.on('close', () => {
      trace.closed += 1
    })
    socket.on('framereceived', ({ payload }) => {
      trace.framesReceived.push(payload.toString())
    })
  })
  return trace
}

async function expectPingFanoutBoth(
  owner: Page,
  player: Page,
  sceneName: string,
  nativeOwnerSockets: Parameters<typeof expectNativePingFanout>[0],
  nativePlayerSockets: Parameters<typeof expectNativePingFanout>[0]
): Promise<void> {
  // GM pings follow the GM's preview audience, which is private by default.
  const sharePreviews = owner.getByRole('button', { name: 'Show my previews to players' })
  if ((await sharePreviews.getAttribute('aria-pressed')) !== 'true') await sharePreviews.click()
  for (const [sender, sent, recipient] of [
    [owner, nativeOwnerSockets, nativePlayerSockets],
    [player, nativePlayerSockets, nativeOwnerSockets]
  ] as const) {
    await sender.keyboard.press('Escape')
    const canvas = sender
      .getByRole('region', { name: `Live scene: ${sceneName}` })
      .locator('canvas')
    const bounds = await canvas.boundingBox()
    if (!bounds) throw new Error('Live Scene canvas is unavailable.')
    const sentAfter = sent.framesSent.length
    let pingStep = 0
    try {
      await expectNativePingFanout(sent, recipient, sentAfter, async () => {
        const offset = pingStep++ % 2 === 0 ? 0.4 : 0.6
        await sender.mouse.move(bounds.x + bounds.width * offset, bounds.y + bounds.height * offset)
        // A press held past the tabletop's 500 ms long press sends one ping.
        await sender.mouse.down()
        await sender.waitForTimeout(600)
        await sender.mouse.up()
      })
    } catch (error) {
      throw new Error(
        `${sender === owner ? 'Owner to player' : 'Player to owner'} ping fanout failed.`,
        { cause: error }
      )
    }
  }
}

function expectPlayerWirePrivacy(
  nativeSockets: Parameters<typeof expectNativeLiveSessionPrivacy>[0],
  convexSocket: ConvexSocketTrace,
  input: SceneLiveVerificationInput
): void {
  expectNativeLiveSessionPrivacy(nativeSockets, input.privateTokenId, input.privateTokenName)
  for (const forbidden of [input.privateTokenId, input.privateTokenName])
    expect(convexSocket.framesReceived.some((frame) => frame.includes(forbidden))).toBe(false)
}

function isConvexSyncSocket(url: URL): boolean {
  return url.origin !== origin && /^\/api\/[^/]+\/sync$/.test(url.pathname)
}

function scrub(value: string, input: SceneLiveVerificationInput): string {
  return value
    .replace(/(https?:\/\/[^?\s"'<>]+)\?[^\s"'<>]+/g, '$1?[redacted]')
    .replaceAll(input.owner.email, '[owner email]')
    .replaceAll(input.owner.password, '[owner password]')
    .replaceAll(input.player.email, '[player email]')
    .replaceAll(input.player.password, '[player password]')
    .replaceAll(input.privateTokenId, '[private token id]')
    .replaceAll(input.privateTokenName, '[private token label]')
}
