import { attackSquareChildCommandId } from '@artificer-toolkit/rules-runtime/encounterAttackSquare'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets, connectPlayer } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

const ATTACKER_ID = testUuid(0xb00)
const SEEN_ID = testUuid(0xb01)
const HIDDEN_ID = testUuid(0xb02)

/** The default Scene places actor `n` at x = 150 + 100n on one row; a token is 100 px wide. */
const attackerSquare = { x: 150, y: 150 }
const seenSquare = { x: 250, y: 150 }
const hiddenSquare = { x: 350, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The player's wolf bites; one wolf is drawn on the map beside it and one has its token hidden. */
function squareRoom() {
  const wolf = biteWolf('ATTACK')
  return actionRoom({
    rolls: [15],
    playerControlledActorIds: [ATTACKER_ID],
    hiddenActorIds: [HIDDEN_ID],
    actors: [ATTACKER_ID, SEEN_ID, HIDDEN_ID].map((id) =>
      srdCreatureActor({ id, creature: wolf, disposition: 'HOSTILE' })
    ),
    ownerFeatureId: wolf.features?.find((feature) => feature.label === 'Bite')?.id
  })
}
type Room = Awaited<ReturnType<typeof squareRoom>>

/** What the player's own socket is shown of the Encounter: the pending decision and who it waits on. */
async function playerSession(room: Room) {
  const player = await connectPlayer(room.room.base)
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
      allowedResponses: ['ATTACK_SQUARE_OCCUPANT']
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
    const attack = history.receipts.filter(
      (receipt) =>
        receipt.commandId === attackSquareChildCommandId(square.id) &&
        receipt.commandType === 'RESOLVE_ACTION'
    )
    expect(attack).toHaveLength(1)
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
      replayed.receipts.filter(
        (receipt) => receipt.commandId === attackSquareChildCommandId(square.id)
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
    expect(history.receipts.filter((receipt) => receipt.commandType === 'RESOLVE_ACTION')).toEqual(
      []
    )
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
