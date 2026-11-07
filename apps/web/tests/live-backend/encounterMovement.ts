import { mkdir, writeFile } from 'node:fs/promises'
import {
  chromium,
  expect as playwrightExpect,
  type BrowserContext,
  type Page
} from '@playwright/test'
import {
  LIVE_SESSION_PATH_PREFIX,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { SceneFogPublishCommandInput } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import {
  captureDiagnostics,
  signIn,
  waitForRouterIdle,
  watchAuthenticatedSession
} from './campaignCollaboration'
import { captureLegacyRequests } from './sceneLive'
import { isExpectedSceneLiveDiagnostic } from './sceneLiveDiagnostics'

const expect = playwrightExpect.configure({ timeout: 90_000 })
const origin = 'http://localhost:3000'

export type EncounterMovementAccount = {
  email: string
  password: string
  username: string
}

type EncounterMovementStage =
  | 'hydrated'
  | 'passage-issued'
  | 'passage-initiator-resolved'
  | 'reaction-resolved'
  | 'replayed'
  | 'reconnected'
  | 'departed'

type EncounterMovementBrowserInput = {
  scenario?: 'REACTION' | 'PASSAGE'
  owner: EncounterMovementAccount
  player: EncounterMovementAccount
  campaign: { id: string; publicId: string }
  scene: { id: string; name: string; map: { width: number; height: number } }
  mover: {
    actorId: string
    tokenId: string
    label: string
    from: { x: number; y: number }
    to: { x: number; y: number }
  }
  reactor: { actorId: string; tokenId: string; actionId: string }
  evidenceDirectory: string
  retryExactMovement: (frame: RoomSceneCommandFrame) => Promise<void>
  readPending: () => Promise<PendingEncounterRuleOccurrenceSummaryDto | null>
  readPlayerPending: () => Promise<PendingEncounterRuleOccurrenceSummaryDto | null>
  /**
   * The reaction offer as the room holds it, checked before the reactor answers: the offer counts
   * down while a Convex read waits for the checkpoint (D207). `sceneVersion` and `moverPosition`
   * come from the newest room commit either tab received.
   */
  verifyReactionOffer: (issued: {
    sceneVersion: number
    moverPosition: { x: number; y: number }
  }) => Promise<void>
  /** `observedSceneVersion` is the newest Scene version a room commit reported to either tab. */
  verifyAuthoritative: (
    stage: EncounterMovementStage,
    observedSceneVersion: number
  ) => Promise<void>
  /** The authoritative token, fog, Run and Character still match the settled movement. */
  verifySettledMovement: () => Promise<void>
  revokePlayer: () => Promise<void>
}

/** A Scene command the tabletop sent through the Session room, with the sequence it carried. */
type RoomSceneCommandFrame = {
  command: SceneCommandInputDto | SceneFogPublishCommandInput
  expectedSessionSequence: number
}

/** A Scene commit a tab received from the room, with the token moves its delta carried. */
type RoomSceneCommit = {
  sceneId: string
  version: number
  tokenMoves: { tokenId: string; position: { x: number; y: number } }[]
}

type RoomCommandRejection = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: 'COMMAND_REJECTED' }
>

type EncounterMovementBrowserResult = { globalDiagnostics: string[] }

export async function verifyEncounterMovementBrowser(
  input: EncounterMovementBrowserInput
): Promise<EncounterMovementBrowserResult> {
  await mkdir(input.evidenceDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const diagnostics: string[] = []
  const abortedRequests = new Map<string, string>()
  const forbiddenLegacyRequests: string[] = []
  let stage = 'sign in'
  let failure: string | undefined
  let owner: Page | undefined
  let player: Page | undefined
  let movementCommand: RoomSceneCommandFrame | undefined
  let undoCommand: RoomSceneCommandFrame | undefined
  let undoRejection: RoomCommandRejection | undefined
  let playerConvexSocketForDiagnostics: ConvexSocketTrace | undefined
  let pendingAtFailure: unknown
  let observedSceneVersion = 0
  let moverRoomPosition: { version: number; position: { x: number; y: number } } | undefined
  const observeSceneCommit = (commit: RoomSceneCommit) => {
    if (commit.sceneId !== input.scene.id) return
    observedSceneVersion = Math.max(observedSceneVersion, commit.version)
    const moved = commit.tokenMoves.filter((move) => move.tokenId === input.mover.tokenId).at(-1)
    if (moved && commit.version >= (moverRoomPosition?.version ?? 0))
      moverRoomPosition = { version: commit.version, position: moved.position }
  }
  const verifyAuthoritative = (stage: EncounterMovementStage) =>
    input.verifyAuthoritative(stage, observedSceneVersion)

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
    owner = await ownerContext.newPage()
    player = await playerContext.newPage()
    const playerConvexSocket = await traceConvexSocket(playerContext, player)
    playerConvexSocketForDiagnostics = playerConvexSocket
    const ownerSession = watchAuthenticatedSession(owner)
    const playerSession = watchAuthenticatedSession(player)
    captureDiagnostics(owner, 'owner', () => stage, diagnostics, abortedRequests)
    captureDiagnostics(player, 'player', () => stage, diagnostics, abortedRequests)
    captureLegacyRequests(owner, 'owner', () => stage, forbiddenLegacyRequests)
    captureLegacyRequests(player, 'player', () => stage, forbiddenLegacyRequests)
    for (const [label, page] of [
      ['owner', owner],
      ['player', player]
    ] as const) {
      page.on('websocket', (socket) => {
        const queryNames = new Map<number, string>()
        socket.on('framesent', ({ payload }) => {
          const message: unknown = JSON.parse(payload.toString())
          if (!message || typeof message !== 'object' || !('modifications' in message)) return
          if (!Array.isArray(message.modifications)) return
          const modifications: unknown[] = message.modifications
          for (const modification of modifications) {
            if (
              modification &&
              typeof modification === 'object' &&
              'queryId' in modification &&
              typeof modification.queryId === 'number' &&
              'udfPath' in modification &&
              typeof modification.udfPath === 'string'
            )
              queryNames.set(modification.queryId, modification.udfPath)
          }
        })
        socket.on('framereceived', ({ payload }) => {
          const message: unknown = JSON.parse(payload.toString())
          if (!message || typeof message !== 'object' || !('modifications' in message)) return
          if (!Array.isArray(message.modifications)) return
          const modifications: unknown[] = message.modifications
          for (const modification of modifications) {
            if (
              modification &&
              typeof modification === 'object' &&
              'type' in modification &&
              modification.type === 'QueryFailed' &&
              'errorMessage' in modification &&
              typeof modification.errorMessage === 'string'
            ) {
              const queryName =
                'queryId' in modification && typeof modification.queryId === 'number'
                  ? queryNames.get(modification.queryId)
                  : undefined
              diagnostics.push(
                `${label} ${stage}: ${queryName ?? 'query'}: ${modification.errorMessage}`
              )
            }
          }
        })
      })
    }
    // The tabletop sends moves and undo through the Session room (D42, D43).
    captureRoomSceneCommands(player, {
      command: (frame) => {
        if (frame.command.type === 'MOVE_SCENE_TOKEN') movementCommand ??= frame
      },
      rejection: () => undefined,
      sceneCommit: observeSceneCommit
    })
    captureRoomSceneCommands(owner, {
      command: (frame) => {
        if (frame.command.type === 'UNDO_LAST_SCENE_MOVE') undoCommand ??= frame
      },
      rejection: (rejection) => {
        if (rejection.commandId === undoCommand?.command.commandId) undoRejection ??= rejection
      },
      sceneCommit: observeSceneCommit
    })

    await Promise.all([
      signIn(owner, input.owner, ownerSession),
      signIn(player, input.player, playerSession)
    ])
    stage = 'hydrate movement scene'
    await Promise.all([
      openTabletop(owner, input, ownerSession),
      openTabletop(player, input, playerSession)
    ])
    await Promise.all([assertScene(owner, input.scene.name), assertScene(player, input.scene.name)])
    await verifyAuthoritative('hydrated')
    expect(diagnostics.filter((entry) => entry.includes('Server Error'))).toEqual([])

    stage = 'issue voluntary movement'
    await dragToken(player, input)
    await expect.poll(() => movementCommand).toBeDefined()
    stage = 'await movement decision'
    await expect
      .poll(async () => (await input.readPending())?.kind)
      .toBe(input.scenario === 'PASSAGE' ? 'MOVEMENT_PASSAGE_CHOICE' : 'MOVEMENT_REACTION')
    await expect(
      owner.getByRole('button', { name: 'Open pending decision', exact: true })
    ).toBeVisible()
    // A movement reaction's countdown runs from the commit that offers it (D207), so its issued
    // state is read from the room below, not from Convex after a checkpoint wait.
    if (input.scenario === 'PASSAGE') await verifyAuthoritative('passage-issued')

    if (input.scenario === 'PASSAGE') {
      stage = 'select Passage option'
      await expect(
        owner.getByRole('button', { name: 'Open pending decision', exact: true })
      ).toBeVisible()
      await player.getByRole('button', { name: 'Open pending decision', exact: true }).click()
      await expect(player.getByText('Passage choice', { exact: true })).toBeVisible()
      // Passage options name the rule, the mover's authored check and its cost (MOVE-4.T1).
      await player
        .getByRole('button', { name: 'Overrun · Strength (Athletics) · Action', exact: true })
        .click()
      await expect.poll(async () => (await input.readPlayerPending())?.kind).toBe('D20_EVIDENCE')
      await resolveEvidence(player, input.readPlayerPending, 'max', true)
      await verifyAuthoritative('passage-initiator-resolved')
      await expect(
        player.getByRole('button', { name: 'Open pending decision', exact: true })
      ).toHaveCount(0)
      await expect(
        owner.getByRole('button', { name: 'Open pending decision', exact: true })
      ).toBeVisible()
      await expect.poll(input.readPlayerPending).toBeNull()
      await owner.getByRole('button', { name: 'Open pending decision', exact: true }).click()
      await resolveEvidence(owner, input.readPending, 'min', true)
    }

    stage = 'verify private reaction audience'
    await expect(
      player.getByRole('button', { name: 'Open pending decision', exact: true })
    ).toHaveCount(0)
    await expect(player.getByText('Reaction available', { exact: true })).toHaveCount(0)
    if (!(await owner.getByText('Reaction available', { exact: true }).isVisible()))
      await owner.getByRole('button', { name: 'Open pending decision', exact: true }).click()
    await expect(owner.getByText('Reaction available', { exact: true })).toBeVisible()
    const reaction = owner.getByRole('button', {
      name: `Use ${input.reactor.actionId}`,
      exact: true
    })
    await expect(reaction).toBeVisible()
    if (!moverRoomPosition) throw new Error('No room commit reported the mover position.')
    await input.verifyReactionOffer({
      sceneVersion: observedSceneVersion,
      moverPosition: moverRoomPosition.position
    })

    stage = 'resolve reaction evidence'
    await reaction.click()
    await resolveEvidence(owner, input.readPending)
    await expect(
      owner.getByRole('button', { name: 'Open pending decision', exact: true })
    ).toHaveCount(0)
    await verifyAuthoritative('reaction-resolved')

    stage = 'reconnect after completed command'
    const openedBeforeDisconnect = playerConvexSocket.opened
    const closedBeforeDisconnect = playerConvexSocket.closed
    await playerContext.setOffline(true)
    await player.evaluate(() => {
      const close = (window as Window & { closeEncounterMovementConvexSocket?: () => void })
        .closeEncounterMovementConvexSocket
      if (!close) throw new Error('Movement proof socket instrumentation is unavailable.')
      close()
    })
    await expect.poll(() => playerConvexSocket.closed).toBeGreaterThan(closedBeforeDisconnect)
    await playerContext.setOffline(false)
    await expect.poll(() => playerConvexSocket.opened).toBeGreaterThan(openedBeforeDisconnect)
    await assertScene(player, input.scene.name)
    await verifyAuthoritative('reconnected')

    stage = 'retry exact movement command after reconnect'
    if (!movementCommand) throw new Error('Browser did not expose the submitted movement command.')
    await input.retryExactMovement(movementCommand)
    await verifyAuthoritative('replayed')

    stage = 'reload converged clients'
    await Promise.all([reloadTabletop(owner, ownerSession), reloadTabletop(player, playerSession)])
    await Promise.all([assertScene(owner, input.scene.name), assertScene(player, input.scene.name)])
    await verifyAuthoritative('reconnected')

    // A Scene undo restores only the token, so the room refuses one for a move that settled
    // Encounter mechanics (SPELLS-17.6, docs/architecture/rules-runtime.md); this move did.
    stage = 'refuse undo of settled token move'
    await expect(
      player.getByRole('button', { name: 'Undo last token move', exact: true })
    ).toHaveCount(0)
    const undo = owner.getByRole('button', { name: 'Undo last token move', exact: true })
    await expect(undo).toBeVisible()
    await input.verifySettledMovement()
    await undo.click()
    await expect.poll(() => undoCommand).toBeDefined()
    await expect.poll(() => undoRejection).toBeDefined()
    if (!undoCommand || !undoRejection)
      throw new Error('Browser did not expose the submitted undo command and its refusal.')
    expect(undoRejection.commandId).toBe(undoCommand.command.commandId)
    expect(undoRejection.code).toBe('INVALID_COMMAND')
    await expect(
      owner.getByText(
        'This move settled Encounter mechanics and cannot be undone as a Scene move.',
        { exact: true }
      )
    ).toBeVisible()
    await input.verifySettledMovement()

    await Promise.all([
      owner.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/movement-reaction-owner-converged.png`,
        fullPage: true
      }),
      player.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/movement-reaction-player-converged.png`,
        fullPage: true
      })
    ])

    stage = 'verify departed player refusal'
    await input.revokePlayer()
    await player.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
    // Signed-in pages are a skeleton on the server (D75), so the refusal is the client-rendered page.
    await expect(player.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
    await expect(
      player.getByRole('region', { name: `Live scene: ${input.scene.name}` })
    ).toHaveCount(0)
    await verifyAuthoritative('departed')

    await Promise.all([
      owner.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/movement-reaction-owner.png`,
        fullPage: true
      }),
      player.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/movement-reaction-player-departed.png`,
        fullPage: true
      })
    ])
    expect(forbiddenLegacyRequests).toEqual([])
    return { globalDiagnostics: diagnostics }
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Movement reaction browser failed.'
    pendingAtFailure = await Promise.allSettled([input.readPending(), input.readPlayerPending()])
    await Promise.all([
      owner?.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/movement-reaction-owner-failure.png`,
        fullPage: true
      }),
      player?.screenshot({
        caret: 'initial',
        path: `${input.evidenceDirectory}/movement-reaction-player-failure.png`,
        fullPage: true
      })
    ])
    throw error
  } finally {
    await browser.close()
    for (const diagnostic of abortedRequests.values()) diagnostics.push(diagnostic)
    const tabletopPath = `/tabletop/campaigns/${encodeURIComponent(input.campaign.publicId)}`
    const unexpectedDiagnostics = diagnostics.filter(
      (entry) => !isExpectedSceneLiveDiagnostic(entry, tabletopPath)
    )
    await writeFile(
      `${input.evidenceDirectory}/movement-reaction-diagnostics.json`,
      JSON.stringify(
        {
          stage,
          failure,
          movementCommand,
          undoCommand,
          undoRejection,
          playerConvexSocket: playerConvexSocketForDiagnostics
            ? {
                closed: playerConvexSocketForDiagnostics.closed,
                opened: playerConvexSocketForDiagnostics.opened
              }
            : null,
          pendingAtFailure,
          diagnostics,
          unexpectedDiagnostics,
          forbiddenLegacyRequests
        },
        null,
        2
      )
    )
    if (!failure) expect(unexpectedDiagnostics).toEqual([])
  }
}

async function openTabletop(
  page: Page,
  input: EncounterMovementBrowserInput,
  session: { authenticated: boolean }
): Promise<void> {
  session.authenticated = false
  await page.goto(`${origin}/tabletop/campaigns/${encodeURIComponent(input.campaign.publicId)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000
  })
  await expect.poll(() => session.authenticated).toBe(true)
  await waitForRouterIdle(page)
}

async function reloadTabletop(page: Page, session: { authenticated: boolean }): Promise<void> {
  session.authenticated = false
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
  await expect.poll(() => session.authenticated).toBe(true)
  await waitForRouterIdle(page)
}

async function assertScene(page: Page, sceneName: string): Promise<void> {
  await expect(page.getByRole('region', { name: `Live scene: ${sceneName}` })).toBeVisible({
    timeout: 90_000
  })
  await expect(page.getByText('Scene map ready.', { exact: true })).toBeVisible()
}

async function dragToken(page: Page, input: EncounterMovementBrowserInput): Promise<void> {
  const canvas = page
    .getByRole('region', { name: `Live scene: ${input.scene.name}` })
    .locator('canvas')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Movement reaction Scene canvas is unavailable.')
  const point = (value: { x: number; y: number }) => {
    const scale =
      Math.min(bounds.width / input.scene.map.width, bounds.height / input.scene.map.height) * 0.94
    return {
      x: bounds.x + (bounds.width - input.scene.map.width * scale) / 2 + value.x * scale,
      y: bounds.y + (bounds.height - input.scene.map.height * scale) / 2 + value.y * scale
    }
  }
  const from = point(input.mover.from)
  const to = point(input.mover.to)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

async function resolveEvidence(
  page: Page,
  readPending: () => Promise<PendingEncounterRuleOccurrenceSummaryDto | null>,
  physicalFace: 'max' | 'min' = 'max',
  stopAfterOne = false
): Promise<void> {
  let pending: PendingEncounterRuleOccurrenceSummaryDto | null = await waitForEvidence(readPending)
  while (pending) {
    const prior = pending
    if (pending.kind === 'D20_EVIDENCE') {
      const firstDie = page.getByLabel('Die 1', { exact: true })
      await expect(firstDie).toBeVisible()
      const face = physicalFace === 'max' ? pending.request.max : pending.request.min
      await firstDie.fill(String(face))
      if (pending.request.rollMode !== 'NORMAL') {
        const secondDie = page.getByLabel('Die 2', { exact: true })
        await expect(secondDie).toBeVisible()
        await secondDie.fill(String(face))
      }
      await page.getByRole('button', { name: 'Submit roll', exact: true }).click()
    } else if (pending.kind === 'ACTION_OUTCOME_EVIDENCE') {
      await expect(page.getByLabel('Result', { exact: true })).toBeVisible()
      // The app rolls the outcome; submitting keeps its faces.
      await page.getByRole('button', { name: 'Roll dice', exact: true }).click()
      const submit = page.getByRole('button', { name: 'Submit roll', exact: true })
      await expect(submit).toBeEnabled()
      await submit.click()
    } else {
      throw new Error(`Unexpected reaction evidence request: ${pending.kind}.`)
    }
    pending = await waitForPendingAdvance(readPending, prior)
    if (stopAfterOne) return
  }
}

async function waitForEvidence(
  readPending: () => Promise<PendingEncounterRuleOccurrenceSummaryDto | null>
): Promise<PendingEncounterRuleOccurrenceSummaryDto> {
  await expect.poll(async () => (await readPending())?.kind).not.toBe('MOVEMENT_REACTION')
  const pending = await readPending()
  if (!pending) throw new Error('Selected reaction completed without evidence.')
  return pending
}

async function waitForPendingAdvance(
  readPending: () => Promise<PendingEncounterRuleOccurrenceSummaryDto | null>,
  prior: PendingEncounterRuleOccurrenceSummaryDto
): Promise<PendingEncounterRuleOccurrenceSummaryDto | null> {
  await expect
    .poll(async () => {
      const next = await readPending()
      return (
        next === null ||
        next.occurrenceId !== prior.occurrenceId ||
        next.occurrenceVersion > prior.occurrenceVersion
      )
    })
    .toBe(true)
  return readPending()
}

type ConvexSocketTrace = {
  closed: number
  opened: number
}

async function traceConvexSocket(context: BrowserContext, page: Page): Promise<ConvexSocketTrace> {
  const trace: ConvexSocketTrace = { closed: 0, opened: 0 }
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
    Object.defineProperty(window, 'closeEncounterMovementConvexSocket', {
      value: () => {
        const socket = sockets.findLast((candidate) => candidate.readyState === WebSocket.OPEN)
        if (!socket) throw new Error('No active Convex WebSocket was observed.')
        socket.close(1000, 'Browser reconnect proof')
      }
    })
  `
  })
  page.on('websocket', (socket) => {
    const url = new URL(socket.url())
    if (url.origin === origin || !/^\/api\/[^/]+\/sync$/.test(url.pathname)) return
    trace.opened += 1
    socket.on('close', () => {
      trace.closed += 1
    })
  })
  return trace
}

function captureRoomSceneCommands(
  page: Page,
  capture: {
    command: (frame: RoomSceneCommandFrame) => void
    rejection: (rejection: RoomCommandRejection) => void
    sceneCommit: (commit: RoomSceneCommit) => void
  }
): void {
  page.on('websocket', (socket) => {
    if (!new URL(socket.url()).pathname.startsWith(LIVE_SESSION_PATH_PREFIX)) return
    socket.on('framesent', ({ payload }) => {
      const message = liveSessionWebSocketClientMessageDtoSchema.safeParse(
        parseFrame(payload.toString())
      )
      if (
        message.success &&
        message.data.type === 'COMMAND' &&
        message.data.command.scope === 'SCENE'
      )
        capture.command({
          command: message.data.command.command,
          expectedSessionSequence: message.data.expectedSessionSequence
        })
    })
    socket.on('framereceived', ({ payload }) => {
      const message = liveSessionWebSocketServerMessageDtoSchema.safeParse(
        parseFrame(payload.toString())
      )
      if (!message.success) return
      if (message.data.type === 'COMMAND_REJECTED') capture.rejection(message.data)
      if (message.data.type !== 'COMMAND_COMMITTED') return
      const delta = message.data.delta
      if (delta?.scope === 'SCENE') {
        const { result } = delta
        const changes =
          result.delta?.kind === 'BATCH' ? result.delta.deltas : result.delta ? [result.delta] : []
        capture.sceneCommit({
          sceneId: result.sceneId,
          version: result.version,
          tokenMoves: changes.flatMap((change) =>
            change.kind === 'TOKEN_MOVED'
              ? [{ tokenId: change.tokenId, position: change.position }]
              : []
          )
        })
      } else if (delta?.scope === 'SCENE_VERSION')
        capture.sceneCommit({ sceneId: delta.sceneId, version: delta.version, tokenMoves: [] })
    })
  })
}

function parseFrame(frame: string): unknown {
  try {
    return JSON.parse(frame)
  } catch {
    return null
  }
}
