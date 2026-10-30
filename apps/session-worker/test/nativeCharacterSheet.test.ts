import {
  SELF,
  createExecutionContext,
  evictDurableObject,
  runInDurableObject
} from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_CHECKPOINT_BARRIER_PATH,
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_TEST_ROLLS_PATH,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT,
  LIVE_SESSION_TRY_AGAIN_MESSAGE
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import {
  liveSessionActivationInputSchema,
  liveSessionBootstrapInputSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { liveSessionCheckpointRequestSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  liveSessionRoomSceneCaptureInputSchema,
  liveSessionTransientCaptureInputSchema,
  type LiveSessionRoomSceneCapture,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'

import worker from '../src/index.js'
import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { ACCOUNT_BUCKETS, ROOM_LIMITS } from '../src/roomLimits.js'
import { NO_CHECKPOINT_IO } from './checkpointIoFixture.js'
import { publishPending } from './publishPendingFixture.js'
import { characterSheetInputsFixture } from './characterSheetInputsFixture.js'
import { darkvisionDefinition } from './srdSenseInputsFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { ROOM_INPUTS_PATH, roomInputsResponse } from './roomInputsFixture.js'
import { roomStub } from './roomTeardown.js'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const sockets: WebSocket[] = []
const activationFingerprint = 'a'.repeat(64)

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
  vi.restoreAllMocks()
})

type Role = 'OWNER' | 'PLAYER'

function signAccessToken(subject: string, issuedAt: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setExpirationTime(issuedAt + 3_600)
    .sign(new TextEncoder().encode(secret))
}

/**
 * A native room whose Character, content, System and Run reads are the real inputs of
 * `characterSheetInputsFixture`; only Convex's transport is replaced. The GM opens the room, the
 * assigned player owns the Character and a second player holds no assignment.
 */
async function sheetRoom(
  options: {
    /** How the Run's actor for the Character shows, and the Run's status. */
    run?: {
      actor?: { public?: boolean; current?: boolean }
      status?: 'ACTIVE' | 'PREPARED'
      pendingDecision?: boolean
    }
    /** Whose Character the room's one assigned Character is; the GM may play one too (CAMPAIGN-7). */
    characterOwner?: 'PLAYER' | 'GM'
  } = {}
) {
  const campaignId = crypto.randomUUID()
  const characterId = crypto.randomUUID()
  const authorityEpoch = crypto.randomUUID()
  const issuedAt = Math.floor(Date.now() / 1_000)
  const gmId = crypto.randomUUID()
  const ownerId = crypto.randomUUID()
  const strangerId = crypto.randomUUID()
  const membershipEpoch = new Date().toISOString()
  const everyone = [
    { membershipEpoch, role: 'OWNER' as const, userId: gmId },
    { membershipEpoch, role: 'PLAYER' as const, userId: ownerId },
    { membershipEpoch, role: 'PLAYER' as const, userId: strangerId }
  ]
  let members = everyone
  const characterUserId = options.characterOwner === 'GM' ? gmId : ownerId
  let assignments = [{ characterId, userId: characterUserId }]
  let characterDeleted = false
  const checkpoints: ReturnType<typeof liveSessionCheckpointRequestSchema.parse>[] = []
  const inputs = await characterSheetInputsFixture({
    campaignId,
    characterId,
    ownerUserId: characterUserId,
    ...options.run
  })
  /** The Character after a GM edit grants it Darkvision: another revision and Sheet content. */
  const edited = await characterSheetInputsFixture({
    campaignId,
    characterId,
    ownerUserId: characterUserId,
    darkvision: true
  })
  let characterEdited = false
  /**
   * How many Character reads still report a Campaign revision the System read disagrees with: a GM
   * edit landing between the two reads of one command's preparation.
   */
  let tornCharacterReads = 0
  /** Every Convex route the room called, in order. */
  const calls: string[] = []
  /** While set, the authorization read waits for it, so notices can arrive during a reload. */
  let authorizationGate: Promise<void> | null = null
  const accessTokens = new Map(
    await Promise.all(
      members.map(
        async ({ userId }) => [userId, await signAccessToken(userId, issuedAt)] as [string, string]
      )
    )
  )
  const capture: LiveSessionTransientCapture = {
    campaignId,
    origin: { membershipEpoch, role: 'OWNER', userId: gmId },
    presentation: null,
    sceneEncounterId: null,
    sceneHeader: null
  }
  const stub = roomStub(campaignId)
  let currentEpoch = authorityEpoch
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      calls.push(pathname)
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
      if (pathname === ROOM_INPUTS_PATH) {
        const body = liveRoomInputsInputSchema.parse(await request.json())
        if (characterDeleted && body.scope.kind === 'CHARACTERS')
          return Response.json({
            kind: 'CHARACTERS',
            parts: body.scope.characterIds.map((id) => ({ status: 'DELETED', characterId: id })),
            continueCursor: null
          })
        const response = roomInputsResponse(body.scope, {
          campaignId,
          systemId: inputs.systemId,
          ownerUserId: gmId,
          members,
          assignments,
          characterInputs: characterEdited
            ? { ...inputs.characterInputs, parts: edited.characterInputs.parts }
            : inputs.characterInputs,
          definitions: [darkvisionDefinition]
        })
        if (response.kind !== 'CHARACTERS' || tornCharacterReads <= 0)
          return Response.json(response)
        tornCharacterReads -= 1
        return Response.json({
          ...response,
          parts: response.parts.map((part) =>
            'revisions' in part
              ? {
                  ...part,
                  revisions: part.revisions.map((observation) =>
                    observation.scope === 'CAMPAIGN'
                      ? { ...observation, revision: crypto.randomUUID() }
                      : observation
                  )
                }
              : part
          )
        })
      }
      if (pathname === ROOM_AUTHORIZATION_PATH) {
        await authorizationGate
        return Response.json(
          roomAuthorizationResponse({
            members,
            assignments,
            characterRevisions: [
              {
                characterId,
                revision: characterEdited ? edited.characterRevision : inputs.characterRevision
              }
            ],
            play: {
              encounter:
                options.run?.status === 'PREPARED'
                  ? null
                  : {
                      encounterId: inputs.encounterId,
                      sceneId: crypto.randomUUID(),
                      healthDisplayDefault: 'HIDDEN',
                      actors: [
                        {
                          id: inputs.actorId,
                          kind: 'CHARACTER',
                          sourceId: characterId,
                          controllerUserIds: [],
                          healthDisplay: null
                        }
                      ],
                      tokens: []
                    }
            }
          })
        )
      }
      if (pathname === '/live-sessions/checkpoint') {
        const body = liveSessionCheckpointRequestSchema.parse(await request.json())
        checkpoints.push(body)
        const now = new Date().toISOString()
        return Response.json({
          status: 'COMMITTED',
          authority: {
            activationFingerprint,
            campaignId,
            createdAt: now,
            epoch: body.epoch,
            persistedSequence: body.sequence,
            persistedStateChecksum: body.checksum,
            phase: 'DO_ACTIVE',
            updatedAt: now
          },
          adopted: { characters: [] },
          io: NO_CHECKPOINT_IO
        })
      }
      if (pathname === '/live-sessions/capture') {
        const body = liveSessionTransientCaptureInputSchema.parse(await request.json())
        expect(request.headers.get('authorization')).toBe(
          `Bearer ${accessTokens.get(body.expectedUserId)}`
        )
        return Response.json({
          ...capture,
          origin: { membershipEpoch, role: body.expectedRole, userId: body.expectedUserId }
        })
      }
      if (pathname === '/live-sessions/room-scene-capture') {
        const body = liveSessionRoomSceneCaptureInputSchema.parse(await request.json())
        expect(request.headers.get('authorization')).toBeNull()
        return Response.json({
          campaignId,
          systemId: inputs.systemId,
          observedCharacterRevisions: body.observedCharacterRevisions,
          presentation: null,
          sceneEncounterId: null,
          sceneHeader: null,
          visionFreshness: null
        } satisfies LiveSessionRoomSceneCapture)
      }
      if (pathname === '/live-sessions/bootstrap') {
        const body = liveSessionBootstrapInputSchema.parse(await request.json())
        currentEpoch = body.authorityEpoch
        return Response.json({
          activationFingerprint,
          persistedSequence: 0,
          persistedStateChecksum: activationFingerprint
        })
      }
      if (pathname === '/live-sessions/activate') {
        const body = liveSessionActivationInputSchema.parse(await request.json())
        const now = new Date().toISOString()
        return Response.json({
          activationFingerprint,
          campaignId,
          createdAt: now,
          epoch: currentEpoch,
          persistedSequence: 0,
          persistedStateChecksum: body.stateChecksum,
          phase: 'DO_ACTIVE',
          updatedAt: now
        })
      }
      throw new Error(`Unexpected native request: ${pathname}`)
    })
  })

  async function connect(userId: string, role: Role) {
    const ticket = await new SignJWT({
      authSubject: `auth-${userId}`,
      authorityEpoch,
      campaignId,
      role,
      v: LIVE_SESSION_TICKET_VERSION
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(LIVE_SESSION_TICKET_ISSUER)
      .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
      .setSubject(userId)
      .setJti(crypto.randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 60)
      .sign(new TextEncoder().encode(secret))
    const response = await stub.fetch(
      new Request(`https://session.test/live-session/${campaignId}`, {
        headers: { upgrade: 'websocket', 'x-artificer-live-session-ticket': ticket }
      })
    )
    const socket = response.webSocket
    if (!socket) throw new Error('Missing native test WebSocket.')
    sockets.push(socket)
    const messages: LiveSessionWebSocketServerMessageDto[] = []
    socket.addEventListener('message', (event) => {
      messages.push(
        liveSessionWebSocketServerMessageDtoSchema.parse(JSON.parse(String(event.data)))
      )
    })
    socket.accept()
    socket.send(JSON.stringify({ type: 'AUTHENTICATE', accessToken: accessTokens.get(userId) }))
    await vi.waitFor(() =>
      expect(messages.some((message) => message.type === 'TRANSIENT_READY')).toBe(true)
    )
    return { messages, socket }
  }

  const gm = await connect(gmId, 'OWNER')
  const owner = await connect(ownerId, 'PLAYER')
  const stranger = await connect(strangerId, 'PLAYER')

  /** One Sheet command from a member; resolves with the room's reply to that command ID. */
  async function play(
    member: Awaited<ReturnType<typeof connect>>,
    command:
      | { type: 'ADJUST_HIT_POINTS'; mode: 'DAMAGE' | 'HEAL'; amount: number }
      | { type: 'SET_PARTY_VISIBILITY'; visibility: { sheet: boolean; health: 'HIDDEN' } },
    commandId: string,
    expectedVersion: number
  ) {
    member.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'CHARACTER_SHEET',
          characterId,
          encounterId: inputs.encounterId,
          command: { ...command, commandId, expectedVersion }
        }
      })
    )
    await vi.waitFor(() =>
      expect(
        member.messages.filter(
          (message) =>
            (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
            message.commandId === commandId
        )
      ).not.toHaveLength(0)
    )
    return member.messages.filter(
      (message) =>
        (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
        message.commandId === commandId
    )
  }

  const hitPoints = () =>
    runInDurableObject(stub, (_instance, state) => {
      const row = new RoomEncounterStore(state.storage)
        .documents('characterPlayStates')
        .find((play) => play.characterId === characterId)
      if (!row) throw new Error('Missing room Character play state.')
      return { current: readCharacterPlay(row).hitpoints.current, streamVersion: row.streamVersion }
    })

  /** Convex commits the owner's account deletion: membership, assignment and Character are gone. */
  function commitAccountDeletion() {
    members = everyone.filter(({ userId }) => userId !== ownerId)
    assignments = []
    characterDeleted = true
  }

  /** Convex commits the Character's unassignment; the member stays in the Campaign. */
  function commitUnassignment() {
    assignments = []
  }

  /** Convex commits a GM edit that grants the Character Darkvision. */
  function commitCharacterEdit() {
    characterEdited = true
  }

  /** The next `reads` Character reads are torn from the System read; `Infinity` tears them all. */
  function tearCharacterReads(reads: number) {
    tornCharacterReads = reads
  }

  /** Holds authorization reads until the returned function is called. */
  function holdAuthorization() {
    let release = () => {}
    authorizationGate = new Promise<void>((resolve) => {
      release = () => {
        authorizationGate = null
        resolve()
      }
    })
    return release
  }

  return {
    calls,
    commitCharacterEdit,
    tearCharacterReads,
    holdAuthorization,
    gm,
    gmId,
    owner,
    ownerId,
    membershipEpoch,
    campaignId,
    stranger,
    play,
    hitPoints,
    characterId,
    stub,
    checkpoints,
    commitAccountDeletion,
    commitUnassignment,
    ...inputs
  }
}

it('plays a Character Sheet command through the room with the real Character rules path', async () => {
  const room = await sheetRoom()
  expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })
  const commandId = crypto.randomUUID()

  const [committed] = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    commandId,
    1
  )
  if (committed?.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(committed))
  expect(committed.delta).toMatchObject({
    scope: 'CHARACTER_SHEET',
    result: {
      streamVersion: 2,
      historyEntry: { eventType: 'ADJUST_HIT_POINTS' }
    }
  })
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })

  // The GM advances the same sequence without the Character's private history.
  await vi.waitFor(() =>
    expect(
      room.gm.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toEqual([{ type: 'COMMAND_COMMITTED', commandId, delta: null, sequence: committed.sequence }])
  )
  await vi.waitFor(() =>
    expect(
      room.stranger.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toEqual([{ type: 'COMMAND_COMMITTED', commandId, delta: null, sequence: committed.sequence }])
  )

  // An exact retry returns the stored result and does not play the command again.
  const retried = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    commandId,
    1
  )
  expect(retried.at(-1)).toEqual(committed)
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
})

it("commits a GM Encounter actor's Sheet command on the held Character with its receipt (D78)", async () => {
  const room = await sheetRoom()
  const commandId = crypto.randomUUID()
  const sheetCommandId = crypto.randomUUID()
  // The room's fetch stub throws for every Convex Encounter route, so a commit is room-native.
  room.gm.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: room.encounterId,
          commandId,
          expectedVersion: 1,
          actorId: room.actorId,
          characterCommand: {
            type: 'ADJUST_HIT_POINTS',
            commandId: sheetCommandId,
            expectedVersion: 1,
            mode: 'DAMAGE',
            amount: 3
          }
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      room.gm.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === commandId
      )
    ).toMatchObject({
      type: 'COMMAND_COMMITTED',
      delta: { scope: 'ENCOUNTER', result: { projection: { version: 2 } } }
    })
  )
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
  const evidence = await runInDurableObject(room.stub, (_instance, state) => {
    const store = new RoomEncounterStore(state.storage)
    return {
      receipts: store.documents('characterCommandReceipts'),
      commands: store.documents('encounterRunCommands')
    }
  })
  expect(evidence.receipts).toEqual([
    expect.objectContaining({
      characterId: room.characterId,
      commandId: sheetCommandId,
      actorId: room.gmId
    })
  ])
  expect(evidence.commands).toEqual([
    expect.objectContaining({
      commandId,
      commandType: 'UPDATE_ACTOR'
    })
  ])
})

it("rolls back a GM Encounter actor's Sheet write, actor, Run and room journal when the room commit fails after the Sheet write", async () => {
  const room = await sheetRoom()
  const commandId = crypto.randomUUID()
  const evidence = () =>
    runInDurableObject(room.stub, (_instance, state) => {
      const store = new RoomEncounterStore(state.storage)
      return {
        sheetReceipts: store.documents('characterCommandReceipts'),
        commands: store.documents('encounterRunCommands'),
        actors: store.documents('encounterRunActors'),
        runs: store.documents('encounterRuns'),
        journal: state.storage.sql.exec('SELECT sequence FROM durable_command_receipts').toArray()
      }
    })
  const send = () =>
    room.gm.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: {
            type: 'UPDATE_ACTOR',
            encounterId: room.encounterId,
            commandId,
            expectedVersion: 1,
            actorId: room.actorId,
            characterCommand: {
              type: 'ADJUST_HIT_POINTS',
              commandId: crypto.randomUUID(),
              expectedVersion: 1,
              mode: 'DAMAGE',
              amount: 3
            }
          }
        }
      })
    )
  const replyTo = () =>
    room.gm.messages.find(
      (message) =>
        (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
        message.commandId === commandId
    )
  const before = await evidence()
  const trigger = (sql: string) =>
    runInDurableObject(room.stub, (_instance, state) => void state.storage.sql.exec(sql))
  // The journal receipt is the room transaction's last write, after the Sheet, actor and Run writes.
  await trigger(
    "CREATE TRIGGER abort_journal_receipt AFTER INSERT ON durable_command_receipts BEGIN SELECT RAISE(ABORT, 'Injected journal failure'); END"
  )
  try {
    send()
    await vi.waitFor(() => expect(replyTo()).toMatchObject({ type: 'COMMAND_REJECTED' }))
    expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })
    expect(await evidence()).toEqual(before)
  } finally {
    await trigger('DROP TRIGGER abort_journal_receipt')
  }
  // The failed command left no journal entry: its retry commits rather than replaying.
  room.gm.messages.length = 0
  send()
  await vi.waitFor(() => expect(replyTo()).toMatchObject({ type: 'COMMAND_COMMITTED' }))
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
})

it('keeps a GM-removed Character in the held Run, out of initiative, and still playable (D82)', async () => {
  const room = await sheetRoom()
  const gmCommand = (command: object, commandId: string) =>
    room.gm.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'ENCOUNTER',
          command: { encounterId: room.encounterId, commandId, ...command }
        }
      })
    )
  const settled = (commandId: string) =>
    vi.waitFor(() => {
      const reply = room.gm.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === commandId
      )
      expect(reply).toMatchObject({ type: 'COMMAND_COMMITTED' })
    })
  const actorState = () =>
    runInDurableObject(room.stub, (_instance, state) => {
      const store = new RoomEncounterStore(state.storage)
      const row = store.documents('encounterRunActors').find(({ id }) => id === room.actorId)
      return row ? readStoredRunActor(row) : null
    })
  const removeId = crypto.randomUUID()
  gmCommand({ type: 'REMOVE_ACTOR', expectedVersion: 1, actorId: room.actorId }, removeId)
  await settled(removeId)
  expect(await actorState()).toMatchObject({ kind: 'CHARACTER', absence: 'GM_REMOVED' })
  // The room still holds the actor, so the player keeps playing the Character's Sheet.
  const [played] = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  expect(played).toMatchObject({ type: 'COMMAND_COMMITTED' })
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
  const returnId = crypto.randomUUID()
  gmCommand(
    { type: 'UPDATE_ACTOR', expectedVersion: 2, actorId: room.actorId, returnToInitiative: true },
    returnId
  )
  await settled(returnId)
  expect(await actorState()).toMatchObject({ absence: null })
})

it('refuses a Sheet command from a player who does not own the Character', async () => {
  const room = await sheetRoom()
  const commandId = crypto.randomUUID()

  const [rejected] = await room.play(
    room.stranger,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    commandId,
    1
  )

  expect(rejected).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'DOMAIN_REJECTED',
    commandId,
    message: 'Assigned Character not found.'
  })
  expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })
})

it("evicts a deleted account's player and removes its Character's actor before acknowledging (F12.4)", async () => {
  const room = await sheetRoom()
  const heldActors = () =>
    runInDurableObject(room.stub, (_instance, state) =>
      new RoomEncounterStore(state.storage).documents('encounterRunActors').map((row) => row.id)
    )
  expect(await heldActors()).toEqual([room.actorId])
  const control = (operation: object) =>
    SELF.fetch(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
      body: JSON.stringify({ campaignId: room.campaignId, operation }),
      headers: {
        'content-type': 'application/json',
        [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret
      },
      method: 'POST'
    })

  room.commitAccountDeletion()
  const commandId = crypto.randomUUID()
  const closed = new Promise<CloseEvent>((resolve) =>
    room.owner.socket.addEventListener('close', resolve, { once: true })
  )
  const evicted = await control({
    type: 'EVICT_USER',
    userId: room.ownerId,
    membershipEpoch: room.membershipEpoch
  })
  expect(await evicted.json()).toEqual({ closed: 1 })
  // The player's Sheet command still reaches for the socket Convex just closed; the room drops it.
  try {
    room.owner.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        expectedSessionSequence: 0,
        command: {
          scope: 'CHARACTER_SHEET',
          characterId: room.characterId,
          encounterId: room.encounterId,
          command: {
            type: 'ADJUST_HIT_POINTS',
            mode: 'DAMAGE',
            amount: 3,
            commandId,
            expectedVersion: 1
          }
        }
      })
    )
  } catch {
    // A socket already closed on the client refuses the send, which is the same outcome.
  }
  await expect(closed).resolves.toMatchObject({ code: 1008, reason: 'Campaign access ended.' })
  expect(
    room.owner.messages.filter(
      (message) => 'commandId' in message && message.commandId === commandId
    )
  ).toEqual([])
  expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })

  // Convex then invalidates the Campaign inputs; the room's post-commit reconcile runs.
  expect((await control({ type: 'INVALIDATE_INPUTS', scopes: ['CAMPAIGN'] })).status).toBe(200)
  await vi.waitFor(async () => expect(await heldActors()).toEqual([]))
  await vi.waitFor(() => expect(room.checkpoints).not.toHaveLength(0))

  const published = room.checkpoints.at(-1)!
  expect(
    published.records.changes.find(
      (change) =>
        change.table === 'encounterRunActors' &&
        change.key.includes(room.actorId) &&
        change.nextChecksum === null &&
        change.delta === null
    )
  ).toBeDefined()
  const journal = await runInDurableObject(room.stub, (_instance, state) => ({
    authority: state.storage.sql
      .exec<{ sequence: number; published_sequence: number }>(
        'SELECT sequence, published_sequence FROM durable_session_authority WHERE id = 1'
      )
      .one(),
    receipts: state.storage.sql
      .exec<{ sequence: number; checkpoint_before_ack: number }>(
        'SELECT sequence, checkpoint_before_ack FROM durable_command_receipts'
      )
      .toArray()
  }))
  expect(published.sequence).toBe(journal.authority.sequence)
  expect(journal.authority.published_sequence).toBe(journal.authority.sequence)
  expect(journal.receipts).toEqual([
    { sequence: journal.authority.sequence, checkpoint_before_ack: 1 }
  ])
  expect(room.owner.messages.some((message) => message.type === 'COMMAND_COMMITTED')).toBe(false)
  expect(room.gm.socket.readyState).toBe(WebSocket.READY_STATE_OPEN)
})

type SheetRoom = Awaited<ReturnType<typeof sheetRoom>>
type SheetMember = SheetRoom['gm']

function chatFrame(command: Record<string, unknown>) {
  return JSON.stringify({
    type: 'COMMAND',
    expectedSessionSequence: 0,
    command: { scope: 'CAMPAIGN_CHAT', command }
  })
}

function repliesTo(member: SheetMember, commandId: string) {
  return member.messages.filter(
    (message) =>
      (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
      message.commandId === commandId
  )
}

function tableChat(room: SheetRoom, commandId: string, body: string) {
  return {
    type: 'SEND_CHAT',
    commandId,
    input: { campaignId: room.campaignId, room: 'TABLE', mode: 'OOC', body, clientNonce: commandId }
  }
}

function roomChatEvidence(room: SheetRoom) {
  return runInDurableObject(room.stub, (_instance, state) => ({
    entries: new RoomEncounterStore(state.storage).documents('campaignConversationEntries').length,
    tokens: state.storage.sql
      .exec<{ tokens: number }>(
        "SELECT tokens FROM room_account_buckets WHERE user_id = ? AND kind = 'TABLE'",
        room.ownerId
      )
      .toArray()
      .map(({ tokens }) => tokens)
  }))
}

it('commits chat and to-GM rolls in the room to their recipients, replays exact nonces free and publishes with the next checkpoint (P14.5, D69)', async () => {
  const room = await sheetRoom()
  const chatId = crypto.randomUUID()
  const rollId = crypto.randomUUID()
  const fetchSpy = vi.mocked(globalThis.fetch)
  fetchSpy.mockClear()

  room.owner.socket.send(chatFrame(tableChat(room, chatId, 'Hello table')))
  await vi.waitFor(() => expect(repliesTo(room.owner, chatId)).toHaveLength(1))
  const [chat] = repliesTo(room.owner, chatId)
  if (chat?.type !== 'COMMAND_COMMITTED' || chat.delta?.scope !== 'CAMPAIGN_CHAT')
    throw new Error(JSON.stringify(chat))
  expect(chat.delta.entry).toMatchObject({
    room: 'TABLE',
    kind: 'CHAT',
    body: 'Hello table',
    authorUserId: room.ownerId
  })
  // The table sees the same entry at the same sequence.
  for (const member of [room.gm, room.stranger])
    await vi.waitFor(() => expect(repliesTo(member, chatId)).toEqual([chat]))
  expect(await roomChatEvidence(room)).toEqual({
    entries: 1,
    tokens: [ACCOUNT_BUCKETS.TABLE.PLAYER.capacity - 1]
  })

  // An exact retry replays the receipt and spends nothing; the same ID with other input is refused.
  room.owner.socket.send(chatFrame(tableChat(room, chatId, 'Hello table')))
  await vi.waitFor(() => expect(repliesTo(room.owner, chatId)).toHaveLength(2))
  expect(repliesTo(room.owner, chatId)[1]).toEqual(chat)
  room.owner.socket.send(chatFrame(tableChat(room, chatId, 'Another message')))
  await vi.waitFor(() => expect(repliesTo(room.owner, chatId)).toHaveLength(3))
  expect(repliesTo(room.owner, chatId)[2]).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'INVALID_COMMAND'
  })
  expect(await roomChatEvidence(room)).toEqual({
    entries: 1,
    tokens: [ACCOUNT_BUCKETS.TABLE.PLAYER.capacity - 1]
  })

  // A roll to the GM reaches only the roller and the GM; the stranger just advances the sequence.
  room.owner.socket.send(
    chatFrame({
      type: 'EXECUTE_ROLL',
      commandId: rollId,
      input: {
        campaignId: room.campaignId,
        destination: 'GM',
        clientNonce: rollId,
        roll: {
          characterId: room.characterId,
          expression: '1d20',
          source: { kind: 'MANUAL', label: 'Manual roll' }
        }
      }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.owner, rollId)).toHaveLength(1))
  const [roll] = repliesTo(room.owner, rollId)
  if (roll?.type !== 'COMMAND_COMMITTED' || roll.delta?.scope !== 'CAMPAIGN_CHAT')
    throw new Error(JSON.stringify(roll))
  expect(roll.delta.entry).toMatchObject({
    room: 'DIRECT',
    kind: 'ROLL',
    authorUserId: room.ownerId
  })
  expect(roll.sequence).toBe(chat.sequence + 1)
  await vi.waitFor(() => expect(repliesTo(room.gm, rollId)).toEqual([roll]))
  await vi.waitFor(() =>
    expect(repliesTo(room.stranger, rollId)).toEqual([
      { type: 'COMMAND_COMMITTED', commandId: rollId, sequence: roll.sequence, delta: null }
    ])
  )

  // Nothing reached Convex while the commands ran; the next checkpoint carries both entries.
  expect(fetchSpy.mock.calls.map(([input]) => new Request(input).url)).toEqual([])
  expect(room.checkpoints).toHaveLength(0)
  await publishPending(room.stub)
  expect(room.checkpoints).not.toHaveLength(0)
  const published = room.checkpoints.flatMap(({ records }) => records.changes)
  for (const table of ['campaignConversationEntries', 'campaignConversationEntryPayloads'])
    expect(
      published.filter((change) => change.table === table && change.delta !== null)
    ).toHaveLength(2)
})

// QUALITY-1.T1: the room refused such a nonce ("already sent") where Convex replays its entry.
it('replays the entry of a chat nonce the journal holds no receipt for, as Convex does, spending nothing', async () => {
  const room = await sheetRoom()
  const chatId = crypto.randomUUID()
  room.owner.socket.send(chatFrame(tableChat(room, chatId, 'Hello table')))
  await vi.waitFor(() => expect(repliesTo(room.owner, chatId)).toHaveLength(1))
  const sent = committedChat(room.owner, chatId)
  // The entry outlives its receipt, as one first sent through Convex or in an earlier epoch does.
  await runInDurableObject(room.stub, (_instance, state) => {
    state.storage.sql.exec('DELETE FROM durable_command_receipts WHERE command_id = ?', chatId)
  })
  const before = await roomChatEvidence(room)

  room.owner.socket.send(chatFrame(tableChat(room, chatId, 'Hello table')))
  await vi.waitFor(() => expect(repliesTo(room.owner, chatId)).toHaveLength(2))

  expect(committedChat(room.owner, chatId, 1).delta).toEqual(sent.delta)
  expect(await roomChatEvidence(room)).toEqual(before)
})

it('accepts queued test rolls in a local development room and rolls its next dice from them', async () => {
  const room = await sheetRoom()
  const local = {
    ...env,
    CONTENT_SNAPSHOT_TOKEN_SECRET: `${secret}-content`,
    LOCAL_CONTENT_SNAPSHOT_ORIGIN: 'http://127.0.0.1:8026'
  }
  // The room itself is real; its bindings are the local development ones, which the test worker lacks.
  await runInDurableObject(room.stub, (instance) => {
    Reflect.set(instance, 'env', local)
  })
  const queued = await worker.fetch!(
    new Request(`http://127.0.0.1:8787${LIVE_SESSION_TEST_ROLLS_PATH}/${room.campaignId}`, {
      body: JSON.stringify({ rolls: [19, 0] }),
      headers: { [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
      method: 'POST'
    }),
    local,
    createExecutionContext()
  )
  expect(queued.status).toBe(204)

  // A raw draw of 19 is the d20's face 20; the next queued draw 0 is face 1.
  const totals: number[] = []
  for (const draw of [19, 0]) {
    const rollId = crypto.randomUUID()
    room.owner.socket.send(
      chatFrame({
        type: 'EXECUTE_ROLL',
        commandId: rollId,
        input: {
          campaignId: room.campaignId,
          destination: 'GM',
          clientNonce: rollId,
          roll: {
            characterId: room.characterId,
            expression: '1d20',
            source: { kind: 'MANUAL', label: 'Manual roll' }
          }
        }
      })
    )
    await vi.waitFor(() => expect(repliesTo(room.owner, rollId)).toHaveLength(1))
    const [reply] = repliesTo(room.owner, rollId)
    if (reply?.type !== 'COMMAND_COMMITTED' || reply.delta?.scope !== 'CAMPAIGN_CHAT')
      throw new Error(JSON.stringify(reply))
    const rolled = reply.delta.entry?.roll
    if (!rolled) throw new Error('The roll entry carries no roll.')
    totals.push(rolled.evidence.total)
    expect(rolled.evidence.terms[0]?.rolls).toEqual([draw + 1])
  }
  expect(totals).toEqual([20, 1])
})

it('refuses chat past the per-account TABLE allowance without writing an entry, at the D72 allowances (P14.5)', async () => {
  expect(ACCOUNT_BUCKETS.TABLE.PLAYER).toEqual({ capacity: 30, refillPerMinute: 30 })
  expect(ACCOUNT_BUCKETS.TABLE.OWNER).toEqual({ capacity: 60, refillPerMinute: 60 })
  expect(ACCOUNT_BUCKETS.SCENE.PLAYER).toEqual({ capacity: 80, refillPerMinute: 240 })
  expect(ACCOUNT_BUCKETS.SCENE.OWNER).toEqual({ capacity: 80, refillPerMinute: 240 })

  const room = await sheetRoom()
  const firstId = crypto.randomUUID()
  room.owner.socket.send(chatFrame(tableChat(room, firstId, 'One')))
  await vi.waitFor(() => expect(repliesTo(room.owner, firstId)).toHaveLength(1))
  await runInDurableObject(room.stub, (_instance, state) => {
    state.storage.sql.exec(
      "UPDATE room_account_buckets SET tokens = 0, updated_at = ? WHERE user_id = ? AND kind = 'TABLE'",
      Date.now() + 60_000,
      room.ownerId
    )
  })
  const limitedId = crypto.randomUUID()
  room.owner.socket.send(chatFrame(tableChat(room, limitedId, 'Two')))
  await vi.waitFor(() => expect(repliesTo(room.owner, limitedId)).toHaveLength(1))
  expect(repliesTo(room.owner, limitedId)[0]).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'RATE_LIMITED'
  })
  expect(repliesTo(room.gm, limitedId)).toEqual([])
  expect((await roomChatEvidence(room)).entries).toBe(1)
})

function committedChat(member: SheetMember, commandId: string, at = 0) {
  const reply = repliesTo(member, commandId)[at]
  if (reply?.type !== 'COMMAND_COMMITTED') throw new Error(JSON.stringify(reply))
  return reply
}

it('retains a GM private roll in the room for the GM alone and posts each reveal once to the table, free on exact retry (Q14, D83)', async () => {
  const room = await sheetRoom()
  const rollId = crypto.randomUUID()
  const fullId = crypto.randomUUID()
  const noticeId = crypto.randomUUID()
  const spendOf = () =>
    runInDurableObject(room.stub, (_instance, state) =>
      state.storage.sql
        .exec<{ tokens: number }>(
          "SELECT tokens FROM room_account_buckets WHERE user_id = ? AND kind = 'TABLE'",
          room.gmId
        )
        .toArray()
        .map(({ tokens }) => tokens)
    )

  room.gm.socket.send(
    chatFrame({
      type: 'EXECUTE_PRIVATE_ROLL',
      commandId: rollId,
      input: {
        campaignId: room.campaignId,
        clientNonce: rollId,
        roll: { characterId: null, expression: '1d20', source: { kind: 'MANUAL', label: 'Secret' } }
      }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.gm, rollId)).toHaveLength(1))
  const privateReceipt = committedChat(room.gm, rollId)
  if (privateReceipt.delta?.scope !== 'CAMPAIGN_CHAT') throw new Error('Expected a chat delta.')
  expect(privateReceipt.delta.entry).toBeNull()
  expect(privateReceipt.delta.privateRoll).toMatchObject({
    id: rollId,
    gmCampaignRoll: { campaignId: room.campaignId, revealedAt: null, noticedAt: null }
  })
  // Players learn nothing: they only advance the sequence.
  for (const member of [room.owner, room.stranger])
    await vi.waitFor(() =>
      expect(repliesTo(member, rollId)).toEqual([
        {
          type: 'COMMAND_COMMITTED',
          commandId: rollId,
          sequence: privateReceipt.sequence,
          delta: null
        }
      ])
    )
  const afterRoll = await spendOf()

  // Show that I rolled: the whole table reads a notice with no result, reason or roll.
  room.gm.socket.send(
    chatFrame({
      type: 'REVEAL_ROLL',
      commandId: noticeId,
      input: { campaignId: room.campaignId, rollId, mode: 'NOTICE' }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.gm, noticeId)).toHaveLength(1))
  const notice = committedChat(room.gm, noticeId)
  if (notice.delta?.scope !== 'CAMPAIGN_CHAT') throw new Error('Expected a chat delta.')
  expect(notice.delta.entry).toMatchObject({
    room: 'TABLE',
    kind: 'ROLL_NOTICE',
    roll: null,
    body: null,
    revealedByGm: false
  })
  for (const member of [room.owner, room.stranger])
    await vi.waitFor(() => expect(repliesTo(member, noticeId)).toEqual([notice]))

  // Show roll: the full card follows, once.
  room.gm.socket.send(
    chatFrame({
      type: 'REVEAL_ROLL',
      commandId: fullId,
      input: { campaignId: room.campaignId, rollId, mode: 'FULL' }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.gm, fullId)).toHaveLength(1))
  const full = committedChat(room.gm, fullId)
  if (full.delta?.scope !== 'CAMPAIGN_CHAT') throw new Error('Expected a chat delta.')
  expect(full.delta.entry).toMatchObject({
    room: 'TABLE',
    kind: 'ROLL',
    revealedByGm: true,
    roll: { id: rollId }
  })
  await vi.waitFor(() => expect(repliesTo(room.owner, fullId)).toEqual([full]))
  const afterReveals = await spendOf()
  // Each reveal spends one token; the bucket also refills a fraction between charges.
  expect(afterReveals[0]).toBeCloseTo(afterRoll[0]! - 2, 0)

  // An exact retry replays the receipt and spends nothing; a second reveal of a mode is refused.
  room.gm.socket.send(
    chatFrame({
      type: 'REVEAL_ROLL',
      commandId: fullId,
      input: { campaignId: room.campaignId, rollId, mode: 'FULL' }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.gm, fullId)).toHaveLength(2))
  expect(repliesTo(room.gm, fullId)[1]).toEqual(full)
  expect(await spendOf()).toEqual(afterReveals)
  const again = crypto.randomUUID()
  room.gm.socket.send(
    chatFrame({
      type: 'REVEAL_ROLL',
      commandId: again,
      input: { campaignId: room.campaignId, rollId, mode: 'FULL' }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.gm, again)).toHaveLength(1))
  expect(repliesTo(room.gm, again)[0]).toMatchObject({ type: 'COMMAND_REJECTED' })

  // A roll the room never held was made before the live table started: it reveals after the session.
  const preAuthority = crypto.randomUUID()
  room.gm.socket.send(
    chatFrame({
      type: 'REVEAL_ROLL',
      commandId: preAuthority,
      input: { campaignId: room.campaignId, rollId: crypto.randomUUID(), mode: 'FULL' }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.gm, preAuthority)).toHaveLength(1))
  expect(repliesTo(room.gm, preAuthority)[0]).toMatchObject({
    type: 'COMMAND_REJECTED',
    message: 'This roll was made before the live table started; reveal it after the session.'
  })

  // A player cannot roll privately.
  const playerRoll = crypto.randomUUID()
  room.owner.socket.send(
    chatFrame({
      type: 'EXECUTE_PRIVATE_ROLL',
      commandId: playerRoll,
      input: {
        campaignId: room.campaignId,
        clientNonce: playerRoll,
        roll: { characterId: null, expression: '1d20', source: { kind: 'MANUAL', label: 'No' } }
      }
    })
  )
  await vi.waitFor(() => expect(repliesTo(room.owner, playerRoll)).toHaveLength(1))
  expect(repliesTo(room.owner, playerRoll)[0]).toMatchObject({ type: 'COMMAND_REJECTED' })
})

type SheetMessage<Type extends LiveSessionWebSocketServerMessageDto['type']> = Extract<
  LiveSessionWebSocketServerMessageDto,
  { type: Type }
>

const summariesOf = (member: SheetMember) =>
  member.messages.filter(
    (message): message is SheetMessage<'CAMPAIGN_SUMMARY'> => message.type === 'CAMPAIGN_SUMMARY'
  )

const sheetsOf = (member: SheetMember) =>
  member.messages.filter(
    (message): message is SheetMessage<'CHARACTER_SHEET'> => message.type === 'CHARACTER_SHEET'
  )

function subscribeSummary(member: SheetMember) {
  member.socket.send(JSON.stringify({ type: 'SUBSCRIBE_CAMPAIGN_SUMMARY' }))
}

function control(room: SheetRoom, operation: object) {
  return SELF.fetch(`https://session.test${LIVE_SESSION_CONTROL_PATH}`, {
    body: JSON.stringify({ campaignId: room.campaignId, operation }),
    headers: { 'content-type': 'application/json', [LIVE_SESSION_CONTROL_SECRET_HEADER]: secret },
    method: 'POST'
  })
}

const authorizationReads = (room: SheetRoom) =>
  room.calls.filter((path) => path === ROOM_AUTHORIZATION_PATH).length

/** Moves the room's clock forward until the test restores its mocks. */
function advanceRoomClock(room: SheetRoom, ms: number) {
  return runInDurableObject(room.stub, () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + ms)
  })
}

it("pushes a held Character's hit points to its owner and the GM as the Campaign summary (Amendment 19)", async () => {
  const room = await sheetRoom()
  subscribeSummary(room.owner)
  subscribeSummary(room.gm)
  await vi.waitFor(() => {
    expect(summariesOf(room.owner)).toHaveLength(1)
    expect(summariesOf(room.gm)).toHaveLength(1)
  })
  const expected = (currentHitPoints: number) => ({
    type: 'CAMPAIGN_SUMMARY',
    summary: {
      characters: [
        expect.objectContaining({
          characterId: room.characterId,
          currentHitPoints,
          maxHitPoints: 11
        })
      ],
      encounter: {
        encounterId: room.encounterId,
        status: 'ACTIVE',
        round: 1,
        currentActorId: null
      }
    }
  })
  expect(summariesOf(room.owner)[0]).toEqual(expected(11))
  expect(summariesOf(room.gm)[0]).toEqual(expected(11))

  const [committed] = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  expect(committed).toMatchObject({ type: 'COMMAND_COMMITTED' })
  await vi.waitFor(() => {
    expect(summariesOf(room.owner).at(-1)).toEqual(expected(8))
    expect(summariesOf(room.gm).at(-1)).toEqual(expected(8))
  })
})

it('keeps pushing the Campaign summary to sockets that subscribed before the room hibernated', async () => {
  const room = await sheetRoom()
  subscribeSummary(room.owner)
  subscribeSummary(room.gm)
  await vi.waitFor(() => {
    expect(summariesOf(room.owner)).toHaveLength(1)
    expect(summariesOf(room.gm)).toHaveLength(1)
  })
  await evictDurableObject(room.stub)

  const [committed] = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  expect(committed).toMatchObject({ type: 'COMMAND_COMMITTED' })
  const hitPoints = (frames: ReturnType<typeof summariesOf>) =>
    frames.at(-1)?.summary.characters[0]?.currentHitPoints
  await vi.waitFor(() => {
    expect(hitPoints(summariesOf(room.owner))).toBe(8)
    expect(hitPoints(summariesOf(room.gm))).toBe(8)
  })
})

it("never shows a player another member's Character unless its Sheet is party-visible (D87)", async () => {
  const room = await sheetRoom()
  subscribeSummary(room.stranger)
  await vi.waitFor(() => expect(summariesOf(room.stranger)).toHaveLength(1))
  // The Run is public to players; the Character is not.
  expect(summariesOf(room.stranger)[0]?.summary).toEqual({
    characters: [],
    encounter: expect.objectContaining({ encounterId: room.encounterId, status: 'ACTIVE' })
  })
  await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  subscribeSummary(room.owner)
  await vi.waitFor(() => expect(summariesOf(room.owner)).toHaveLength(1))
  expect(summariesOf(room.stranger)).toHaveLength(1)

  // Once the owner shares the Sheet (room play state), the same projection a party member reads appears.
  const [shared] = await room.play(
    room.owner,
    { type: 'SET_PARTY_VISIBILITY', visibility: { sheet: true, health: 'HIDDEN' } },
    crypto.randomUUID(),
    2
  )
  expect(shared).toMatchObject({ type: 'COMMAND_COMMITTED' })
  await vi.waitFor(() =>
    expect(summariesOf(room.stranger).at(-1)?.summary.characters).toEqual([
      expect.objectContaining({ characterId: room.characterId, currentHitPoints: 8 })
    ])
  )
})

function roleplay(room: SheetRoom, commandId: string) {
  return chatFrame({
    type: 'SEND_CHAT',
    commandId,
    input: {
      campaignId: room.campaignId,
      room: 'TABLE',
      mode: 'ROLEPLAY',
      assignedCharacterId: room.characterId,
      body: 'In character',
      clientNonce: commandId
    }
  })
}

it("plays the GM's own Character in the room as a player's: Sheet, party summary and in-character chat (CAMPAIGN-7)", async () => {
  const room = await sheetRoom({ characterOwner: 'GM' })
  const [damaged] = await room.play(
    room.gm,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  expect(damaged).toMatchObject({ type: 'COMMAND_COMMITTED' })
  const [shared] = await room.play(
    room.gm,
    { type: 'SET_PARTY_VISIBILITY', visibility: { sheet: true, health: 'HIDDEN' } },
    crypto.randomUUID(),
    2
  )
  expect(shared).toMatchObject({ type: 'COMMAND_COMMITTED' })
  subscribeSummary(room.stranger)
  await vi.waitFor(() =>
    expect(summariesOf(room.stranger).at(-1)?.summary.characters).toEqual([
      expect.objectContaining({ characterId: room.characterId, currentHitPoints: 8 })
    ])
  )

  const spokenId = crypto.randomUUID()
  room.gm.socket.send(roleplay(room, spokenId))
  await vi.waitFor(() => expect(repliesTo(room.gm, spokenId)).toHaveLength(1))
  expect(repliesTo(room.gm, spokenId)[0]).toMatchObject({
    type: 'COMMAND_COMMITTED',
    delta: { entry: { mode: 'ROLEPLAY', characterId: room.characterId, authorUserId: room.gmId } }
  })
})

it("refuses the GM speaking in character as a player's Character (CAMPAIGN-7)", async () => {
  const room = await sheetRoom()
  const refusedId = crypto.randomUUID()
  room.gm.socket.send(roleplay(room, refusedId))
  await vi.waitFor(() => expect(repliesTo(room.gm, refusedId)).toHaveLength(1))
  expect(repliesTo(room.gm, refusedId)[0]).toMatchObject({ type: 'COMMAND_REJECTED' })
  expect((await roomChatEvidence(room)).entries).toBe(0)

  const spokenId = crypto.randomUUID()
  room.owner.socket.send(roleplay(room, spokenId))
  await vi.waitFor(() => expect(repliesTo(room.owner, spokenId)).toHaveLength(1))
  expect(repliesTo(room.owner, spokenId)[0]).toMatchObject({ type: 'COMMAND_COMMITTED' })
})

it('withholds a hidden current actor from players but not the GM (ADR 0034)', async () => {
  const room = await sheetRoom({ run: { actor: { public: false, current: true } } })
  subscribeSummary(room.owner)
  subscribeSummary(room.gm)
  await vi.waitFor(() => {
    expect(summariesOf(room.owner)).toHaveLength(1)
    expect(summariesOf(room.gm)).toHaveLength(1)
  })
  expect(summariesOf(room.owner)[0]?.summary.encounter?.currentActorId).toBeNull()
  expect(summariesOf(room.gm)[0]?.summary.encounter?.currentActorId).toBe(room.actorId)
})

it('shows no Run in the Campaign summary while the Run is only PREPARED (D87)', async () => {
  const room = await sheetRoom({ run: { status: 'PREPARED' } })
  subscribeSummary(room.owner)
  subscribeSummary(room.gm)
  await vi.waitFor(() => {
    expect(summariesOf(room.owner)).toHaveLength(1)
    expect(summariesOf(room.gm)).toHaveLength(1)
  })
  for (const member of [room.owner, room.gm])
    expect(summariesOf(member)[0]?.summary).toEqual({ characters: [], encounter: null })
})

it('stops pushing the Campaign summary after the socket unsubscribes', async () => {
  const room = await sheetRoom()
  subscribeSummary(room.owner)
  subscribeSummary(room.gm)
  await vi.waitFor(() => {
    expect(summariesOf(room.owner)).toHaveLength(1)
    expect(summariesOf(room.gm)).toHaveLength(1)
  })
  room.owner.socket.send(JSON.stringify({ type: 'UNSUBSCRIBE_CAMPAIGN_SUMMARY' }))
  await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  // The GM's push is the barrier: the owner's would have come with it.
  await vi.waitFor(() => expect(summariesOf(room.gm)).toHaveLength(2))
  expect(summariesOf(room.owner)).toHaveLength(1)
})

it('commits a Sheet play command while an Encounter decision is pending, and still holds Encounter play (Amendment 20)', async () => {
  const room = await sheetRoom({ run: { pendingDecision: true } })
  const [played] = await room.play(
    room.owner,
    { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 },
    crypto.randomUUID(),
    1
  )
  expect(played).toMatchObject({ type: 'COMMAND_COMMITTED' })
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })

  // An Encounter turn command is still held behind the decision.
  const advanceId = crypto.randomUUID()
  room.gm.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      expectedSessionSequence: 0,
      command: {
        scope: 'ENCOUNTER',
        command: {
          type: 'ADVANCE_TURN',
          encounterId: room.encounterId,
          commandId: advanceId,
          expectedVersion: 1
        }
      }
    })
  )
  await vi.waitFor(() =>
    expect(
      room.gm.messages.find(
        (message) =>
          (message.type === 'COMMAND_COMMITTED' || message.type === 'COMMAND_REJECTED') &&
          message.commandId === advanceId
      )
    ).toMatchObject({ type: 'COMMAND_REJECTED' })
  )
})

it('reaches the table with a GM Feature edit and no command, through one eager reload (Amendment 21)', async () => {
  const room = await sheetRoom()
  room.owner.socket.send(
    JSON.stringify({ type: 'SUBSCRIBE_CHARACTER_SHEET', characterId: room.characterId })
  )
  await vi.waitFor(() => expect(sheetsOf(room.owner)).toHaveLength(1))
  expect(sheetsOf(room.owner)[0]?.sheet.reference.senses).toEqual([])

  // Convex commits the edit and notifies the room; several notices arrive while the first reload waits.
  room.commitCharacterEdit()
  const release = room.holdAuthorization()
  const readsBefore = authorizationReads(room)
  for (let notice = 0; notice < 4; notice += 1)
    expect((await control(room, { type: 'INVALIDATE_INPUTS', scopes: ['CHARACTER'] })).status).toBe(
      200
    )
  release()
  await vi.waitFor(() =>
    expect(sheetsOf(room.owner).at(-1)?.sheet.reference.senses).toEqual([
      expect.objectContaining({ senseId: expect.any(String) })
    ])
  )
  expect(sheetsOf(room.owner).at(-1)?.streamVersion).toBe(1)
  // The first reload, then one reload shared by the notices that arrived behind it.
  await vi.waitFor(() => expect(authorizationReads(room) - readsBefore).toBe(2))
})

/** A GM edit commits, and the owner's next command finds the lease expired and its Character stale. */
async function editBeforeNextCommand(room: SheetRoom, tornReads: number) {
  room.commitCharacterEdit()
  room.tearCharacterReads(tornReads)
  await advanceRoomClock(room, ROOM_LIMITS.authorizationLeaseMs * 1.5)
}

const damage = { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 3 } as const

it('prepares a Sheet command again from fresh inputs when a GM edit lands mid-preparation', async () => {
  const room = await sheetRoom()
  await editBeforeNextCommand(room, 1)

  const [committed] = await room.play(room.owner, damage, crypto.randomUUID(), 1)

  expect(committed).toMatchObject({ type: 'COMMAND_COMMITTED' })
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
})

it('refuses with try-again semantics when the inputs keep changing, then commits the resent command', async () => {
  const room = await sheetRoom()
  await editBeforeNextCommand(room, Infinity)
  const commandId = crypto.randomUUID()

  const [refused] = await room.play(room.owner, damage, commandId, 1)

  expect(refused).toMatchObject({
    type: 'COMMAND_REJECTED',
    code: 'UNAVAILABLE',
    message: LIVE_SESSION_TRY_AGAIN_MESSAGE
  })
  expect(await room.hitPoints()).toEqual({ current: 11, streamVersion: 1 })

  room.tearCharacterReads(0)
  await room.play(room.owner, damage, commandId, 1)
  await vi.waitFor(() =>
    expect(
      room.owner.messages.filter(
        (message) => message.type === 'COMMAND_COMMITTED' && message.commandId === commandId
      )
    ).toHaveLength(1)
  )
  expect(await room.hitPoints()).toEqual({ current: 8, streamVersion: 2 })
})

it('keeps a notice lazy while no socket is connected (Amendment 21)', async () => {
  const room = await sheetRoom()
  for (const member of [room.gm, room.owner, room.stranger]) member.socket.close()
  await vi.waitFor(async () =>
    expect(
      await runInDurableObject(room.stub, (_instance, state) => state.getWebSockets())
    ).toEqual([])
  )
  const readsBefore = authorizationReads(room)
  expect((await control(room, { type: 'INVALIDATE_INPUTS', scopes: ['CHARACTER'] })).status).toBe(
    200
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(authorizationReads(room)).toBe(readsBefore)
})

it('freezes an unassigned Character actor before a checkpoint barrier that follows a Campaign notice, with no socket connected (D74)', async () => {
  const room = await sheetRoom()
  for (const member of [room.gm, room.owner, room.stranger]) member.socket.close()
  await vi.waitFor(async () =>
    expect(
      await runInDurableObject(room.stub, (_instance, state) => state.getWebSockets())
    ).toEqual([])
  )
  room.commitUnassignment()
  // The reload is still reading when the barrier arrives; the barrier must queue behind it.
  const releaseAuthorization = room.holdAuthorization()
  expect((await control(room, { type: 'INVALIDATE_INPUTS', scopes: ['CAMPAIGN'] })).status).toBe(
    200
  )
  const pendingBarrier = room.stub.fetch(
    new Request(`https://live-session.internal${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}`, {
      method: 'POST'
    })
  )
  setTimeout(releaseAuthorization, 100)
  const barrier = await pendingBarrier
  expect(barrier.status).toBe(200)
  const frozen = await runInDurableObject(room.stub, (_instance, state) => {
    const row = new RoomEncounterStore(state.storage)
      .documents('encounterRunActors')
      .find(({ id }) => id === room.actorId)
    if (!row) throw new Error('Missing Run actor.')
    const actor = readStoredRunActor(row)
    return actor.kind === 'CHARACTER' && Boolean(actor.frozenState)
  })
  expect(frozen).toBe(true)
  expect(
    room.checkpoints
      .at(-1)
      ?.records.changes.some(
        (change) =>
          change.table === 'encounterRunActors' &&
          change.key.includes(room.actorId) &&
          change.nextChecksum !== null
      )
  ).toBe(true)
})

it('reconciles a departure before a queued checkpoint barrier when a second notice lands during the reload (D74)', async () => {
  const room = await sheetRoom()
  room.commitUnassignment()
  // The eager reload is reading when the barrier queues behind it; a second notice then lands
  // during that read, so its own reload queues behind the barrier.
  const releaseAuthorization = room.holdAuthorization()
  const readsBefore = authorizationReads(room)
  expect((await control(room, { type: 'INVALIDATE_INPUTS', scopes: ['CAMPAIGN'] })).status).toBe(
    200
  )
  await vi.waitFor(() => expect(authorizationReads(room)).toBe(readsBefore + 1))
  const pendingBarrier = room.stub.fetch(
    new Request(`https://live-session.internal${LIVE_SESSION_CHECKPOINT_BARRIER_PATH}`, {
      method: 'POST'
    })
  )
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect((await control(room, { type: 'INVALIDATE_INPUTS', scopes: ['CAMPAIGN'] })).status).toBe(
    200
  )
  releaseAuthorization()
  const barrier = await pendingBarrier
  expect(barrier.status).toBe(200)
  expect(
    room.checkpoints
      .at(-1)
      ?.records.changes.some(
        (change) =>
          change.table === 'encounterRunActors' &&
          change.key.includes(room.actorId) &&
          change.nextChecksum !== null
      )
  ).toBe(true)
})

it('makes no Convex call for an idle member, however long the quiet (Amendment 17)', async () => {
  const room = await sheetRoom()
  const callsAfterConnect = room.calls.length
  const readsAfterConnect = authorizationReads(room)
  await advanceRoomClock(room, ROOM_LIMITS.authorizationLeaseMs * 1.5)
  room.owner.socket.send(JSON.stringify({ type: 'RESUME' }))
  await vi.waitFor(() =>
    expect(room.owner.messages.filter((message) => message.type === 'STATE_SYNC')).not.toHaveLength(
      0
    )
  )
  // Only the lease renewal, at most one per half-lease, may call Convex.
  expect(
    room.calls.slice(callsAfterConnect).filter((path) => path !== ROOM_AUTHORIZATION_PATH)
  ).toEqual([])
  expect(authorizationReads(room) - readsAfterConnect).toBeLessThanOrEqual(1)
})

it('saves a burst of commands only at a save point, however long the quiet (Amendment 25)', async () => {
  const room = await sheetRoom()
  for (const [index, amount] of [1, 1, 1].entries()) {
    const [committed] = await room.play(
      room.owner,
      { type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount },
      crypto.randomUUID(),
      1 + index
    )
    expect(committed).toMatchObject({ type: 'COMMAND_COMMITTED' })
  }
  expect(room.checkpoints).toHaveLength(0)

  await advanceRoomClock(room, ROOM_LIMITS.authorizationLeaseMs * 10)
  subscribeSummary(room.owner)
  subscribeSummary(room.gm)
  await vi.waitFor(() => expect(summariesOf(room.gm)).toHaveLength(1))
  expect(room.checkpoints).toHaveLength(0)

  await publishPending(room.stub)
  expect(room.checkpoints).toHaveLength(1)
})

/**
 * The GM sends table chat until `stop` holds or `limit` is sent, and answers how many were sent.
 * Chat is rate limited per account and socket; each minute of the room's clock refills both.
 */
async function sendTableChats(
  room: SheetRoom,
  body: string,
  limit: number,
  stop: () => boolean = () => false
) {
  let sent = 0
  while (sent < limit && !stop()) {
    if (sent % 20 === 0) await advanceRoomClock(room, 60_000)
    const commandId = crypto.randomUUID()
    room.gm.socket.send(chatFrame(tableChat(room, commandId, body)))
    await vi.waitFor(() => expect(repliesTo(room.gm, commandId)).toHaveLength(1), { interval: 2 })
    expect(repliesTo(room.gm, commandId)[0]).toMatchObject({ type: 'COMMAND_COMMITTED' })
    sent += 1
  }
  return sent
}

it('saves in the background once the unsaved chat entries reach the chat push window (Amendment 25)', async () => {
  const room = await sheetRoom()
  await sendTableChats(room, 'Hello table', LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT - 1)
  expect(room.checkpoints).toHaveLength(0)

  await sendTableChats(room, 'Hello table', 1)
  await vi.waitFor(() => expect(room.checkpoints).toHaveLength(1))
  expect(room.checkpoints[0]?.reason).toBe('BACKLOG')
  const entries = room.checkpoints[0]?.records.changes.filter(
    (change) => change.table === 'campaignConversationEntries' && change.delta !== null
  )
  expect(entries).toHaveLength(LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT)

  // The save emptied the backlog, so the next entry starts a fresh count.
  await sendTableChats(room, 'Hello table', 1)
  expect(room.checkpoints).toHaveLength(1)
}, 30000)

it('does not save in the background for journal size alone, only for unsaved chat entries (Amendment 25)', async () => {
  const room = await sheetRoom()
  const sent = await sendTableChats(
    room,
    'x'.repeat(2_000),
    LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT - 1
  )
  expect(sent).toBe(LIVE_SESSION_PUSHED_CHAT_ENTRY_LIMIT - 1)
  // The journal now holds far more than one checkpoint page of raw write sets.
  expect(room.checkpoints).toHaveLength(0)
}, 30000)
