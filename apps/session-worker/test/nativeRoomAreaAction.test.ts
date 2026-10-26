import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acidSplash } from '@artificer-toolkit/source-data/srd/spells/acid-splash.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { legendaryWolf, plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf, frightenOnFailedSave } from './actionRoomFixture.js'
import { frightenedId, frightenedResultBlock } from './areaConditionFixture.js'
import { answerAllSaves, areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionDecision,
  readPendingAreaChoices,
  readPendingAreaForViewer,
  readRoomChatBodies,
  readRoomHistory,
  readRoomPrivateRollHolders,
  readRoomRollCards,
  readRoomTimeline,
  type RoomHistory
} from './roomHistoryReads.js'

const CASTER_ID = testUuid(0x700)
const CAUGHT_IDS = [testUuid(0x701), testUuid(0x702), testUuid(0x703)]
const FAR_ID = testUuid(0x704)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Five Wolves 100 px apart; the first casts. A 20 ft sphere at x = 50 reaches the first four. */
function areaRoom(
  options: Partial<Omit<Parameters<typeof actionRoom>[0], 'actors' | 'ownerFeatureId'>> = {}
) {
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      ...[...CAUGHT_IDS, FAR_ID].map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id
  })
}

describe('room point-area action', () => {
  it('waits on one save for every creature the area catches, the caster included', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type).toBe('COMMAND_COMMITTED')

    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(decision.pending.casterActorId).toBe(CASTER_ID)
    expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, ...CAUGHT_IDS].sort()
    )
    // The area is stored as one pending occurrence; nothing was spent or damaged yet.
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
    expect(history.receipts).toHaveLength(before.receipts.length)
    expect(history.actors).toEqual(before.actors)
  })

  it('commits an area that catches nobody as the caster’s spend alone', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const cardsBefore = await readRoomRollCards(room.room.base.stub)
    const { command, answer } = await room.startAreaAction({ x: 150, y: 2000 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    const { roots, children } = areaReceipts(history)
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
    expect(roots[0]?.outputs).toMatchObject({
      sourceActorId: CASTER_ID,
      removedActorIds: [],
      targetOccurrenceIds: [],
      damage: []
    })
    expect(roots[0]?.outputs.actionEconomyTransition).toBeTruthy()
    expect(children).toEqual([])
    expect(rowsOf(history, CASTER_ID)).not.toEqual(rowsOf(before, CASTER_ID))
    expect(await readRoomRollCards(room.room.base.stub)).toEqual(cardsBefore)
  })

  it('takes a spend-only area back with one undo, restoring the spend', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { command } = await room.startAreaAction({ x: 150, y: 2000 })
    const undoCommandId = crypto.randomUUID()
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: undoCommandId,
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    expect(history.commands.find((entry) => entry.commandId === undoCommandId)).toMatchObject({
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: command.commandId
    })
    expect(vitalsOf(history)).toEqual(vitalsOf(before))
  })

  it('offers an area action as a point with its authored radius, and a bite as a creature', async () => {
    const area = await areaRoom()
    const areaChoices = await area.actionChoices()
    expect(areaChoices.actions.map(({ target }) => target)).toEqual([
      { kind: 'POINT', area: { kind: 'RADIUS', radius: { amount: 20, unit: 'FEET' } } }
    ])

    const bite = await actionRoom({
      actors: [srdCreatureActor({ id: CASTER_ID, creature: plainWolf })],
      ownerFeatureId: plainWolf.features?.find((feature) => feature.label === 'Bite')?.id
    })
    const biteChoices = await bite.actionChoices()
    expect(biteChoices.actions.map(({ target }) => target)).toEqual([
      { kind: 'ACTOR', self: 'ALLOWED' }
    ])
  })

  it('refuses a creature target for an area action', async () => {
    const room = await areaRoom()
    const { answer } = await room.startAction(CAUGHT_IDS[0]!)
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED' })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})

describe('room GM removal from a pending area', () => {
  /** The room with its area pending on the first Fireball point, and the GM's view of it. */
  async function pendingAreaRoom() {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return { room, decision: await room.pendingDecision() }
  }
  const savesOf = (decision: Awaited<ReturnType<typeof pendingAreaRoom>>['decision']) => {
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    return decision.pending.saves.map(({ actorId }) => actorId)
  }

  it('takes a creature out of the area and seals the caught set again', async () => {
    const { room, decision } = await pendingAreaRoom()
    // Ids arrive in any case and are lowercased at admission.
    const command = room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!.toUpperCase())
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')

    const after = await room.pendingDecision()
    if (after.pending.kind !== 'AREA_SAVES' || decision.pending.kind !== 'AREA_SAVES')
      throw new Error('Expected the area saves.')
    expect(savesOf(after).sort()).toEqual([CASTER_ID, CAUGHT_IDS[0]!, CAUGHT_IDS[1]!].sort())
    expect(after.pending.caughtChecksum).not.toBe(decision.pending.caughtChecksum)
    expect(after.occurrence.version).toBe(decision.occurrence.version + 1)
    // The area is still pending, so the Encounter itself has not moved.
    expect(after.encounterVersion).toBe(decision.encounterVersion)
  })

  it('replays a repeated removal without changing the area again', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const after = await room.pendingDecision()
    // Same creature, current versions: the area already reflects it, so nothing changes.
    expect((await room.send(room.removeAreaTargetCommand(after, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    expect(await room.pendingDecision()).toEqual(after)
  })

  it('refuses a stale removal even when the creature was already removed', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const answer = await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'VERSION_STALE'
    })
  })

  it('refuses a removal made against a caught set that has since changed', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    // Fresh versions, but the checksum is the one the GM saw before the first removal.
    const fresh = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const answer = await room.send(
      room.removeAreaTargetCommand(fresh, CAUGHT_IDS[1]!, {
        expectedCaughtChecksum: decision.pending.caughtChecksum
      })
    )
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'VERSION_STALE'
    })
    expect(savesOf(await room.pendingDecision())).toContain(CAUGHT_IDS[1]!)
  })

  it('refuses a player and a creature the area did not catch', async () => {
    const { room, decision } = await pendingAreaRoom()
    const byPlayer = room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!)
    expect(await room.sendAsPlayer(byPlayer)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'GM_ONLY'
    })
    expect(await room.send(room.removeAreaTargetCommand(decision, FAR_ID))).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect(savesOf(await room.pendingDecision())).toHaveLength(4)
  })
})

describe('room area saves answered by each creature', () => {
  async function pendingAreaRoom() {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return { room, decision: await room.pendingDecision() }
  }
  type Decision = Awaited<ReturnType<typeof pendingAreaRoom>>['decision']
  const savesOf = (decision: Decision) => {
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    return decision.pending.saves.map(({ actorId }) => actorId)
  }
  /** `actorId`'s own save answered with one natural d20 face. */
  const answerCommand = (
    room: Awaited<ReturnType<typeof pendingAreaRoom>>['room'],
    decision: Decision,
    actorId: string,
    face = 9
  ) => {
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
    if (!save) throw new Error('The creature has no pending save.')
    return room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: save.request.requestId,
      rawFaces: [face],
      rollMode: save.request.rollMode
    })
  }

  it('records one creature’s save and leaves the others waiting', async () => {
    const { room, decision } = await pendingAreaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )

    const after = await room.pendingDecision()
    expect(savesOf(after).sort()).toEqual([CASTER_ID, CAUGHT_IDS[1]!, CAUGHT_IDS[2]!].sort())
    expect(after.occurrence.version).toBe(decision.occurrence.version + 1)
    expect(after.encounterVersion).toBe(decision.encounterVersion)
    // Nothing is damaged until the area settles.
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.actors).toEqual(before.actors)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
  })

  it('takes the saves in any order', async () => {
    const { room } = await pendingAreaRoom()
    for (const actorId of [CAUGHT_IDS[2]!, CASTER_ID, CAUGHT_IDS[0]!]) {
      const decision = await room.pendingDecision()
      expect((await room.send(answerCommand(room, decision, actorId))).type).toBe(
        'COMMAND_COMMITTED'
      )
      expect(savesOf(await room.pendingDecision())).not.toContain(actorId)
    }
    expect(savesOf(await room.pendingDecision())).toEqual([CAUGHT_IDS[1]!])
  })

  it('replays a repeated answer without recording it again', async () => {
    const { room, decision } = await pendingAreaRoom()
    const command = answerCommand(room, decision, CAUGHT_IDS[0]!)
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    const after = await room.pendingDecision()
    expect((await room.send(command)).type).toBe('COMMAND_COMMITTED')
    expect(await room.pendingDecision()).toEqual(after)
  })

  it('refuses an answer made against a stale occurrence', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const stale = await room.send(answerCommand(room, decision, CAUGHT_IDS[1]!))
    expect(stale).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'VERSION_STALE'
    })
    expect(savesOf(await room.pendingDecision())).toContain(CAUGHT_IDS[1]!)
  })

  it('refuses a save that was already answered', async () => {
    const { room, decision } = await pendingAreaRoom()
    const first = answerCommand(room, decision, CAUGHT_IDS[0]!)
    expect((await room.send(first)).type).toBe('COMMAND_COMMITTED')
    const fresh = await room.pendingDecision()
    // The first answer's request no longer waits, so a second try finds nothing to answer.
    const again = await room.send({
      ...first,
      commandId: crypto.randomUUID(),
      expectedOccurrenceVersion: fresh.occurrence.version
    })
    expect(again).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'DECISION_NOT_PENDING'
    })
    expect(savesOf(await room.pendingDecision())).toHaveLength(3)
  })

  it('refuses the GM taking out a creature that already rolled', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const fresh = await room.pendingDecision()
    const removal = await room.send(room.removeAreaTargetCommand(fresh, CAUGHT_IDS[0]!))
    expect(removal).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect(savesOf(await room.pendingDecision())).toHaveLength(3)
  })

  it('refuses an answer for a creature the GM took out', async () => {
    const { room, decision } = await pendingAreaRoom()
    const stillWaiting = answerCommand(room, decision, CAUGHT_IDS[2]!)
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const fresh = await room.pendingDecision()
    const answer = await room.send({
      ...stillWaiting,
      commandId: crypto.randomUUID(),
      expectedOccurrenceVersion: fresh.occurrence.version
    })
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'DECISION_NOT_PENDING'
    })
  })

  it('refuses a player answering a creature the GM runs', async () => {
    const { room, decision } = await pendingAreaRoom()
    const answer = await room.sendAsPlayer(answerCommand(room, decision, CAUGHT_IDS[0]!))
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'NOT_ACTOR_CONTROLLER'
    })
    expect(savesOf(await room.pendingDecision())).toHaveLength(4)
  })
})

describe('room Legendary Resistance on an area save', () => {
  const RESISTER_ID = testUuid(0x705)
  const TWIN_ID = testUuid(0x706)
  const NO_ONE = new Set<string>()

  /**
   * The caster, a Legendary Resistance creature and two more creatures in the area, and a Wolf out of
   * it. The second is a Wolf, or with `twin` another Legendary Resistance creature.
   */
  async function resistanceRoom(
    options: Pick<Parameters<typeof actionRoom>[0], 'autoRoll' | 'fallbackRoll'> & {
      twin?: boolean
      playerControls?: string[]
    } = {}
  ) {
    const { twin, playerControls, ...roomOptions } = options
    const room = await actionRoom({
      ...roomOptions,
      ...(playerControls ? { playerControlledActorIds: playerControls } : {}),
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
        srdCreatureActor({ id: RESISTER_ID, creature: legendaryWolf }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
        twin
          ? srdCreatureActor({ id: TWIN_ID, creature: legendaryWolf })
          : srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf }),
        srdCreatureActor({ id: FAR_ID, creature: plainWolf })
      ],
      ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id
    })
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return room
  }
  type Room = Awaited<ReturnType<typeof resistanceRoom>>
  const gmView = (room: Room) =>
    readPendingAreaForViewer(room.room.base.stub, {
      isOwner: true,
      controlledActorIds: NO_ONE
    })
  const playerView = (room: Room, controlled: string[]) =>
    readPendingAreaForViewer(room.room.base.stub, {
      isOwner: false,
      controlledActorIds: new Set(controlled)
    })
  /** `actorId`'s own save answered with one natural d20 face. */
  async function answer(room: Room, actorId: string, face: number) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
    if (!save) throw new Error('The creature has no pending save.')
    return room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [face],
        rollMode: save.request.rollMode
      })
    )
  }

  it('offers the choice to the creature’s controllers once its save fails, and only then', async () => {
    const room = await resistanceRoom()
    expect((await gmView(room))?.legendaryResistance).toEqual([])
    // A natural 20 passes the DC 10 save, so there is nothing to resist.
    expect((await answer(room, RESISTER_ID, 20)).type).toBe('COMMAND_COMMITTED')
    expect((await gmView(room))?.legendaryResistance).toEqual([])
    // A Wolf has no Legendary Resistance to offer when it fails.
    expect((await answer(room, CAUGHT_IDS[0]!, 1)).type).toBe('COMMAND_COMMITTED')
    expect((await gmView(room))?.legendaryResistance).toEqual([])
  })

  it('shows the choice to the GM and the creature’s controller, never to the caster or others', async () => {
    const room = await resistanceRoom()
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')

    const choice = {
      actorId: RESISTER_ID,
      optionId: expect.stringMatching(/^[a-f0-9]{64}$/)
    }
    expect((await gmView(room))?.legendaryResistance).toEqual([choice])
    expect((await playerView(room, [RESISTER_ID]))?.legendaryResistance).toEqual([choice])
    // The caster's player still answers their own save and learns nothing of the choice.
    const caster = await playerView(room, [CASTER_ID])
    expect(caster?.saves.map(({ actorId }) => actorId)).toEqual([CASTER_ID])
    expect(caster?.legendaryResistance).toEqual([])
    expect(JSON.stringify(caster)).not.toContain(choice.actorId)
    // A player with no creature in the area reads nothing at all.
    expect(await playerView(room, [FAR_ID])).toBeNull()
  })

  it('keeps the choice waiting while the other creatures answer in any order', async () => {
    const room = await resistanceRoom()
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    for (const actorId of [CAUGHT_IDS[1]!, CASTER_ID]) {
      expect((await answer(room, actorId, 9)).type).toBe('COMMAND_COMMITTED')
      expect((await gmView(room))?.legendaryResistance.map((entry) => entry.actorId)).toEqual([
        RESISTER_ID
      ])
    }
    const waiting = await gmView(room)
    expect(waiting?.saves.map(({ actorId }) => actorId)).toEqual([CAUGHT_IDS[0]!])
    // The area has not settled: it is still the one pending occurrence, with nothing damaged.
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toHaveLength(1)
  })

  it('keeps a creature that awaits its choice in the area', async () => {
    const room = await resistanceRoom()
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    const removal = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), RESISTER_ID)
    )
    expect(removal).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'TARGET_UNAVAILABLE'
    })
    expect((await gmView(room))?.legendaryResistance).toHaveLength(1)
  })

  /** The command deciding `actorId`'s choice, naming the option its offer sealed unless told otherwise. */
  async function decideCommand(
    room: Room,
    actorId: string,
    decision: 'USE' | 'DECLINE',
    optionId?: string
  ) {
    const pending = await room.pendingDecision()
    if (pending.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const offered = pending.pending.legendaryResistance.find((entry) => entry.actorId === actorId)
    if (!offered) throw new Error('The creature has no pending choice.')
    return room.resolveCommand(pending, {
      kind: 'AREA_LEGENDARY_RESISTANCE',
      actorId,
      decision:
        decision === 'USE'
          ? { kind: 'USE', optionId: optionId ?? offered.optionId }
          : { kind: 'DECLINE' }
    })
  }
  const choicesOf = (room: Room) => readPendingAreaChoices(room.room.base.stub)
  const offeredTo = async (room: Room) =>
    ((await gmView(room))?.legendaryResistance ?? []).map(({ actorId }) => actorId).sort()

  it('lets the controller use it while other saves wait, which stay answerable', async () => {
    const room = await resistanceRoom({ playerControls: [RESISTER_ID] })
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    const used = await room.sendAsPlayer(await decideCommand(room, RESISTER_ID, 'USE'))
    expect(used.type).toBe('COMMAND_COMMITTED')

    expect(await choicesOf(room)).toEqual([{ actorId: RESISTER_ID, selection: 'USE' }])
    const waiting = await gmView(room)
    expect(waiting?.legendaryResistance).toEqual([])
    expect(waiting?.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, CAUGHT_IDS[0]!, CAUGHT_IDS[1]!].sort()
    )
    // The other saves are still answerable, in any order, after the choice was made.
    expect((await answer(room, CAUGHT_IDS[1]!, 9)).type).toBe('COMMAND_COMMITTED')
    expect((await gmView(room))?.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, CAUGHT_IDS[0]!].sort()
    )
  })

  it('declines only the creature it names when two choices are undecided', async () => {
    const room = await resistanceRoom({ twin: true })
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    expect((await answer(room, TWIN_ID, 1)).type).toBe('COMMAND_COMMITTED')
    expect(await offeredTo(room)).toEqual([RESISTER_ID, TWIN_ID].sort())

    expect((await room.send(await decideCommand(room, TWIN_ID, 'DECLINE'))).type).toBe(
      'COMMAND_COMMITTED'
    )
    expect(await offeredTo(room)).toEqual([RESISTER_ID])
    expect((await choicesOf(room)).sort((a, b) => a.actorId.localeCompare(b.actorId))).toEqual(
      [
        { actorId: RESISTER_ID, selection: null },
        { actorId: TWIN_ID, selection: 'DECLINE' }
      ].sort((a, b) => a.actorId.localeCompare(b.actorId))
    )
  })

  it('refuses the caster’s player and any player who does not control the creature', async () => {
    const room = await resistanceRoom({
      playerControls: [CASTER_ID, CAUGHT_IDS[0]!]
    })
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    const refused = await room.sendAsPlayer(await decideCommand(room, RESISTER_ID, 'USE'))
    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'NOT_ACTOR_CONTROLLER'
    })
    expect(await choicesOf(room)).toEqual([{ actorId: RESISTER_ID, selection: null }])
  })

  it('refuses a use that names another creature’s option', async () => {
    const room = await resistanceRoom({ twin: true })
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    expect((await answer(room, TWIN_ID, 1)).type).toBe('COMMAND_COMMITTED')
    const offers = (await gmView(room))?.legendaryResistance ?? []
    const twinOption = offers.find(({ actorId }) => actorId === TWIN_ID)?.optionId
    const ownOption = offers.find(({ actorId }) => actorId === RESISTER_ID)?.optionId
    expect(twinOption).toBeDefined()
    expect(twinOption).not.toBe(ownOption)

    const refused = await room.send(await decideCommand(room, RESISTER_ID, 'USE', twinOption))
    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'VERSION_STALE'
    })
    expect((await choicesOf(room)).every(({ selection }) => selection === null)).toBe(true)
  })

  it('refuses a decision for a creature with no undecided choice', async () => {
    const room = await resistanceRoom()
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    expect((await answer(room, CAUGHT_IDS[0]!, 1)).type).toBe('COMMAND_COMMITTED')
    const decline = await decideCommand(room, RESISTER_ID, 'DECLINE')
    expect((await room.send(decline)).type).toBe('COMMAND_COMMITTED')

    const fresh = await room.pendingDecision()
    const again = {
      ...decline,
      commandId: crypto.randomUUID(),
      expectedOccurrenceVersion: fresh.occurrence.version
    }
    expect(await room.send(again)).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'DECISION_NOT_PENDING'
    })
    // A creature that failed without a Legendary Resistance never had a choice to decide.
    const never = await room.send({
      ...again,
      commandId: crypto.randomUUID(),
      resolution: {
        kind: 'AREA_LEGENDARY_RESISTANCE',
        actorId: CAUGHT_IDS[0]!,
        decision: { kind: 'DECLINE' }
      }
    })
    expect(never).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'DECISION_NOT_PENDING'
    })
  })

  it('rolls the saves of auto-rolling creatures when the area opens, offering the choice of a failure', async () => {
    const room = await resistanceRoom({
      autoRoll: 'GAME_MASTER',
      fallbackRoll: 1,
      playerControls: [CAUGHT_IDS[1]!]
    })
    // Only the creature whose roller does not auto-roll still waits; the failed auto-rolled
    // Legendary Resistance creature is offered its choice at open.
    const opened = await gmView(room)
    expect(opened?.saves.map(({ actorId }) => actorId)).toEqual([CAUGHT_IDS[1]!])
    expect(opened?.legendaryResistance.map(({ actorId }) => actorId)).toEqual([RESISTER_ID])
    expect((await room.send(await decideCommand(room, RESISTER_ID, 'USE'))).type).toBe(
      'COMMAND_COMMITTED'
    )
    expect((await gmView(room))?.legendaryResistance).toEqual([])
  })

  it('leaves a save waiting whose roller does not auto-roll', async () => {
    const room = await resistanceRoom({
      autoRoll: 'GAME_MASTER',
      fallbackRoll: 1,
      playerControls: [RESISTER_ID]
    })
    const opened = await gmView(room)
    expect(opened?.saves.map(({ actorId }) => actorId)).toEqual([RESISTER_ID])
    expect(opened?.legendaryResistance).toEqual([])
  })
})

describe('room area save rolled by the app', () => {
  it('rolls each creature’s save for that creature and settles with the held roll', async () => {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === CAUGHT_IDS[1])!

    const rolled = await room.send({
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: decision.encounterVersion,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version,
      requestId: save.request.requestId,
      rollMode: null
    })
    expect(rolled.type).toBe('COMMAND_COMMITTED')
    const held = (await readRoomHistory(room.room.base.stub)).evidenceRolls
    expect(held).toHaveLength(1)
    // The roll card names the creature whose save it is, not the GM who pressed the button.
    expect(
      (await readRoomRollCards(room.room.base.stub)).map(({ roll }) => roll.characterLabel)
    ).toEqual([plainWolf.label])

    expect(
      (
        await room.resolve(decision, {
          kind: 'SYSTEM_ROLL',
          requestId: save.request.requestId,
          rollId: held[0]!.id
        })
      ).type
    ).toBe('COMMAND_COMMITTED')
    const after = await room.pendingDecision()
    if (after.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(after.pending.saves.map(({ actorId }) => actorId)).not.toContain(CAUGHT_IDS[1])
  })

  it('refuses a roll for a request the area does not ask', async () => {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    const refused = await room.send({
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: decision.encounterVersion,
      occurrenceId: decision.occurrence.id,
      expectedOccurrenceVersion: decision.occurrence.version,
      requestId: crypto.randomUUID(),
      rollMode: null
    })
    expect(refused).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'DECISION_NOT_PENDING'
    })
  })
})

const CHARACTER_ACTOR_ID = testUuid(0x707)
const CHARACTER_ID = testUuid(0x708)
const RESISTER_ID = testUuid(0x709)
const BITE_ID = fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id

/** The caster, a Character, two Wolves and a Wolf out of the area, 100 px apart. */
function characterAreaRoom(
  options: Partial<Omit<Parameters<typeof actionRoom>[0], 'actors' | 'ownerFeatureId'>> = {}
) {
  return actionRoom({
    ...options,
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf }),
      srdCreatureActor({ id: FAR_ID, creature: plainWolf })
    ],
    ownerFeatureId: BITE_ID
  })
}

/** The caster, a Legendary Resistance Wolf and two Wolves in the area, and a Wolf out of it. */
function resisterAreaRoom() {
  return actionRoom({
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
      srdCreatureActor({ id: RESISTER_ID, creature: legendaryWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf }),
      srdCreatureActor({ id: FAR_ID, creature: plainWolf })
    ],
    ownerFeatureId: BITE_ID
  })
}

type AnyAreaRoom = Awaited<ReturnType<typeof areaRoom>>

/** The rows without the stamp a write refreshes, so two reads of the same state compare equal. */
const unstamped = (rows: readonly object[]) =>
  rows.map((row) => {
    const { updatedAt: _updatedAt, _creationTime, ...rest } = row as Record<string, unknown>
    return rest
  })
const rowsOf = (history: RoomHistory, id: string) =>
  unstamped(history.actors.filter((row) => row.id === id))

function readCharacterHitPoints(room: AnyAreaRoom) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })
}

describe('room area commit', () => {
  it('commits the whole area when the last save is answered, in one transaction', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const { command } = await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const history = await readRoomHistory(room.room.base.stub)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    // One RESOLVE_ACTION command for the whole area, under the command that opened it.
    const added = history.commands.slice(before.commands.length)
    expect(added.map((entry) => entry.commandType)).toEqual(['RESOLVE_ACTION'])
    expect(added[0]?.commandId).toBe(command.commandId)

    const { roots, children } = areaReceipts(history)
    expect(roots).toHaveLength(1)
    expect(roots[0]?.receipt.commandId).toBe(command.commandId)
    expect(roots[0]?.outputs).toMatchObject({
      kind: 'ENCOUNTER_AREA_ACTION',
      sourceActorId: CASTER_ID,
      removedActorIds: []
    })
    expect(roots[0]?.outputs.targetOccurrenceIds).toHaveLength(4)
    expect(children).toHaveLength(4)
    // Every caught creature failed its save and took the 1 damage; the Wolf out of the area did not.
    expect(rowsOf(history, FAR_ID)).toEqual(rowsOf(before, FAR_ID))
    for (const id of [CASTER_ID, ...CAUGHT_IDS])
      expect(rowsOf(history, id)).not.toEqual(rowsOf(before, id))
  })

  it('commits at open when every save rolls itself, with nothing left pending', async () => {
    const room = await areaRoom({ autoRoll: 'GAME_MASTER', fallbackRoll: 1 })
    const { command, answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    const { roots, children } = areaReceipts(history)
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
    expect(children).toHaveLength(4)
  })

  it('records the GM removals on the area root and tells the table nothing of them', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    await room.startAreaAction({ x: 50, y: 150 })
    const decision = await room.pendingDecision()
    expect((await room.send(room.removeAreaTargetCommand(decision, CAUGHT_IDS[2]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    await answerAllSaves(room)

    const history = await readRoomHistory(room.room.base.stub)
    const { roots, children } = areaReceipts(history)
    expect(roots[0]?.outputs.removedActorIds).toEqual([CAUGHT_IDS[2]])
    expect(roots[0]?.outputs.targetOccurrenceIds).toHaveLength(3)
    expect(children).toHaveLength(3)
    // The removed creature is untouched, and nothing the table reads names it.
    expect(rowsOf(history, CAUGHT_IDS[2]!)).toEqual(rowsOf(before, CAUGHT_IDS[2]!))
    const stub = room.room.base.stub
    expect(JSON.stringify(await readRoomChatBodies(stub))).not.toContain(CAUGHT_IDS[2])
    expect(JSON.stringify(await readRoomRollCards(stub))).not.toContain(CAUGHT_IDS[2])
  })

  it('commits the area when the GM removes the last creature it waits on', async () => {
    const room = await areaRoom()
    const { command } = await room.startAreaAction({ x: 50, y: 150 })
    for (const id of [CASTER_ID, CAUGHT_IDS[0]!, CAUGHT_IDS[1]!]) {
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      const save = decision.pending.saves.find((entry) => entry.actorId === id)!
      await room.send(
        room.resolveCommand(decision, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: [9],
          rollMode: save.request.rollMode
        })
      )
    }
    const last = await room.pendingDecision()
    const removal = room.removeAreaTargetCommand(last, CAUGHT_IDS[2]!)
    const answer = await room.send(removal)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    expect(history.occurrences.filter((row) => row.state === 'PENDING')).toEqual([])
    const { roots, children } = areaReceipts(history)
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
    expect(roots[0]?.outputs.removedActorIds).toEqual([CAUGHT_IDS[2]])
    expect(roots[0]?.outputs.targetOccurrenceIds).toHaveLength(3)
    expect(children).toHaveLength(3)

    // A repeated removal replays the journaled answer without committing again.
    expect(await room.send(removal)).toEqual(answer)
    expect(await readRoomHistory(room.room.base.stub)).toEqual(history)
  })

  it('commits a spend-only area when the GM removes every creature it caught', async () => {
    const room = await areaRoom()
    const before = await readRoomHistory(room.room.base.stub)
    const cardsBefore = await readRoomRollCards(room.room.base.stub)
    const { command } = await room.startAreaAction({ x: 50, y: 150 })
    const removed = [CASTER_ID, ...CAUGHT_IDS]
    for (const id of removed) {
      expect(await readPendingActionDecision(room.room.base.stub)).not.toBeNull()
      const answer = await room.send(room.removeAreaTargetCommand(await room.pendingDecision(), id))
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    }
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const history = await readRoomHistory(room.room.base.stub)
    const { roots, children } = areaReceipts(history)
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
    expect([...(roots[0]?.outputs.removedActorIds ?? [])].sort()).toEqual([...removed].sort())
    expect(roots[0]?.outputs.targetOccurrenceIds).toEqual([])
    expect(roots[0]?.outputs.actionEconomyTransition).toBeTruthy()
    expect(children).toEqual([])
    expect(await readRoomRollCards(room.room.base.stub)).toEqual(cardsBefore)
    for (const id of removed.slice(1)) expect(rowsOf(history, id)).toEqual(rowsOf(before, id))
  })

  it('applies a Character’s damage and raises its Concentration check once the area commits', async () => {
    const room = await characterAreaRoom({
      concentration: true,
      concentrationOwnerActorId: CHARACTER_ACTOR_ID
    })
    const hitPointsBefore = await readCharacterHitPoints(room)
    await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)

    expect(await readCharacterHitPoints(room)).toBe(hitPointsBefore - 1)
    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(children.map(({ outputs }) => outputs.kind).sort()).toEqual([
      'CHARACTER_MECHANICS_BATCH',
      'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    ])
    // The Character's player is asked for the Constitution save; the area is no longer pending.
    const decision = await room.pendingDecision()
    expect(decision.pending).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: CHARACTER_ACTOR_ID
    })
    const cards = await readRoomRollCards(room.room.base.stub)
    // Three Creature saves, the Character save and one shared damage card: the area posts damage once, not once per target.
    expect(cards).toHaveLength(CAUGHT_IDS.length + 2)
  })

  it('takes the whole area back with one undo, a Character target included', async () => {
    const room = await characterAreaRoom()
    const hitPointsBefore = await readCharacterHitPoints(room)
    const before = await readRoomHistory(room.room.base.stub)
    const { command } = await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)
    expect(await readCharacterHitPoints(room)).toBe(hitPointsBefore - 1)

    const undoCommandId = crypto.randomUUID()
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: undoCommandId,
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    expect(history.commands.find((entry) => entry.commandId === undoCommandId)).toMatchObject({
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: command.commandId
    })
    expect(vitalsOf(history)).toEqual(vitalsOf(before))
    expect(await readCharacterHitPoints(room)).toBe(hitPointsBefore)
  })
})

describe('room area commit with a grant that ends on incapacitation (D113)', () => {
  const GRANT_ID = testUuid(0x705)
  const grantIds = async (room: AnyAreaRoom) =>
    (await readRoomHistory(room.room.base.stub)).activeEffects.map((effect) => effect.id)

  it('ends the grant of a caught holder who is incapacitated, and the area’s undo restores it', async () => {
    const paralyzed = srdSystemRecord.conditionTypes.find(({ code }) => code === 'PARALYZED')
    if (!paralyzed) throw new Error('The SRD vocabulary has no Paralyzed condition.')
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf, conditionIds: [paralyzed.id] }),
        srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf })
      ],
      ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id,
      seed: async ({ effects, encounterId, occurredAt }) => {
        await effects.create({
          id: GRANT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CAUGHT_IDS[0]! },
          lifecycle: { schemaVersion: 1, remainingTicks: 10 },
          definition: plannedModifierGrant({
            encounterId,
            sourceActorId: CAUGHT_IDS[0]!,
            holderActorId: CAUGHT_IDS[0]!,
            lifecycle: { endOnEvents: ['ON_INCAPACITATED'] },
            rounds: 10
          }).definition,
          occurredAt
        })
      }
    })
    expect(await grantIds(room)).toContain(GRANT_ID)

    await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)
    expect(await grantIds(room)).not.toContain(GRANT_ID)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await grantIds(room)).toContain(GRANT_ID)
  })

  it('ends the grant of a caught holder an area heal restores hit points to, and the area’s undo restores it (SPELLS-17.3)', async () => {
    const healingWolf = creatureAuthoredDtoSchema.parse({
      ...fireballWolf(),
      features: fireballWolf().features?.map((feature) =>
        feature.label !== 'Bite'
          ? feature
          : {
              ...feature,
              effects: feature.effects?.map((effect) => ({
                ...effect,
                paths: effect.paths.map((path) =>
                  !('resultBlock' in path)
                    ? path
                    : {
                        ...path,
                        resultBlock: {
                          ...path.resultBlock,
                          outcomes: path.resultBlock.outcomes.map((outcome) => ({
                            id: outcome.id,
                            effectKind: 'HEAL' as const,
                            valueKind: 'FIXED' as const,
                            scalingKind: 'NONE' as const,
                            amount: 1
                          }))
                        }
                      }
                )
              }))
            }
      )
    })
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: healingWolf }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf, currentHitPoints: 5 })
      ],
      ownerFeatureId: healingWolf.features?.find((feature) => feature.label === 'Bite')?.id,
      seed: async ({ effects, encounterId, occurredAt }) => {
        const grant = plannedModifierGrant({
          encounterId,
          sourceActorId: CAUGHT_IDS[0]!,
          holderActorId: CAUGHT_IDS[0]!,
          lifecycle: { endOnEvents: ['ON_HIT_POINTS_REGAINED'] }
        })
        await effects.create({
          id: GRANT_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CAUGHT_IDS[0]! },
          lifecycle: grant.lifecycle,
          definition: grant.definition,
          occurredAt
        })
      }
    })
    expect(await grantIds(room)).toContain(GRANT_ID)

    await room.startAreaAction({ x: 50, y: 150 })
    await answerAllSaves(room)
    expect(await grantIds(room)).not.toContain(GRANT_ID)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await grantIds(room)).toContain(GRANT_ID)
  })
})

describe('room area commit with Legendary Resistance', () => {
  async function decide(room: AnyAreaRoom, kind: 'USE' | 'DECLINE') {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const offered = decision.pending.legendaryResistance.find(
      (entry) => entry.actorId === RESISTER_ID
    )
    if (!offered) throw new Error('The creature has no pending choice.')
    return room.send(
      room.resolveCommand(decision, {
        kind: 'AREA_LEGENDARY_RESISTANCE',
        actorId: RESISTER_ID,
        decision: kind === 'USE' ? { kind: 'USE', optionId: offered.optionId } : { kind: 'DECLINE' }
      })
    )
  }
  const resisterChild = (history: RoomHistory) => {
    const child = areaReceipts(history).children.find(
      ({ outputs }) =>
        outputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' && outputs.targetActorId === RESISTER_ID
    )?.outputs
    if (child?.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('The resisting creature has no batch.')
    return child
  }

  it.each([
    {
      kind: 'USE' as const,
      damage: 0,
      charge: expect.objectContaining({ beforeUsed: 0, afterUsed: 1 })
    },
    { kind: 'DECLINE' as const, damage: 1, charge: null }
  ])(
    'commits when the last decision is $kind, the charge on that creature’s batch',
    async ({ kind, damage, charge }) => {
      const room = await resisterAreaRoom()
      await room.startAreaAction({ x: 50, y: 150 })
      await answerAllSaves(room)
      // Every save failed; only the Legendary Resistance choice keeps the area pending.
      const waiting = await room.pendingDecision()
      if (waiting.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      expect(waiting.pending.saves).toEqual([])

      expect((await decide(room, kind)).type).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const history = await readRoomHistory(room.room.base.stub)
      const child = resisterChild(history)
      expect(child.targetFeatureResourceConsumption).toEqual(charge)
      const { before, after } = child.targetTransition
      expect(before.currentHitPoints - after.currentHitPoints).toBe(damage)
      expect(areaReceipts(history).roots).toHaveLength(1)
    }
  )

  it('commits when the last save is answered after the choice was already made', async () => {
    const room = await resisterAreaRoom()
    await room.startAreaAction({ x: 50, y: 150 })
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === RESISTER_ID)!
    await room.send(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [1],
        rollMode: save.request.rollMode
      })
    )
    expect((await decide(room, 'USE')).type).toBe('COMMAND_COMMITTED')
    expect(areaReceipts(await readRoomHistory(room.room.base.stub)).roots).toEqual([])
    await answerAllSaves(room)

    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const history = await readRoomHistory(room.room.base.stub)
    expect(resisterChild(history).targetFeatureResourceConsumption).toEqual(
      expect.objectContaining({ afterUsed: 1 })
    )
  })
})

const conditionsOf = (history: RoomHistory, id: string) =>
  (
    (vitalsOf(history).find((vitals) => vitals.id === id)?.conditions ?? []) as {
      conditionTypeId: string
    }[]
  ).map(({ conditionTypeId }) => conditionTypeId)

describe('room area action that leaves a condition behind (SPELLS-19.1)', () => {
  it('leaves Frightened and its lasting effect on each creature that fails, and one undo takes them from every one', async () => {
    const creature = frightenOnFailedSave(fireballWolf())
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
        srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf })
      ],
      ownerFeatureId: creature.features.find((feature) => feature.label === 'Bite')?.id
    })
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    // The caster and the first Wolf fail their save; the second Wolf passes.
    await answerAllSaves(room, { [CAUGHT_IDS[1]!]: 20 })

    const committed = await readRoomHistory(room.room.base.stub)
    expect(conditionsOf(committed, CASTER_ID)).toContain(frightenedId())
    expect(conditionsOf(committed, CAUGHT_IDS[0]!)).toContain(frightenedId())
    expect(conditionsOf(committed, CAUGHT_IDS[1]!)).not.toContain(frightenedId())
    expect(committed.activeEffects.map((effect) => effect.targetActorId).sort()).toEqual(
      [CASTER_ID, CAUGHT_IDS[0]!].sort()
    )

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
    expect(reverted.activeEffects).toEqual([])
  })

  it('leaves a caught Character the same lasting effect, and the undo takes it from them too', async () => {
    const creature = frightenOnFailedSave(fireballWolf())
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature }),
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf })
      ],
      ownerFeatureId: BITE_ID
    })
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.room.base.stub)).characterEffects).toEqual([])
  })
})

/** Acid Splash whose failed save frightens for two rounds instead of burning. */
function frighteningSplash(): SpellAuthored {
  return {
    ...acidSplash,
    effects: acidSplash.effects?.map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) =>
        !('resultBlock' in path) ? path : { ...path, resultBlock: frightenedResultBlock() }
      )
    }))
  }
}

describe('room cast on chosen creatures that leaves a condition (SPELLS-19.1)', () => {
  it('leaves Frightened and its lasting effect on the creature that fails, and one undo takes it back', async () => {
    const spell = frighteningSplash()
    const room = await actionRoom({
      actors: [
        characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
        srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf })
      ],
      characterSpellcasting: { spells: [spell], prepared: [spell.id] },
      characterAction: (action) => action.label === spell.label,
      rolls: []
    })
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await room.startActorsAction([CAUGHT_IDS[0]!, CAUGHT_IDS[1]!], [], true)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room, { [CAUGHT_IDS[1]!]: 20 })

    const committed = await readRoomHistory(room.room.base.stub)
    expect(conditionsOf(committed, CAUGHT_IDS[0]!)).toContain(frightenedId())
    expect(conditionsOf(committed, CAUGHT_IDS[1]!)).not.toContain(frightenedId())
    expect(committed.activeEffects.map((effect) => effect.targetActorId)).toEqual([CAUGHT_IDS[0]!])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    const reverted = await readRoomHistory(room.room.base.stub)
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
    expect(reverted.activeEffects).toEqual([])
  })
})

/**
 * A Fireball whose failed save also drains 1d4 Strength. Nothing in the action's effect plan shows
 * it; only the settled outcome carries the reduction a creature keeps.
 */
function drainFireballWolf() {
  const base = fireballWolf()
  return creatureAuthoredDtoSchema.parse({
    ...base,
    features: base.features?.map((feature) =>
      feature.label !== 'Bite'
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: effect.paths.map((path) =>
                !('resultBlock' in path)
                  ? path
                  : {
                      ...path,
                      resultBlock: {
                        ...path.resultBlock,
                        outcomes: [
                          ...path.resultBlock.outcomes,
                          {
                            id: '00000000-0000-4000-8000-0000000000b1',
                            effectKind: 'SCALAR_REDUCTION' as const,
                            valueDefinitionId: SRD_ABILITY_DEFINITION_IDS.STRENGTH,
                            amount: {
                              kind: 'DICE' as const,
                              diceConfig: '1d4'
                            },
                            stacking: 'ADDITIVE' as const,
                            floor: 0,
                            recoveryTriggers: ['SHORT_REST' as const, 'LONG_REST' as const],
                            terminalConsequence: 'TARGET_DIED' as const
                          }
                        ]
                      }
                    }
              )
            }))
          }
    )
  })
}

describe('room area action whose outcome leaves a lasting effect only once settled (SPELLS-19.1)', () => {
  it('keeps the Strength reduction on each creature that fails, and one undo takes it from every one', async () => {
    const creature = drainFireballWolf()
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf })
      ],
      ownerFeatureId: creature.features.find((feature) => feature.label === 'Bite')?.id
    })
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)

    const committed = await readRoomHistory(room.room.base.stub)
    expect(committed.activeEffects.map((effect) => effect.targetActorId).sort()).toEqual(
      [CASTER_ID, CAUGHT_IDS[0]!].sort()
    )
    for (const effect of committed.activeEffects)
      expect(JSON.parse(effect.definitionJson).stateContributions).toEqual([
        expect.objectContaining({ kind: 'SCALAR_REDUCTION' })
      ])

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
  })
})

const CASTER_CHARGE_ID = testUuid(0x7a0)

/** A Character Feature spending one charge on a 20 ft Dexterity-save sphere dealing 1 damage. */
const charcoalBurst: ClassFeature = {
  id: testUuid(0x7a1),
  label: 'Charcoal Burst',
  description: 'A charged area save.',
  attributes: ['LIMITED_USE'],
  charges: {
    id: CASTER_CHARGE_ID,
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    resetKind: 'SHORT_REST',
    amount: 2
  },
  availableAtLevel: 1,
  order: 1,
  effects: [
    {
      id: testUuid(0x7a2),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        resourceUse: { chargeId: CASTER_CHARGE_ID, cost: 1 },
        activation: { code: 'ACTION', amount: 1 },
        range: {
          id: testUuid(0x7a3),
          rangeKind: 'DISTANCE',
          amount: 150,
          unit: 'FEET'
        },
        targeting: { selectionKind: 'AREA_CONTENTS', dispositionKind: 'ANY' },
        shape: {
          id: testUuid(0x7a4),
          shapeKind: 'SPHERE',
          radius: { amount: 20, unit: 'FEET' }
        },
        savingThrow: {
          id: testUuid(0x7a5),
          dcMethod: 'FIXED_DC',
          abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
          baseDc: 10
        }
      },
      paths: [
        {
          id: testUuid(0x7a6),
          order: 1,
          pathCode: 'ON_SAVE_FAIL',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0x7a7),
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: testUuid(0x7a8),
                effectKind: 'DAMAGE',
                damageTypeId: srdSystemRecord.damageTypes!.find(({ code }) => code === 'FIRE')!.id,
                valueKind: 'FIXED',
                scalingKind: 'NONE',
                amount: 1
              }
            ]
          }
        }
      ]
    }
  ]
}

/** A Character casts the burst over itself and three Wolves, with a fourth Wolf out of reach. */
function characterCasterRoom() {
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf }),
      srdCreatureActor({ id: CAUGHT_IDS[2]!, creature: plainWolf }),
      srdCreatureActor({ id: FAR_ID, creature: plainWolf })
    ],
    characterClassFeatures: [charcoalBurst],
    characterAction: (action) => action.label.includes('Charcoal Burst')
  })
}

/** Every charge the Character has spent, as the Sheet's usage rows record it. */
const readCharacterChargesUsed = (room: AnyAreaRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .flatMap((row) => row.state.resourceUsage.map(({ used }) => used))
  )

describe('room area action cast by a Character', () => {
  it('spends the Character’s charge with its own outcome, and one undo restores both', async () => {
    const room = await characterCasterRoom()
    const hitPointsBefore = await readCharacterHitPoints(room)
    const { command, answer } = await room.startAreaAction({ x: 50, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const { roots, children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots).toHaveLength(1)
    expect(roots[0]?.receipt.commandId).toBe(command.commandId)
    expect(roots[0]?.outputs.sourceCharacterId).toBe(CHARACTER_ID)
    // The Character is caught by its own area: its charge rides its own outcome's Sheet write.
    expect(children.map(({ outputs }) => outputs.kind).sort()).toEqual([
      'CHARACTER_MECHANICS_BATCH',
      'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    ])
    expect(await readCharacterChargesUsed(room)).toEqual([1])
    expect(await readCharacterHitPoints(room)).toBe(hitPointsBefore - 1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect((await readCharacterChargesUsed(room)).filter((used) => used !== 0)).toEqual([])
    expect(await readCharacterHitPoints(room)).toBe(hitPointsBefore)
  })
})

describe('room area origin warnings (range and sight)', () => {
  const NEAR = { x: 350, y: 150 }
  const BEYOND_RANGE = { x: 4150, y: 150 }
  const BLINDED_ID = srdSystemRecord.conditionTypes.find(({ code }) => code === 'BLINDED')?.id
  const wall = {
    kind: 'WALL' as const,
    id: testUuid(0x7b0),
    a: { x: 300, y: -500 },
    b: { x: 300, y: 500 },
    blocksLight: true,
    blocksMovement: true
  }

  /** A caster with no Senses of its own and two Wolves; `blind` blinds the caster. */
  function warningRoom(options: { blind?: boolean; walled?: boolean } = {}) {
    return actionRoom({
      ...(options.walled ? { sceneOverrides: { barriers: [wall] } } : {}),
      // These tests are about the sight warning; the wall's cover has its own proof.
      automaticCover: false,
      actors: [
        srdCreatureActor({
          id: CASTER_ID,
          creature: { ...fireballWolf(), senses: [] },
          conditionIds: options.blind && BLINDED_ID ? [BLINDED_ID] : []
        }),
        srdCreatureActor({ id: CAUGHT_IDS[0]!, creature: plainWolf }),
        srdCreatureActor({ id: CAUGHT_IDS[1]!, creature: plainWolf })
      ],
      ownerFeatureId: BITE_ID
    })
  }
  type Room = Awaited<ReturnType<typeof warningRoom>>
  const warningCodes = (answer: object) =>
    (answer as { warnings: { code: string }[] }).warnings.map(({ code }) => code)

  async function expectRefusedThenOpened(
    room: Room,
    point: { x: number; y: number },
    codes: ResolveEncounterActionInputDto['acknowledgedWarnings']
  ) {
    const before = await readRoomHistory(room.room.base.stub)
    const refused = await room.startAreaAction(point)
    expect(refused.answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
    expect(warningCodes(refused.answer)).toEqual(codes)
    // The refusal opens nothing and spends nothing.
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)

    const opened = await room.startAreaAction(point, codes)
    expect(opened.answer.type, JSON.stringify(opened.answer)).toBe('COMMAND_COMMITTED')
  }

  it('opens the area with no warning for a point in range and in sight', async () => {
    const room = await warningRoom()
    const { answer } = await room.startAreaAction(NEAR)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await room.pendingDecision()).pending.kind).toBe('AREA_SAVES')
  })

  it('refuses a point beyond range with the warning, and opens the area once it is acknowledged', async () => {
    await expectRefusedThenOpened(await warningRoom(), BEYOND_RANGE, ['TARGET_OUT_OF_RANGE'])
  })

  it('refuses a point a Blinded caster cannot see, and opens the area once it is acknowledged', async () => {
    const room = await warningRoom({ blind: true })
    await expectRefusedThenOpened(room, NEAR, ['TARGET_OUT_OF_SIGHT'])
    expect((await room.pendingDecision()).pending.kind).toBe('AREA_SAVES')
  })

  it('refuses a point behind a wall that blocks light, and opens the area once it is acknowledged', async () => {
    const room = await warningRoom({ walled: true })
    await expectRefusedThenOpened(room, { x: 450, y: 150 }, ['TARGET_OUT_OF_SIGHT'])
    expect((await room.pendingDecision()).pending.kind).toBe('AREA_SAVES')
  })

  it('does not warn for a point on the caster’s side of the wall', async () => {
    const room = await warningRoom({ walled: true })
    const { answer } = await room.startAreaAction({ x: 250, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  })

  it('warns of both range and sight, range first, and needs both acknowledged', async () => {
    const room = await warningRoom({ blind: true })
    const refused = await room.startAreaAction(BEYOND_RANGE, ['TARGET_OUT_OF_RANGE'])
    expect(refused.answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
    expect(warningCodes(refused.answer)).toEqual(['TARGET_OUT_OF_RANGE', 'TARGET_OUT_OF_SIGHT'])
    const opened = await room.startAreaAction(BEYOND_RANGE, [
      'TARGET_OUT_OF_RANGE',
      'TARGET_OUT_OF_SIGHT'
    ])
    expect(opened.answer.type, JSON.stringify(opened.answer)).toBe('COMMAND_COMMITTED')
  })
})

describe('room area visibility by role', () => {
  const SEEN_ID = CAUGHT_IDS[0]!
  const SECOND_ID = CAUGHT_IDS[1]!
  const HIDDEN_ID = testUuid(0x710)
  const NO_ONE = new Set<string>()
  const shadowWolf = { ...plainWolf, label: 'Shadow Wolf' }
  const shadowLegend = { ...legendaryWolf, label: 'Shadow Wolf' }

  /**
   * The caster, a visible Wolf, a creature the GM has hidden from the players, a second visible Wolf,
   * all in the area, and a Wolf out of it. With `hiddenCaster` the caster is the hidden one.
   */
  async function visibilityRoom(
    options: {
      hiddenCreature?: typeof shadowWolf
      hiddenCaster?: boolean
      playerControlledActorIds?: string[]
    } = {}
  ) {
    const hide = <Actor extends object>(actor: Actor) => ({ ...actor, public: false })
    const caster = srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() })
    const room = await actionRoom({
      ...(options.playerControlledActorIds
        ? { playerControlledActorIds: options.playerControlledActorIds }
        : {}),
      actors: [
        options.hiddenCaster ? hide(caster) : caster,
        srdCreatureActor({ id: SEEN_ID, creature: plainWolf }),
        hide(srdCreatureActor({ id: HIDDEN_ID, creature: options.hiddenCreature ?? shadowLegend })),
        srdCreatureActor({ id: SECOND_ID, creature: plainWolf }),
        srdCreatureActor({ id: FAR_ID, creature: plainWolf })
      ],
      ownerFeatureId: BITE_ID
    })
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return room
  }
  type Room = Awaited<ReturnType<typeof visibilityRoom>>
  const gmView = (room: Room) =>
    readPendingAreaForViewer(room.room.base.stub, { isOwner: true, controlledActorIds: NO_ONE })
  const playerView = (room: Room, controlled: string[]) =>
    readPendingAreaForViewer(room.room.base.stub, {
      isOwner: false,
      controlledActorIds: new Set(controlled)
    })
  async function saveCommand(room: Room, actorId: string, face: number) {
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
    if (!save) throw new Error('The creature has no pending save.')
    return room.resolveCommand(decision, {
      kind: 'ENTER_DICE',
      requestId: save.request.requestId,
      rawFaces: [face],
      rollMode: save.request.rollMode
    })
  }
  async function remove(room: Room, actorId: string) {
    const answered = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), actorId)
    )
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
  }

  it('shows the GM every caught creature’s save and Legendary Resistance offer, hidden ones included', async () => {
    const room = await visibilityRoom()
    const gm = await gmView(room)
    expect(gm?.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, SEEN_ID, HIDDEN_ID, SECOND_ID].sort()
    )
    expect(gm?.casterActorId).toBe(CASTER_ID)
    expect(gm?.caughtChecksum).toMatch(/^[a-f0-9]{64}$/)

    expect((await room.send(await saveCommand(room, HIDDEN_ID, 1))).type).toBe('COMMAND_COMMITTED')
    expect((await gmView(room))?.legendaryResistance.map(({ actorId }) => actorId)).toEqual([
      HIDDEN_ID
    ])
  })

  it('shows each roller only their own creature’s prompt', async () => {
    const room = await visibilityRoom()
    expect((await room.send(await saveCommand(room, HIDDEN_ID, 1))).type).toBe('COMMAND_COMMITTED')

    const seen = await playerView(room, [SEEN_ID])
    expect(seen?.saves.map(({ actorId }) => actorId)).toEqual([SEEN_ID])
    expect(seen?.legendaryResistance).toEqual([])
    expect(JSON.stringify(seen)).not.toContain(HIDDEN_ID)

    const hidden = await playerView(room, [HIDDEN_ID])
    expect(hidden?.saves).toEqual([])
    expect(hidden?.legendaryResistance.map(({ actorId }) => actorId)).toEqual([HIDDEN_ID])
    expect(JSON.stringify(hidden)).not.toContain(SEEN_ID)
    expect((await playerView(room, [CASTER_ID]))?.saves.map(({ actorId }) => actorId)).toEqual([
      CASTER_ID
    ])
  })

  it('gives a player none of the GM’s sealing of the caught set', async () => {
    const room = await visibilityRoom()
    const player = await playerView(room, [SEEN_ID])
    expect(player?.caughtChecksum).toBeNull()
    expect(player?.casterActorId).toBe(CASTER_ID)
    const gm = await gmView(room)
    expect(JSON.stringify(player)).not.toContain(gm?.caughtChecksum ?? 'missing')
  })

  it('names a caster the players cannot see only to the GM and the caster’s own controller', async () => {
    const room = await visibilityRoom({ hiddenCaster: true })
    expect((await gmView(room))?.casterActorId).toBe(CASTER_ID)
    expect((await playerView(room, [SEEN_ID]))?.casterActorId).toBeNull()
    expect((await playerView(room, [CASTER_ID]))?.casterActorId).toBe(CASTER_ID)
  })

  it('leaves a player’s prompt unchanged when the GM removes a creature they cannot see', async () => {
    const room = await visibilityRoom({ hiddenCreature: shadowWolf })
    const before = await playerView(room, [SEEN_ID])
    await remove(room, HIDDEN_ID)
    const after = await playerView(room, [SEEN_ID])
    // Only the occurrence version moves, as it does when any other creature answers.
    expect({ ...after, occurrenceVersion: before?.occurrenceVersion }).toEqual(before)
  })

  it('tells a player nothing of a creature they cannot see in any refusal', async () => {
    const room = await visibilityRoom({
      hiddenCreature: shadowWolf,
      playerControlledActorIds: [SEEN_ID]
    })
    const decision = await room.pendingDecision()
    const byPlayer = await room.sendAsPlayer(room.removeAreaTargetCommand(decision, HIDDEN_ID))
    expect(byPlayer).toMatchObject({ type: 'COMMAND_REJECTED' })

    // An answer composed before the GM removed the hidden creature is stale.
    const stale = await saveCommand(room, SEEN_ID, 9)
    await remove(room, HIDDEN_ID)
    const staleAnswer = await room.sendAsPlayer(stale)
    expect(staleAnswer).toMatchObject({ type: 'COMMAND_REJECTED' })
    for (const refusal of [byPlayer, staleAnswer]) {
      expect(JSON.stringify(refusal)).not.toContain(HIDDEN_ID)
      expect(JSON.stringify(refusal)).not.toContain('Shadow')
    }
  })

  it('keeps a creature the players cannot see off the table’s cards and chat once the area commits', async () => {
    const room = await visibilityRoom({ hiddenCreature: shadowWolf })
    await answerAllSaves(room)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()

    const stub = room.room.base.stub
    const cards = await readRoomRollCards(stub)
    const table = cards.filter((card) => card.audience === 'TABLE')
    expect(JSON.stringify(table)).not.toContain('Shadow Wolf')
    expect(JSON.stringify(table)).not.toContain(HIDDEN_ID)
    expect(JSON.stringify(cards.filter((card) => card.audience === 'PRIVATE'))).toContain(
      'Shadow Wolf'
    )
    const chat = JSON.stringify(await readRoomChatBodies(stub))
    expect(chat).not.toContain('Shadow Wolf')
    expect(chat).not.toContain(HIDDEN_ID)
  })

  describe('the GM-only history line', () => {
    const rootEntry = (page: Awaited<ReturnType<typeof readRoomTimeline>>) =>
      page.entries.find((entry) => entry.commandType === 'RESOLVE_ACTION')

    it('records each removal for the GM in the order made, and shows players nothing of it', async () => {
      const room = await visibilityRoom({ hiddenCreature: shadowWolf })
      await remove(room, HIDDEN_ID)
      await remove(room, SECOND_ID)
      await answerAllSaves(room)

      const stub = room.room.base.stub
      expect(
        rootEntry(await readRoomTimeline(stub, { player: false, userId: room.room.base.userId }))
          ?.gmLines
      ).toEqual(['GM removed Shadow Wolf from the area', 'GM removed Wolf from the area'])
      const player = await readRoomTimeline(stub, { player: true, userId: room.room.base.playerId })
      expect(player.entries.every((entry) => entry.gmLines.length === 0)).toBe(true)
      expect(JSON.stringify(player)).not.toContain('removed')
      expect(JSON.stringify(player)).not.toContain('Shadow')
    })

    it('records the removal that settles the area', async () => {
      const room = await visibilityRoom({ hiddenCreature: shadowWolf })
      for (const actorId of [CASTER_ID, SEEN_ID]) {
        expect((await room.send(await saveCommand(room, actorId, 9))).type).toBe(
          'COMMAND_COMMITTED'
        )
      }
      await remove(room, HIDDEN_ID)
      await remove(room, SECOND_ID)
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      expect(
        rootEntry(
          await readRoomTimeline(room.room.base.stub, {
            player: false,
            userId: room.room.base.userId
          })
        )?.gmLines
      ).toHaveLength(2)
    })

    it('records nothing for an area where the GM removed no one', async () => {
      const room = await visibilityRoom({ hiddenCreature: shadowWolf })
      await answerAllSaves(room)
      expect(
        rootEntry(
          await readRoomTimeline(room.room.base.stub, {
            player: false,
            userId: room.room.base.userId
          })
        )?.gmLines
      ).toEqual([])
    })
  })
})

describe('room area perception for the caster', () => {
  const SEEN_ID = CAUGHT_IDS[0]!
  const PHANTOM_ID = testUuid(0x711)
  const SHADOW_ID = testUuid(0x712)
  const INVISIBLE_ID = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'INVISIBLE'
  )?.id
  const OUTSIDER_ID = testUuid(0x999)
  const NO_ONE = new Set<string>()

  /**
   * A caster with no Senses of its own, a Wolf in plain sight, an Invisible Wolf the table can see
   * (public), and a Wolf the table cannot (hidden) in plain sight of the caster, all in the area.
   * The player controls the caster and sends the action.
   */
  async function perceptionRoom(options: { legendary?: boolean } = {}) {
    const wolf = options.legendary ? legendaryWolf : plainWolf
    const caster = { ...fireballWolf(), senses: [] }
    const room = await actionRoom({
      playerControlledActorIds: [CASTER_ID],
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: caster }),
        srdCreatureActor({ id: SEEN_ID, creature: wolf }),
        srdCreatureActor({
          id: PHANTOM_ID,
          creature: { ...wolf, label: 'Phantom Wolf' },
          conditionIds: INVISIBLE_ID ? [INVISIBLE_ID] : []
        }),
        {
          ...srdCreatureActor({ id: SHADOW_ID, creature: { ...plainWolf, label: 'Shadow Wolf' } }),
          public: false
        },
        srdCreatureActor({ id: FAR_ID, creature: plainWolf })
      ],
      ownerFeatureId: BITE_ID
    })
    const started = await room.startAreaAction({ x: 50, y: 150 }, [], 'PLAYER')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    return room
  }
  type Room = Awaited<ReturnType<typeof perceptionRoom>>
  const gmView = (room: Room) =>
    readPendingAreaForViewer(room.room.base.stub, { isOwner: true, controlledActorIds: NO_ONE })
  const playerView = (room: Room, controlled: string[]) =>
    readPendingAreaForViewer(room.room.base.stub, {
      isOwner: false,
      controlledActorIds: new Set(controlled)
    })
  const lines = async (room: Room, viewer: 'GM' | 'CASTER_PLAYER' | 'OUTSIDER') => {
    const { base } = room.room
    const page = await readRoomTimeline(base.stub, {
      player: viewer !== 'GM',
      userId:
        viewer === 'GM' ? base.userId : viewer === 'CASTER_PLAYER' ? base.playerId : OUTSIDER_ID
    })
    return page.entries.find((entry) => entry.commandType === 'RESOLVE_ACTION')
  }

  it('lists every caught creature to the GM', async () => {
    const room = await perceptionRoom()
    expect((await gmView(room))?.caught.slice().sort()).toEqual(
      ['Wolf', 'Wolf', 'Phantom Wolf', 'Shadow Wolf'].sort()
    )
  })

  it('lists to the caster only the caught creatures they perceive, whether or not the table sees them', async () => {
    const room = await perceptionRoom()
    const caster = await playerView(room, [CASTER_ID])
    expect(caster?.caught.slice().sort()).toEqual(['Shadow Wolf', 'Wolf', 'Wolf'])
    expect(JSON.stringify(caster)).not.toContain(PHANTOM_ID)
    expect(JSON.stringify(caster)).not.toContain('Phantom')
  })

  it('lists nothing to a player who does not control the caster', async () => {
    const room = await perceptionRoom()
    expect((await playerView(room, [SEEN_ID]))?.caught).toEqual([])
  })

  it('takes a removed creature off the caster’s list and keeps the rest as sealed', async () => {
    const room = await perceptionRoom()
    const removed = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), SHADOW_ID)
    )
    expect(removed.type, JSON.stringify(removed)).toBe('COMMAND_COMMITTED')
    expect((await playerView(room, [CASTER_ID]))?.caught).toEqual(['Wolf', 'Wolf'])
  })

  describe('the roll cards', () => {
    const tableCards = async (room: Room) =>
      (await readRoomRollCards(room.room.base.stub)).filter((card) => card.audience === 'TABLE')
    const privateCards = async (room: Room) =>
      (await readRoomRollCards(room.room.base.stub)).filter((card) => card.audience === 'PRIVATE')

    it('keeps an unperceived creature’s save card off the table and in the GM’s private history', async () => {
      const room = await perceptionRoom()
      await answerAllSaves(room)
      expect(JSON.stringify(await tableCards(room))).not.toContain('Phantom')
      expect(JSON.stringify(await tableCards(room))).toContain('Wolf')
      expect(JSON.stringify(await privateCards(room))).toContain('Phantom Wolf')
    })

    it('keeps the card of an unperceived creature’s save rolled by the app off the table', async () => {
      const room = await perceptionRoom()
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      const save = decision.pending.saves.find((entry) => entry.actorId === PHANTOM_ID)!
      const rolled = await room.send({
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrence.id,
        expectedOccurrenceVersion: decision.occurrence.version,
        requestId: save.request.requestId,
        rollMode: null
      })
      expect(rolled.type, JSON.stringify(rolled)).toBe('COMMAND_COMMITTED')
      expect(JSON.stringify(await tableCards(room))).not.toContain('Phantom')
      expect(JSON.stringify(await privateCards(room))).toContain('Phantom Wolf')
    })
  })

  describe('the results the caster keeps', () => {
    it('shows each perceived creature’s outcome and each failed unperceived one as an unseen creature', async () => {
      const room = await perceptionRoom()
      await answerAllSaves(room)
      const entry = await lines(room, 'CASTER_PLAYER')
      expect(entry?.visibility).toBe('ISSUER')
      expect(entry?.issuerLines.slice().sort()).toEqual([
        'An unseen creature failed its save',
        'Shadow Wolf failed its save',
        'Wolf failed its save',
        'Wolf failed its save'
      ])
      expect(JSON.stringify(entry)).not.toContain('Phantom')
      expect(JSON.stringify(entry)).not.toContain(PHANTOM_ID)
    })

    it('leaves no trace of an unperceived creature that succeeded', async () => {
      const room = await perceptionRoom()
      await answerAllSaves(room, { [PHANTOM_ID]: 20 })
      const entry = await lines(room, 'CASTER_PLAYER')
      expect(entry?.issuerLines.slice().sort()).toEqual([
        'Shadow Wolf failed its save',
        'Wolf failed its save',
        'Wolf failed its save'
      ])
    })

    it('shows a perceived creature that succeeded', async () => {
      const room = await perceptionRoom()
      await answerAllSaves(room, { [SEEN_ID]: 20 })
      expect((await lines(room, 'CASTER_PLAYER'))?.issuerLines).toContain(
        'Wolf succeeded on its save'
      )
    })

    /** Answers every save with a 1, then settles the Legendary Resistance offers `uses` names as USE. */
    async function failAllThenDecide(room: Room, uses: string[]) {
      await answerAllSaves(room)
      for (;;) {
        const pending = await readPendingActionDecision(room.room.base.stub)
        if (pending?.pending.kind !== 'AREA_SAVES') return
        const [offered] = pending.pending.legendaryResistance
        if (!offered) return
        const sent = await room.send(
          room.resolveCommand(pending, {
            kind: 'AREA_LEGENDARY_RESISTANCE',
            actorId: offered.actorId,
            decision: uses.includes(offered.actorId)
              ? { kind: 'USE', optionId: offered.optionId }
              : { kind: 'DECLINE' }
          })
        )
        expect(sent.type, JSON.stringify(sent)).toBe('COMMAND_COMMITTED')
      }
    }

    it('reports a perceived creature that used Legendary Resistance as having succeeded', async () => {
      const room = await perceptionRoom({ legendary: true })
      await failAllThenDecide(room, [SEEN_ID])
      const entry = await lines(room, 'CASTER_PLAYER')
      expect(entry?.issuerLines.slice().sort()).toEqual([
        'An unseen creature failed its save',
        'Shadow Wolf failed its save',
        'Wolf failed its save',
        'Wolf succeeded on its save'
      ])
    })

    it('leaves no trace of an unperceived creature that used Legendary Resistance', async () => {
      const room = await perceptionRoom({ legendary: true })
      await failAllThenDecide(room, [PHANTOM_ID])
      const entry = await lines(room, 'CASTER_PLAYER')
      expect(entry?.issuerLines).not.toContain('An unseen creature failed its save')
      expect(JSON.stringify(entry)).not.toContain('Phantom')
    })

    it('still reports a creature that declined Legendary Resistance as having failed', async () => {
      const room = await perceptionRoom({ legendary: true })
      await failAllThenDecide(room, [])
      const entry = await lines(room, 'CASTER_PLAYER')
      expect(entry?.issuerLines.slice().sort()).toEqual([
        'An unseen creature failed its save',
        'Shadow Wolf failed its save',
        'Wolf failed its save',
        'Wolf failed its save'
      ])
    })

    it('shows the GM the same results and no other player any of them', async () => {
      const room = await perceptionRoom()
      await answerAllSaves(room)
      const caster = await lines(room, 'CASTER_PLAYER')
      expect((await lines(room, 'GM'))?.issuerLines).toEqual(caster?.issuerLines)
      expect(await lines(room, 'OUTSIDER')).toBeUndefined()
    })

    it('keeps the GM’s removals out of the caster’s copy', async () => {
      const room = await perceptionRoom()
      const removed = await room.send(
        room.removeAreaTargetCommand(await room.pendingDecision(), SHADOW_ID)
      )
      expect(removed.type).toBe('COMMAND_COMMITTED')
      await answerAllSaves(room)
      expect((await lines(room, 'GM'))?.gmLines).toEqual(['GM removed Shadow Wolf from the area'])
      const caster = await lines(room, 'CASTER_PLAYER')
      expect(caster?.gmLines).toEqual([])
      expect(JSON.stringify(caster)).not.toContain('Shadow')
      expect(caster?.issuerLines.slice().sort()).toEqual([
        'An unseen creature failed its save',
        'Wolf failed its save',
        'Wolf failed its save'
      ])
    })
  })
})

describe('room area save prompt of a creature the caster cannot perceive', () => {
  const SEEN_ID = CAUGHT_IDS[0]!
  const PHANTOM_ID = testUuid(0x713)
  const INVISIBLE_ID = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'INVISIBLE'
  )?.id

  /**
   * A senseless caster the GM runs, a Wolf in plain sight, and an Invisible Wolf the caster cannot
   * perceive whose roller is the room's player.
   */
  async function phantomRoom() {
    const room = await actionRoom({
      playerControlledActorIds: [PHANTOM_ID],
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: { ...fireballWolf(), senses: [] } }),
        srdCreatureActor({ id: SEEN_ID, creature: plainWolf }),
        srdCreatureActor({
          id: PHANTOM_ID,
          creature: { ...plainWolf, label: 'Phantom Wolf' },
          conditionIds: INVISIBLE_ID ? [INVISIBLE_ID] : []
        })
      ],
      ownerFeatureId: BITE_ID
    })
    expect((await room.startAreaAction({ x: 250, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    return room
  }
  type Room = Awaited<ReturnType<typeof phantomRoom>>
  const viewAs = (room: Room, controlled: string[], isOwner = false) =>
    readPendingAreaForViewer(room.room.base.stub, {
      isOwner,
      controlledActorIds: new Set(controlled)
    })

  it('gives the creature’s own roller its save prompt, and the caster’s view nothing of it', async () => {
    const room = await phantomRoom()
    const own = await viewAs(room, [PHANTOM_ID])
    expect(own?.saves.map(({ actorId }) => actorId)).toEqual([PHANTOM_ID])

    const caster = await viewAs(room, [CASTER_ID])
    expect(caster?.saves.map(({ actorId }) => actorId)).toEqual([CASTER_ID])
    expect(caster?.caught).not.toContain('Phantom Wolf')
    expect(JSON.stringify(caster)).not.toContain(PHANTOM_ID)
    expect(JSON.stringify(caster)).not.toContain('Phantom')
    expect((await viewAs(room, [], true))?.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, SEEN_ID, PHANTOM_ID].sort()
    )
  })

  it('lets that roller answer their own save, which leaves the other saves waiting', async () => {
    const room = await phantomRoom()
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === PHANTOM_ID)!
    const answer = await room.sendAsPlayer(
      room.resolveCommand(decision, {
        kind: 'ENTER_DICE',
        requestId: save.request.requestId,
        rawFaces: [9],
        rollMode: save.request.rollMode
      })
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await room.pendingDecision()
    if (after.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    expect(after.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
      [CASTER_ID, SEEN_ID].sort()
    )
    // Having answered, that roller has nothing left in the area to answer.
    expect(await viewAs(room, [PHANTOM_ID])).toBeNull()
  })
})

describe('room area save card of an unperceived creature rolled by its own player (ATTACK-17.5)', () => {
  const SEEN_ID = CAUGHT_IDS[0]!
  const PHANTOM_ID = testUuid(0x714)
  const INVISIBLE_ID = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'INVISIBLE'
  )?.id

  /**
   * A senseless caster the room's first player controls, a Wolf in plain sight, and an Invisible
   * Wolf the caster cannot perceive whose roller is the room's second player; the first player
   * starts the area.
   */
  async function twoPlayerRoom() {
    const room = await actionRoom({
      playerControlledActorIds: [CASTER_ID],
      otherPlayerControlledActorIds: [PHANTOM_ID],
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: { ...fireballWolf(), senses: [] } }),
        srdCreatureActor({ id: SEEN_ID, creature: plainWolf }),
        srdCreatureActor({
          id: PHANTOM_ID,
          creature: { ...plainWolf, label: 'Phantom Wolf' },
          conditionIds: INVISIBLE_ID ? [INVISIBLE_ID] : []
        })
      ],
      ownerFeatureId: BITE_ID
    })
    const started = await room.startAreaAction({ x: 250, y: 150 }, [], 'PLAYER')
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    return room
  }

  it('answers the creature’s player with the roll and keeps it in only the GM’s and that player’s history', async () => {
    const room = await twoPlayerRoom()
    const { base } = room.room
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const save = decision.pending.saves.find((entry) => entry.actorId === PHANTOM_ID)!
    const answered = await room.sendAsPlayer(
      {
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: decision.encounterVersion,
        occurrenceId: decision.occurrence.id,
        expectedOccurrenceVersion: decision.occurrence.version,
        requestId: save.request.requestId,
        rollMode: null
      },
      'OTHER_PLAYER'
    )
    if (answered.type !== 'COMMAND_COMMITTED' || answered.delta?.scope !== 'ENCOUNTER')
      throw new Error(`Expected the committed save roll: ${JSON.stringify(answered)}`)
    expect(answered.delta.result.roll).not.toBeNull()

    const holders = await readRoomPrivateRollHolders(base.stub)
    const rollId = answered.delta.result.roll!.id
    expect(
      holders.map(({ userId, rollId: held, gmCampaignRoll }) => ({
        userId,
        held,
        bound: gmCampaignRoll !== null
      }))
    ).toEqual(
      expect.arrayContaining([
        { userId: base.userId, held: rollId, bound: true },
        { userId: base.otherPlayerId, held: rollId, bound: false }
      ])
    )
    expect(holders).toHaveLength(2)
    expect(holders.map(({ userId }) => userId)).not.toContain(base.playerId)
    const table = (await readRoomRollCards(base.stub)).filter((card) => card.audience === 'TABLE')
    expect(JSON.stringify(table)).not.toContain('Phantom')
  })
})
