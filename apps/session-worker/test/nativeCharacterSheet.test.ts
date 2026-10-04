import { SELF, runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { SignJWT } from 'jose'
import { afterEach, expect, it, vi } from 'vitest'
import {
  LIVE_SESSION_CONTROL_PATH,
  LIVE_SESSION_CONTROL_SECRET_HEADER,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  liveSessionActivationInputSchema,
  liveSessionBootstrapInputSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { liveSessionCheckpointRequestSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { liveRoomInputsInputSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  liveSessionTransientCaptureInputSchema,
  type LiveSessionTransientCapture
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { ACCOUNT_BUCKETS, ROOM_LIMITS } from '../src/roomLimits.js'
import { NO_CHECKPOINT_IO } from './checkpointIoFixture.js'
import { characterSheetInputsFixture } from './characterSheetInputsFixture.js'
import { ROOM_AUTHORIZATION_PATH, roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { ROOM_INPUTS_PATH, roomInputsResponse } from './roomInputsFixture.js'

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
async function sheetRoom() {
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
  let assignments = [{ characterId, userId: ownerId }]
  let characterDeleted = false
  const checkpoints: ReturnType<typeof liveSessionCheckpointRequestSchema.parse>[] = []
  const inputs = await characterSheetInputsFixture({
    campaignId,
    characterId,
    ownerUserId: ownerId
  })
  const accessTokens = new Map(
    await Promise.all(
      members.map(
        async ({ userId }) => [userId, await signAccessToken(userId, issuedAt)] as [string, string]
      )
    )
  )
  const capture: LiveSessionTransientCapture = {
    campaignId,
    systemId: inputs.systemId,
    observedCharacterRevisions: [],
    origin: { membershipEpoch, role: 'OWNER', userId: gmId },
    presentation: null,
    recipients: [],
    sceneEncounterId: null,
    originBoundTokenControl: [],
    sceneHeader: null,
    visionFreshness: null
  }
  const stub = env.LIVE_SESSION_ROOMS.get(env.LIVE_SESSION_ROOMS.idFromName(campaignId))
  let currentEpoch = authorityEpoch
  await runInDurableObject(stub, () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const pathname = new URL(request.url).pathname
      expect(request.headers.get('x-artificer-live-session-secret')).toBe(secret)
      if (pathname === ROOM_INPUTS_PATH) {
        const body = liveRoomInputsInputSchema.parse(await request.json())
        if (characterDeleted && body.scope.kind === 'CHARACTERS')
          return Response.json({
            kind: 'CHARACTERS',
            parts: body.scope.characterIds.map((id) => ({ status: 'DELETED', characterId: id })),
            continueCursor: null
          })
        return Response.json(
          roomInputsResponse(body.scope, {
            campaignId,
            systemId: inputs.systemId,
            ownerUserId: gmId,
            members,
            assignments,
            characterInputs: inputs.characterInputs
          })
        )
      }
      if (pathname === ROOM_AUTHORIZATION_PATH)
        return Response.json(
          roomAuthorizationResponse({
            members,
            assignments,
            characterRevisions: [{ characterId, revision: inputs.characterRevision }],
            play: {
              encounter: {
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
    command: { type: 'ADJUST_HIT_POINTS'; mode: 'DAMAGE' | 'HEAL'; amount: number },
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

  return {
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
      commandType: 'UPDATE_ACTOR',
      characterReceiptId: evidence.receipts[0]!.id
    })
  ])
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
      return row ? encounterRunActorStateSchema.parse(JSON.parse(row.stateJson)) : null
    })
  const removeId = crypto.randomUUID()
  gmCommand({ type: 'REMOVE_ACTOR', expectedVersion: 1, actorId: room.actorId }, removeId)
  await settled(removeId)
  expect(await actorState()).toMatchObject({ kind: 'CHARACTER', outOfInitiative: true })
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
  expect(await actorState()).toMatchObject({ outOfInitiative: false })
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
  await runInDurableObject(room.stub, async (instance) => {
    const clock = vi
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + ROOM_LIMITS.checkpointDeadlineMs + 1)
    try {
      await instance.alarm()
    } finally {
      clock.mockRestore()
    }
  })
  await vi.waitFor(() => expect(room.checkpoints).not.toHaveLength(0))
  const published = room.checkpoints.flatMap(({ records }) => records.changes)
  for (const table of ['campaignConversationEntries', 'campaignConversationEntryPayloads'])
    expect(
      published.filter((change) => change.table === table && change.delta !== null)
    ).toHaveLength(2)
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
