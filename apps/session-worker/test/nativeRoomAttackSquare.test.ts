import { attackSquareChildCommandId } from '@artificer-toolkit/rules-runtime/encounterAttackSquare'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readPendingActionDecision,
  readRoomHistory,
  readRoomRollCards
} from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0xb00)
const SEEN_ID = testUuid(0xb01)
const HIDDEN_ID = testUuid(0xb02)

/** The default Scene places actor `n` at x = 150 + 100n on one row; a token is 100 px wide. */
const attackerSquare = { x: 150, y: 150 }
const seenSquare = { x: 250, y: 150 }
const hiddenSquare = { x: 350, y: 150 }
/** Beside the attacker, with no token on it. */
const emptySquare = { x: 150, y: 250 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The player's wolf bites; one wolf is drawn on the map beside it and one has its token hidden. */
function squareRoom(rolls: readonly number[] = [15], gmRolls = false) {
  const wolf = biteWolf('ATTACK')
  return actionRoom({
    rolls,
    ...(gmRolls
      ? { autoRoll: 'GAME_MASTER' as const }
      : { playerControlledActorIds: [ATTACKER_ID] }),
    hiddenActorIds: [HIDDEN_ID],
    actors: [ATTACKER_ID, SEEN_ID, HIDDEN_ID].map((id) =>
      srdCreatureActor({ id, creature: wolf, disposition: 'HOSTILE' })
    ),
    ownerFeatureId: wolf.features?.find((feature) => feature.label === 'Bite')?.id
  })
}
type Room = Awaited<ReturnType<typeof squareRoom>>

/** What the player's own socket (the one given, else a new one) is shown: the pending decision and who it waits on. */
async function playerSession(room: Room, socket?: Awaited<ReturnType<typeof connectPlayer>>) {
  const player = socket ?? (await connectPlayer(room.room.base))
  const first = player.messages.length
  player.socket.send(JSON.stringify({ type: 'SUBSCRIBE_ENCOUNTER_SESSION', timeline: false }))
  return vi.waitFor(() => {
    const message = player.messages
      .slice(first)
      .find((candidate) => candidate.type === 'ENCOUNTER_SESSION')
    if (message?.type !== 'ENCOUNTER_SESSION' || !message.session.held)
      throw new Error('The room has not sent the held Encounter session.')
    return message.session.state
  })
}

const rulesHistory = async (room: Room) => readRoomHistory(room.room.base.stub)

/** The GM names the creature standing on the square; the room's answer. */
async function answerWith(room: Room, actorId: string) {
  const decision = await room.pendingDecision()
  return room.send(room.resolveCommand(decision, { kind: 'ATTACK_SQUARE_OCCUPANT', actorId }))
}

describe('an attack aimed at a square (ATTACK-17.4)', () => {
  it('waits for the GM, who sees who stands there, while the player sees only that the GM decides', async () => {
    const room = await squareRoom()
    const started = await room.startSquareAction(hiddenSquare, 'PLAYER')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    expect(decision.pending).toMatchObject({
      kind: 'ATTACK_SQUARE_RESOLUTION',
      attackerActorId: ATTACKER_ID,
      candidateActorIds: [HIDDEN_ID],
      allowedResponses: ['ATTACK_SQUARE_OCCUPANT', 'ATTACK_SQUARE_EMPTY']
    })
    await expect(readPendingActionDecision(room.room.base.stub, false)).rejects.toThrow(
      'not shown to the GM'
    )

    const session = await playerSession(room)
    expect(session.pending).toBeNull()
    expect(session.waitingOn).toBe('GM')
    expect(JSON.stringify(session)).not.toContain('ATTACK_SQUARE')
  })

  it('runs an ordinary attack on the creature the GM names, once, and closes the square', async () => {
    const room = await squareRoom()
    await room.startSquareAction(hiddenSquare, 'PLAYER')
    const square = (await room.pendingDecision()).occurrence

    const answered = await answerWith(room, HIDDEN_ID)
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')

    const history = await rulesHistory(room)
    expect(history.occurrences.find((candidate) => candidate.id === square.id)).toMatchObject({
      state: 'COMPLETED'
    })
    // The player's attack waits for their d20, so the child holds a pending occurrence, not a receipt.
    const attack = history.occurrences.filter(
      (candidate) => candidate.rootCommandId === attackSquareChildCommandId(square.id)
    )
    expect(attack).toHaveLength(1)
    expect(attack[0]).toMatchObject({ state: 'PENDING' })
  })

  it('lets a GM attacker answer their own decision', async () => {
    const room = await squareRoom()
    const started = await room.startSquareAction(seenSquare, 'GM')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    const answered = await answerWith(room, SEEN_ID)
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  })

  it('refuses a creature that does not stand on the square, leaving the decision pending', async () => {
    const room = await squareRoom()
    await room.startSquareAction(hiddenSquare, 'PLAYER')
    const before = await room.version()

    expect((await answerWith(room, SEEN_ID)).type).toBe('COMMAND_REJECTED')
    expect(await room.version()).toBe(before)
    expect((await room.pendingDecision()).pending.kind).toBe('ATTACK_SQUARE_RESOLUTION')
  })

  it('takes the ruling from the GM alone', async () => {
    const room = await squareRoom()
    await room.startSquareAction(hiddenSquare, 'PLAYER')
    const decision = await room.pendingDecision()

    const answer = await room.sendAsPlayer(
      room.resolveCommand(decision, { kind: 'ATTACK_SQUARE_OCCUPANT', actorId: HIDDEN_ID })
    )
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect((await room.pendingDecision()).pending.kind).toBe('ATTACK_SQUARE_RESOLUTION')
  })

  it('answers a repeat of the aim and of the ruling with the stored outcome', async () => {
    const room = await squareRoom()
    const started = await room.startSquareAction(hiddenSquare, 'PLAYER')
    const square = (await room.pendingDecision()).occurrence

    // A lost reply to the aim: the same command id returns the pending decision, storing nothing new.
    const aimAgain = await room.sendAsPlayer(started.command)
    expect(aimAgain.type).toBe('COMMAND_COMMITTED')
    expect((await rulesHistory(room)).occurrences).toHaveLength(1)

    const decision = await room.pendingDecision()
    const ruling = room.resolveCommand(decision, {
      kind: 'ATTACK_SQUARE_OCCUPANT',
      actorId: HIDDEN_ID
    })
    expect((await room.send(ruling)).type).toBe('COMMAND_COMMITTED')
    const stored = await rulesHistory(room)

    // A lost reply to the ruling replays; the attack is not run twice.
    expect((await room.send(ruling)).type).toBe('COMMAND_COMMITTED')
    const replayed = await rulesHistory(room)
    expect(replayed.commands).toHaveLength(stored.commands.length)
    expect(
      replayed.occurrences.filter(
        (candidate) => candidate.rootCommandId === attackSquareChildCommandId(square.id)
      )
    ).toHaveLength(1)

    // The aim, repeated after the ruling, still stores nothing new.
    expect((await room.sendAsPlayer(started.command)).type).toBe('COMMAND_COMMITTED')
    expect((await rulesHistory(room)).commands).toHaveLength(stored.commands.length)
  })

  it('lets the GM void the square without an attack', async () => {
    const room = await squareRoom()
    await room.startSquareAction(hiddenSquare, 'PLAYER')
    const decision = await room.pendingDecision()

    const voided = await room.send({
      type: 'VOID_RULE_OCCURRENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: decision.encounterVersion,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version
    })
    expect(voided.type, JSON.stringify(voided)).toBe('COMMAND_COMMITTED')
    const history = await rulesHistory(room)
    expect(
      history.occurrences.find((candidate) => candidate.id === decision.occurrence.id)
    ).toMatchObject({ state: 'VOIDED' })
    expect(history.occurrences).toHaveLength(1)
  })

  it('never offers the attacker’s own square', async () => {
    const room = await squareRoom()
    const started = await room.startSquareAction(attackerSquare, 'PLAYER')
    expect(started.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
  })
})

/** The GM rules the square empty; the room's answer. */
async function answerEmpty(room: Room) {
  const decision = await room.pendingDecision()
  return room.send(room.resolveCommand(decision, { kind: 'ATTACK_SQUARE_EMPTY' }))
}

/** The attacker's player rolls the held d20 and settles the attack with that roll. */
async function playerRollsHeldD20(room: Room) {
  const held = await readPendingActionDecision(room.room.base.stub, false)
  if (!held || !('request' in held.pending)) throw new Error('The player holds no d20 to roll.')
  const roll = {
    type: 'ROLL_RULE_EVIDENCE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: held.encounterVersion,
    occurrenceId: held.occurrence.id,
    expectedOccurrenceVersion: held.occurrence.version,
    requestId: held.pending.request.requestId,
    rollMode: null
  }
  const rolled = await room.sendAsPlayer(roll)
  expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
  const rollRow = (await rulesHistory(room)).evidenceRolls.at(-1)
  const decision = await readPendingActionDecision(room.room.base.stub, false)
  if (!rollRow || !decision) throw new Error('The player holds no rolled d20 to settle.')
  const answer = room.resolveCommand(decision, {
    kind: 'SYSTEM_ROLL',
    requestId: roll.requestId,
    rollId: rollRow.id
  })
  const settled = await room.sendAsPlayer(answer)
  expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
  return { roll, answer }
}

/** The settled empty-square roots in the room's receipts. */
async function emptySquareRoots(room: Room) {
  const history = await rulesHistory(room)
  return history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'ATTACK_EMPTY_SQUARE'
      ? [execution.applicationOutputs]
      : []
  })
}

describe('an attack aimed at an empty square (ATTACK-17.4)', () => {
  it('asks the GM even when no token stands on the square', async () => {
    const room = await squareRoom()
    const started = await room.startSquareAction(emptySquare, 'PLAYER')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')

    expect((await room.pendingDecision()).pending).toMatchObject({
      kind: 'ATTACK_SQUARE_RESOLUTION',
      attackerActorId: ATTACKER_ID,
      candidateActorIds: [],
      allowedResponses: ['ATTACK_SQUARE_OCCUPANT', 'ATTACK_SQUARE_EMPTY']
    })
    expect((await playerSession(room)).waitingOn).toBe('GM')
  })

  it('has the attacker roll, then records a miss and spends the action whatever the die', async () => {
    // A natural 20 hits any creature, but an empty square has nothing to hit.
    const room = await squareRoom([19])
    const before = await rulesHistory(room)
    await room.startSquareAction(emptySquare, 'PLAYER')
    const square = (await room.pendingDecision()).occurrence

    const answered = await answerEmpty(room)
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    const waiting = await rulesHistory(room)
    expect(waiting.occurrences.find((candidate) => candidate.id === square.id)).toMatchObject({
      state: 'COMPLETED'
    })
    expect(
      waiting.occurrences.filter(
        (candidate) => candidate.rootCommandId === attackSquareChildCommandId(square.id)
      )
    ).toMatchObject([{ state: 'PENDING' }])
    expect(await emptySquareRoots(room)).toEqual([])

    await playerRollsHeldD20(room)
    const roots = await emptySquareRoots(room)
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatchObject({
      sourceActorId: ATTACKER_ID,
      d20: { resultPath: 'ON_MISS' }
    })

    const after = await rulesHistory(room)
    expect(after.occurrences.every((candidate) => candidate.state !== 'PENDING')).toBe(true)
    const attacker = (history: typeof after) => history.actors.find((row) => row.id === ATTACKER_ID)
    expect(attacker(after)).not.toEqual(attacker(before))
    const others = (history: typeof after) => history.actors.filter((row) => row.id !== ATTACKER_ID)
    expect(others(after)).toEqual(others(before))
    expect(await readRoomRollCards(room.room.base.stub)).toHaveLength(1)
  })

  it('rolls at once for a GM attacker, who is also the one ruling', async () => {
    const room = await squareRoom([3], true)
    await room.startSquareAction(emptySquare, 'GM')

    const answered = await answerEmpty(room)
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await emptySquareRoots(room)).toHaveLength(1)
  })

  it('answers a repeat of the ruling and of the roll with the stored outcome, and refuses a second ruling', async () => {
    const room = await squareRoom()
    await room.startSquareAction(emptySquare, 'PLAYER')
    const decision = await room.pendingDecision()
    const ruling = room.resolveCommand(decision, { kind: 'ATTACK_SQUARE_EMPTY' })
    expect((await room.send(ruling)).type).toBe('COMMAND_COMMITTED')
    const afterRuling = await rulesHistory(room)

    expect((await room.send(ruling)).type).toBe('COMMAND_COMMITTED')
    expect((await rulesHistory(room)).commands).toHaveLength(afterRuling.commands.length)
    // A different ruling on the settled square finds no decision to answer.
    const second = await room.send(
      room.resolveCommand(decision, { kind: 'ATTACK_SQUARE_OCCUPANT', actorId: HIDDEN_ID })
    )
    expect(second.type).toBe('COMMAND_REJECTED')

    const { roll, answer } = await playerRollsHeldD20(room)
    const settled = await rulesHistory(room)
    expect((await room.sendAsPlayer(roll)).type).toBe('COMMAND_COMMITTED')
    expect((await room.sendAsPlayer(answer)).type).toBe('COMMAND_COMMITTED')
    expect(await rulesHistory(room)).toEqual(settled)
    expect(await emptySquareRoots(room)).toHaveLength(1)
  })

  it('takes the attack back with one undo, restoring the spend', async () => {
    const room = await squareRoom()
    const before = await rulesHistory(room)
    await room.startSquareAction(emptySquare, 'PLAYER')
    await answerEmpty(room)
    await playerRollsHeldD20(room)
    expect(await emptySquareRoots(room)).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await rulesHistory(room)).actors).toEqual(before.actors)
  })
})

/** Ids and clock readings differ between two rooms; everything else a viewer is shown must not. */
const withoutIdentity = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<time>')
  ) as unknown

describe('what the attacker’s player can tell about an empty square (ATTACK-17.4)', () => {
  /** The same natural-1 miss rolled on a square with a hidden wolf and on one with nobody. */
  async function controllerView(aimAt: 'OCCUPIED' | 'EMPTY') {
    const room = await squareRoom([0, 0])
    const player = await connectPlayer(room.room.base)
    const first = player.messages.length
    await room.startSquareAction(aimAt === 'OCCUPIED' ? hiddenSquare : emptySquare, 'PLAYER')
    if (aimAt === 'OCCUPIED') await answerWith(room, HIDDEN_ID)
    else await answerEmpty(room)

    const prompt = await readPendingActionDecision(room.room.base.stub, false)
    const sessionBefore = await playerSession(room, player)
    const cardsBefore = await readRoomRollCards(room.room.base.stub)
    await playerRollsHeldD20(room)
    const sessionAfter = await playerSession(room, player)
    return withoutIdentity({
      prompt: prompt?.pending,
      sessionBefore,
      sessionAfter,
      cards: (await readRoomRollCards(room.room.base.stub)).slice(cardsBefore.length),
      events: player.messages.slice(first).map((message) => message.type)
    })
  }

  it('shows the same prompt, held die, roll card and events for a miss on an empty square as on a creature', async () => {
    const occupied = await controllerView('OCCUPIED')
    const empty = await controllerView('EMPTY')
    expect(empty).toEqual(occupied)
  }, 60_000)

  it('asks the d20 the actor path asks about a creature the attacker cannot see', async () => {
    const actorRoom = await squareRoom([0, 0])
    await actorRoom.startAction(HIDDEN_ID, [], actorRoom.sceneContext(2))
    const actor = await readPendingActionDecision(actorRoom.room.base.stub, false)

    const emptyRoom = await squareRoom([0, 0])
    await emptyRoom.startSquareAction(emptySquare, 'PLAYER')
    await answerEmpty(emptyRoom)
    const square = await readPendingActionDecision(emptyRoom.room.base.stub, false)

    if (!actor || !('request' in actor.pending) || !square || !('request' in square.pending))
      throw new Error('Expected both attack rolls to be waiting.')
    expect(withoutIdentity(square.pending.request)).toEqual(withoutIdentity(actor.pending.request))
  }, 60_000)
})
