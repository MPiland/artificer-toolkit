import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { legendaryWolf, plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, fireballWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readPendingActionDecision,
  readPendingAreaChoices,
  readPendingAreaForViewer,
  readRoomHistory,
  readRoomRollCards
} from './roomHistoryReads.js'

const CASTER_ID = testUuid(0x700)
const CAUGHT_IDS = [testUuid(0x701), testUuid(0x702), testUuid(0x703)]
const FAR_ID = testUuid(0x704)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** Five Wolves 100 px apart; the first casts. A 20 ft sphere at x = 50 reaches the first four. */
function areaRoom() {
  return actionRoom({
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

  it('refuses an area that catches nobody', async () => {
    const room = await areaRoom()
    const { answer } = await room.startAreaAction({ x: 150, y: 2000 })
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
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
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
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
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
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
    expect(stale).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
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
    expect(again).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'DECISION_NOT_PENDING' })
    expect(savesOf(await room.pendingDecision())).toHaveLength(3)
  })

  it('refuses the GM taking out a creature that already rolled', async () => {
    const { room, decision } = await pendingAreaRoom()
    expect((await room.send(answerCommand(room, decision, CAUGHT_IDS[0]!))).type).toBe(
      'COMMAND_COMMITTED'
    )
    const fresh = await room.pendingDecision()
    const removal = await room.send(room.removeAreaTargetCommand(fresh, CAUGHT_IDS[0]!))
    expect(removal).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
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
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'DECISION_NOT_PENDING' })
  })

  it('refuses a player answering a creature the GM runs', async () => {
    const { room, decision } = await pendingAreaRoom()
    const answer = await room.sendAsPlayer(answerCommand(room, decision, CAUGHT_IDS[0]!))
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'NOT_ACTOR_CONTROLLER' })
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
    readPendingAreaForViewer(room.room.base.stub, { isOwner: true, controlledActorIds: NO_ONE })
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

    const choice = { actorId: RESISTER_ID, optionId: expect.stringMatching(/^[a-f0-9]{64}$/) }
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
    expect(removal).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
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
    const room = await resistanceRoom({ playerControls: [CASTER_ID, CAUGHT_IDS[0]!] })
    expect((await answer(room, RESISTER_ID, 1)).type).toBe('COMMAND_COMMITTED')
    const refused = await room.sendAsPlayer(await decideCommand(room, RESISTER_ID, 'USE'))
    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'NOT_ACTOR_CONTROLLER' })
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
    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'VERSION_STALE' })
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
    expect(never).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'DECISION_NOT_PENDING' })
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
    expect(refused).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'DECISION_NOT_PENDING' })
  })
})
