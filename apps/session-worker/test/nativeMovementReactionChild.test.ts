import { runInDurableObject } from 'cloudflare:test'
import {
  movementReactionChildCommandId,
  reactionChildMoveCommandId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { sceneStoredLiveEntitySchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { ROOM_LIMITS } from '../src/roomLimits.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import {
  plainWolf,
  pushingReactionWolf,
  reactionWolf,
  stopReactionWolf
} from '../src/testing/movementPlannerFixture.js'
import { deathBurstWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom, type MovementRoomConfig } from './movementRoomFixture.js'
import {
  readActorHitPoints,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * QUALITY-18.T2b2: a reaction chosen at a paused Scene move's contact runs as the reactor's own
 * action (D219). The option's answer records that child on the move and raises it in one room
 * transaction; the room then resumes the move by itself, once the child has committed.
 */

const MOVER_ID = testUuid(0x2b20)
const REACTOR_ID = testUuid(0x2b21)
const BYSTANDER_ID = testUuid(0x2b22)

const START: ScenePoint = { x: 150, y: 150 }
const DESTINATION: ScenePoint = { x: 600, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A FRIENDLY Wolf whose Bite is an opportunity attack stands on a HOSTILE Wolf that walks east out
 * of its reach. The GM controls both; its dice are rolled for it unless `autoRoll` says otherwise.
 * The Bite draws an attack d20 (a 15, which hits) and two bite dice (the minimum).
 */
function contactRoom(
  config: {
    reactor?: CreatureAuthored
    mover?: CreatureAuthored
    moverHitPoints?: number
    /** A plain Wolf the room's player controls, 15 feet south of the start: its dice are entered. */
    bystander?: boolean
  } & Pick<MovementRoomConfig, 'autoRoll' | 'spatialEffects'> = {}
) {
  return movementRoom({
    actors: [
      srdCreatureActor({
        id: REACTOR_ID,
        creature: config.reactor ?? reactionWolf,
        disposition: 'FRIENDLY'
      }),
      srdCreatureActor({
        id: MOVER_ID,
        creature: config.mover ?? plainWolf,
        ...(config.moverHitPoints === undefined ? {} : { currentHitPoints: config.moverHitPoints })
      }),
      ...(config.bystander ? [srdCreatureActor({ id: BYSTANDER_ID, creature: plainWolf })] : [])
    ],
    moverActorId: MOVER_ID,
    positions: { [REACTOR_ID]: START, [MOVER_ID]: START, [BYSTANDER_ID]: { x: 150, y: 450 } },
    playerControlledActorIds: config.bystander ? [BYSTANDER_ID] : [],
    autoRoll: config.autoRoll ?? 'GAME_MASTER',
    rolls: [14, 0, 0, 14],
    fallbackRoll: 0,
    spatialEffects: config.spatialEffects ?? []
  })
}
type Room = Awaited<ReturnType<typeof contactRoom>>

/** Walks the mover to the contact and returns the paused move with the one reaction it offers. */
async function walkToContact(room: Room) {
  const moved = await room.move([START, DESTINATION])
  expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
  const pending = await room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error(`Expected a reaction decision, got ${pending?.context.kind}.`)
  const option = pending.context.reactionTimeline[0]?.group.options[0]
  if (!option) throw new Error('The reaction decision offers no option.')
  const { root } = pending.context
  const childCommandId = movementReactionChildCommandId({
    parentCommandId: root.commandId,
    holderActorId: option.candidate.reactorActorId,
    actionId: option.actionId,
    occurrenceVersion: pending.occurrence.version
  })
  return {
    occurrence: pending.occurrence,
    encounterVersion: pending.encounterVersion,
    root,
    option,
    use: { kind: 'OPTION', optionId: option.optionId },
    childCommandId,
    // The option's answer is one entry of the move's history, so the resume names the next version.
    resumeCommandId: reactionChildMoveCommandId({
      parentCommandId: root.commandId,
      childCommandId,
      kind: 'REACTION_CHILD_RESUME',
      occurrenceVersion: pending.occurrence.version + 1
    })
  }
}

/** Where the mover's token stands in the room's stored Scene. */
function moverPosition(room: Room) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    const key = JSON.stringify(['sceneLiveEntities', room.scene.id, 'tokens', room.moverTokenId])
    const row = new RoomEncounterStore(context.storage)
      .records('SCENE_CHECKPOINT_ROW')
      .find((candidate) => candidate.key === key)
    if (!row) throw new Error('The room stores no token for the mover.')
    const { value } = sceneStoredLiveEntitySchema.parse(JSON.parse(row.json))
    if (value?.collection !== 'tokens' || !('position' in value.entity))
      throw new Error('The mover’s Scene entity is not a token.')
    return value.entity.position
  })
}

async function moverHitPoints(room: Room) {
  return readActorHitPoints(await readRoomHistory(room.base.stub), MOVER_ID)
}

/** The decisions of the Run that still wait: pending, or held behind a reaction child. */
async function openOccurrences(room: Room) {
  return (await readRoomHistory(room.base.stub)).occurrences
    .filter(({ state }) => state === 'PENDING' || state === 'SUSPENDED')
    .map(({ id, state }) => ({ id, state }))
}

/**
 * The decision the reaction child waits on once the room has settled its last answer; null when the
 * child has committed and the room has resumed the move at `moveOccurrenceId`.
 */
function childDecision(room: Room, moveOccurrenceId: string) {
  return vi.waitFor(async () => {
    const open = await openOccurrences(room)
    if (open.some(({ id, state }) => id === moveOccurrenceId && state === 'PENDING'))
      throw new Error('The room has not resumed the move.')
    return open.length ? readPendingActionDecision(room.base.stub) : null
  }, 10_000)
}

/**
 * Makes the platform's dice source fail once, at the draw after `drawn` dice; every other draw is
 * the room fixture's rigged one.
 */
function failDieAfter(room: Room, drawn: number) {
  const source = vi.mocked(crypto.getRandomValues)
  const rigged = source.getMockImplementation()
  if (!rigged) throw new Error('The room rigged no dice.')
  let failed = false
  source.mockImplementation((array) => {
    if (
      !failed &&
      array instanceof Uint32Array &&
      array.length === 1 &&
      room.diceDrawn() === drawn
    ) {
      failed = true
      throw new Error('The dice source failed.')
    }
    return rigged(array)
  })
}

/** The option's answer under a command id the test keeps, so it can send the same command again. */
function optionAnswer(
  room: Room,
  contact: Awaited<ReturnType<typeof walkToContact>>,
  commandId: string
) {
  return {
    scope: 'ENCOUNTER',
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: room.encounterId,
      commandId,
      expectedVersion: contact.encounterVersion,
      correlationId: null,
      occurrenceId: contact.occurrence.id,
      expectedOccurrenceVersion: contact.occurrence.version,
      resolution: contact.use
    }
  }
}

/** Drops a command from the room's journal, as its retention does once the command is old. */
function forgetJournalEntry(room: Room, commandId: string) {
  return runInDurableObject(room.base.stub, (_instance, context) => {
    context.storage.sql.exec('DELETE FROM durable_command_receipts WHERE command_id = ?', commandId)
  })
}

describe('a reaction chosen at a paused Scene move (QUALITY-18.T2b2)', () => {
  it('runs as the reactor’s own action, and the room resumes the move as its owner', async () => {
    const room = await contactRoom()
    const before = await moverHitPoints(room)
    const contact = await walkToContact(room)
    // Ruling 15: the mover's token waits at the contact while the move is pending.
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)
    expect(contact.root.currentPosition).not.toEqual(DESTINATION)

    const used = await room.respond(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.base.stub)
    // Ruling 13: the child's command id names the move's version at the choice.
    expect(
      history.commands.filter(({ commandId }) => commandId === contact.childCommandId)
    ).toMatchObject([{ commandType: 'RESOLVE_ACTION' }])
    expect(await moverHitPoints(room)).toBeLessThan(before)
    // Rulings 6 and 8: the resume is the room's own command, made as the campaign owner.
    const receipts = await room.receipts()
    expect(receipts.filter(({ commandId }) => commandId === contact.resumeCommandId)).toMatchObject(
      [{ actorUserId: room.base.userId, result: { terminalPosition: DESTINATION } }]
    )
    expect(await moverPosition(room)).toEqual(DESTINATION)
    expect(await openOccurrences(room)).toEqual([])
    expect(room.diceDrawn()).toBe(3)
  }, 60_000)

  it('rolls the whole answer back when the child action fails', async () => {
    const room = await contactRoom()
    const before = await moverHitPoints(room)
    const contact = await walkToContact(room)
    const commandsBefore = (await readRoomHistory(room.base.stub)).commands.length
    // The child's attack d20 is the next die the room draws.
    failDieAfter(room, room.diceDrawn())

    const refused = await room.respondOnly(contact.use)

    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error('The move is no longer pending.')
    // Nothing of the answer stands: the choice is open, with no child and no history entry.
    expect(pending.context.phase).toEqual({ kind: 'CHOICE' })
    expect(pending.occurrence.version).toBe(contact.occurrence.version)
    expect(pending.context.root.resolutionCommands).toEqual(contact.root.resolutionCommands)
    expect((await readRoomHistory(room.base.stub)).commands).toHaveLength(commandsBefore)
    expect(await moverHitPoints(room)).toBe(before)

    const used = await room.respond(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await moverHitPoints(room)).toBeLessThan(before)
    expect(await openOccurrences(room)).toEqual([])
  }, 60_000)

  it('refuses a second option while the recorded child is still to resume the move', async () => {
    const room = await contactRoom({
      spatialEffects: [{ center: { x: 475, y: 150 }, radius: 5, save: true }]
    })
    const contact = await walkToContact(room)
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The resume's spatial save is the fourth die, so the move stays answered and unresumed.
    failDieAfter(room, 3)
    const used = await room.respondOnly(contact.use)
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(() => expect(failure).toHaveBeenCalled(), 10_000)
    const afterChild = await moverHitPoints(room)

    const again = await room.respondOnly(contact.use)

    expect(again.type, JSON.stringify(again)).toBe('COMMAND_REJECTED')
    expect(await moverHitPoints(room)).toBe(afterChild)
  }, 60_000)

  it('resumes from the alarm when the resume after the child’s commit failed', async () => {
    const room = await contactRoom({
      spatialEffects: [{ center: { x: 475, y: 150 }, radius: 5, save: true }]
    })
    const contact = await walkToContact(room)
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The child draws three dice; the resume's spatial save, past the contact, is the fourth.
    failDieAfter(room, 3)

    const used = await room.respondOnly(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(
      () =>
        expect(failure).toHaveBeenCalledWith('Live Session move resume failed.', expect.any(Error)),
      10_000
    )
    const held = await room.pending()
    if (held?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error('The move is no longer pending.')
    expect(held.context.phase).toEqual({
      kind: 'CHOICE',
      reactionChildren: [{ commandId: contact.childCommandId }]
    })
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)

    await runInDurableObject(room.base.stub, async (instance) => {
      const clock = vi
        .spyOn(Date, 'now')
        .mockReturnValue(Date.now() + ROOM_LIMITS.alarmRetryMs + 1_000)
      try {
        await instance.alarm()
      } finally {
        clock.mockRestore()
      }
    })

    await vi.waitFor(async () => expect(await openOccurrences(room)).toEqual([]), 10_000)
    // The retry is the same command: one resume receipt, under the id the failed one had.
    const receipts = await room.receipts()
    expect(receipts.filter(({ commandId }) => commandId === contact.resumeCommandId)).toHaveLength(
      1
    )
    expect(await moverPosition(room)).toEqual(DESTINATION)
    expect(room.diceDrawn()).toBe(4)
  }, 60_000)

  it('ends the move at the contact when the reaction stops it', async () => {
    const room = await contactRoom({ reactor: stopReactionWolf })
    const contact = await walkToContact(room)

    const used = await room.respond(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const receipts = await room.receipts()
    expect(receipts.filter(({ commandId }) => commandId === contact.resumeCommandId)).toMatchObject(
      [{ result: { terminalPosition: contact.root.currentPosition } }]
    )
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)
    expect(await openOccurrences(room)).toEqual([])
  }, 60_000)

  it('ends the move at the contact when the reaction drops the mover to 0 hit points', async () => {
    const room = await contactRoom({ moverHitPoints: 1 })
    const contact = await walkToContact(room)

    const used = await room.respond(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await moverHitPoints(room)).toBe(0)
    const receipts = await room.receipts()
    expect(receipts.filter(({ commandId }) => commandId === contact.resumeCommandId)).toMatchObject(
      [{ result: { terminalPosition: contact.root.currentPosition } }]
    )
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)
    expect(await openOccurrences(room)).toEqual([])
  }, 60_000)

  it('holds the move while the child waits on its own roll, then resumes it', async () => {
    // Only players' dice are rolled for them, so the GM's Wolf waits on its attack d20.
    const room = await contactRoom({ autoRoll: 'PLAYER' })
    const before = await moverHitPoints(room)
    const contact = await walkToContact(room)

    const used = await room.respond(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    // The Run keeps one pending decision, the child's; the move is held behind it at the contact.
    const decision = await readPendingActionDecision(room.base.stub)
    if (decision?.pending.kind !== 'D20_EVIDENCE')
      throw new Error(`Expected the child’s attack d20, got ${decision?.pending.kind}.`)
    expect(await openOccurrences(room)).toEqual(
      expect.arrayContaining([
        { id: contact.occurrence.id, state: 'SUSPENDED' },
        { id: decision.occurrence.id, state: 'PENDING' }
      ])
    )
    expect(await openOccurrences(room)).toHaveLength(2)
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)

    // The GM enters each die the child asks for: a 19 to hit, then the least damage.
    for (
      let asked: Awaited<ReturnType<typeof childDecision>> = decision;
      asked;
      asked = await childDecision(room, contact.occurrence.id)
    ) {
      const { pending } = asked
      if (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
        throw new Error(`The child asks for ${pending.kind}.`)
      const commandId = crypto.randomUUID()
      const rolled = await room.send(commandId, {
        scope: 'ENCOUNTER',
        command: {
          type: 'RESOLVE_RULE_OCCURRENCE',
          encounterId: room.encounterId,
          commandId,
          expectedVersion: asked.encounterVersion,
          correlationId: null,
          occurrenceId: asked.occurrence.id,
          expectedOccurrenceVersion: asked.occurrence.version,
          resolution:
            pending.kind === 'D20_EVIDENCE'
              ? {
                  kind: 'ENTER_DICE',
                  requestId: pending.request.requestId,
                  rawFaces: pending.request.rollMode === 'NORMAL' ? [19] : [19, 19],
                  rollMode: pending.request.rollMode
                }
              : {
                  kind: 'ENTER_INTEGER',
                  requestId: pending.request.requestId,
                  value: pending.request.min
                }
        }
      })
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
    }

    expect(await openOccurrences(room)).toEqual([])
    expect(await moverHitPoints(room)).toBeLessThan(before)
    const receipts = await room.receipts()
    expect(receipts.filter(({ commandId: id }) => id === contact.resumeCommandId)).toHaveLength(1)
    expect(await moverPosition(room)).toEqual(DESTINATION)
  }, 60_000)
})

describe('a reaction child at a paused Scene move: parity gaps (QUALITY-18.T3)', () => {
  it('refuses a reaction that would push the mover from its contact, leaving the choice to decline', async () => {
    // The mover waits at the edge of the reactor's reach, between two squares, and a forced
    // movement starts from a square. The reaction is refused whole, so the move is never left
    // resuming from a place its token no longer stands.
    const room = await contactRoom({ reactor: pushingReactionWolf })
    const before = await moverHitPoints(room)
    const contact = await walkToContact(room)
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {})

    const refused = await room.respondOnly(contact.use)

    expect(refused.type, JSON.stringify(refused)).toBe('COMMAND_REJECTED')
    expect(failure).toHaveBeenCalled()
    const pending = await room.pending()
    if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
      throw new Error('The move is no longer pending.')
    expect(pending.context.phase).toEqual({ kind: 'CHOICE' })
    expect(pending.occurrence.version).toBe(contact.occurrence.version)
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)
    expect(await moverHitPoints(room)).toBe(before)

    const declined = await room.respond({ kind: 'DECLINE' })

    expect(declined.type, JSON.stringify(declined)).toBe('COMMAND_COMMITTED')
    expect(await moverPosition(room)).toEqual(DESTINATION)
    expect(await openOccurrences(room)).toEqual([])
  }, 60_000)

  it('offers nobody the answered choice while the room has still to resume the move', async () => {
    const room = await contactRoom({
      spatialEffects: [{ center: { x: 475, y: 150 }, radius: 5, save: true }]
    })
    const contact = await walkToContact(room)
    expect(await room.pendingFor(true)).toMatchObject({ kind: 'MOVEMENT_REACTION' })
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The resume's spatial save is the fourth die, so the move stays answered and unresumed.
    failDieAfter(room, 3)

    const used = await room.respondOnly(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(() => expect(failure).toHaveBeenCalled(), 10_000)
    expect(await room.pendingFor(true)).toBeNull()
    expect(await room.pendingFor(false)).toBeNull()
  }, 60_000)

  it('replays a retried option whose journal entry is gone while its child still waits on a roll', async () => {
    // Only players' dice are rolled for them, so the GM's Wolf waits on its attack d20.
    const room = await contactRoom({ autoRoll: 'PLAYER' })
    const contact = await walkToContact(room)
    const commandId = crypto.randomUUID()
    const answer = optionAnswer(room, contact, commandId)
    const used = await room.send(commandId, answer)
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    const open = await openOccurrences(room)
    expect(open).toHaveLength(2)
    const commands = (await readRoomHistory(room.base.stub)).commands.length
    await forgetJournalEntry(room, commandId)

    const again = await room.send(commandId, answer)

    expect(again.type, JSON.stringify(again)).toBe('COMMAND_COMMITTED')
    expect(await openOccurrences(room)).toEqual(open)
    expect((await readRoomHistory(room.base.stub)).commands).toHaveLength(commands)
  }, 60_000)

  it('replays a retried option whose journal entry is gone, once the move has ended', async () => {
    const room = await contactRoom()
    const contact = await walkToContact(room)
    const commandId = crypto.randomUUID()
    const answer = optionAnswer(room, contact, commandId)
    const used = await room.send(commandId, answer)
    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(async () => expect(await openOccurrences(room)).toEqual([]), 10_000)
    const afterChild = await moverHitPoints(room)
    const drawn = room.diceDrawn()
    await forgetJournalEntry(room, commandId)

    const again = await room.send(commandId, answer)

    expect(again.type, JSON.stringify(again)).toBe('COMMAND_COMMITTED')
    expect(await moverHitPoints(room)).toBe(afterChild)
    expect(room.diceDrawn()).toBe(drawn)
    expect(await moverPosition(room)).toEqual(DESTINATION)
    expect(await openOccurrences(room)).toEqual([])
  }, 60_000)
})

describe('a reaction child at a paused Scene move: unverified parity (QUALITY-18.T3c)', () => {
  it('holds the move behind the effect its mover raises at 0 hit points, then resumes it once', async () => {
    // The mover bursts when it drops to 0 hit points, and the bystander's save is entered by hand,
    // so the burst the child's commit raises waits as the Run's one pending decision.
    const room = await contactRoom({
      mover: deathBurstWolf(30, 10),
      moverHitPoints: 1,
      bystander: true
    })
    const bystanderBefore = readActorHitPoints(await readRoomHistory(room.base.stub), BYSTANDER_ID)
    const contact = await walkToContact(room)

    const used = await room.respondOnly(contact.use)

    expect(used.type, JSON.stringify(used)).toBe('COMMAND_COMMITTED')
    expect(await moverHitPoints(room)).toBe(0)
    const held = await openOccurrences(room)
    expect(held).toHaveLength(2)
    expect(held).toContainEqual({ id: contact.occurrence.id, state: 'SUSPENDED' })
    const burst = await readPendingActionDecision(room.base.stub)
    if (burst?.pending.kind !== 'AREA_SAVES')
      throw new Error(`Expected the burst’s saves, got ${burst?.pending.kind}.`)
    expect(burst.pending.saves.map(({ actorId }) => actorId)).toEqual([BYSTANDER_ID])
    expect(
      (await room.receipts()).filter(({ commandId }) => commandId === contact.resumeCommandId)
    ).toEqual([])
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)

    const [save] = burst.pending.saves
    const commandId = crypto.randomUUID()
    const saved = await room.send(commandId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: room.encounterId,
        commandId,
        expectedVersion: burst.encounterVersion,
        correlationId: null,
        occurrenceId: burst.occurrence.id,
        expectedOccurrenceVersion: burst.occurrence.version,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: save!.request.requestId,
          rawFaces: [1],
          rollMode: save!.request.rollMode
        }
      }
    })

    expect(saved.type, JSON.stringify(saved)).toBe('COMMAND_COMMITTED')
    await vi.waitFor(async () => expect(await openOccurrences(room)).toEqual([]), 10_000)
    expect(readActorHitPoints(await readRoomHistory(room.base.stub), BYSTANDER_ID)).toBeLessThan(
      bystanderBefore
    )
    // The mover dropped at the contact, so the one resume ends the move there.
    expect(
      (await room.receipts()).filter(({ commandId: id }) => id === contact.resumeCommandId)
    ).toMatchObject([{ result: { terminalPosition: contact.root.currentPosition } }])
    expect(await moverPosition(room)).toEqual(contact.root.currentPosition)
  }, 60_000)
})
