import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { featureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  delegatedLegendaryContinuationCommandId,
  systemTriggerCommandId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { ancientRedDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-red-dragon.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { readLegendaryChoice, respondToLegendaryChoice } from './legendaryRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { movementRoom } from './movementRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readActorHitPoints,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-33.T4l3: a Legendary option whose area its owner centers on itself (the SRD Wing Attack)
 * runs as a rule-raised root through the area coordinator, and a continuation ADVANCE_TURN then
 * begins the next turn, so the SRD order holds: the turn ends, the option resolves, the next starts.
 */

const NEAR_WOLF_ID = testUuid(0x7a0)
const FAR_WOLF_ID = testUuid(0x7a1)
const DRAGON_ID = testUuid(0x7a2)
const PRONE_ID = SRD_CONDITION_TYPES.find(({ code }) => code === 'PRONE')!.id

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const sourceLegendary = creatureFeature(ancientRedDragon, 'Legendary Actions')
/** The SRD Legendary Actions narrowed to Wing Attack: a 15 ft sphere on the dragon, cost 2 of 3. */
const legendary: typeof sourceLegendary = {
  ...sourceLegendary,
  options: sourceLegendary.options?.filter((option) => option.label.startsWith('Wing Attack'))
}
/** A Medium Creature holding the Wing Attack, so token facts stay simple. */
const dragon: CreatureAuthored = {
  ...plainWolf,
  id: testUuid(0x7a3),
  features: [...(plainWolf.features ?? []), legendary]
}

/**
 * A homebrew breath authored from the Wing Attack (SPELLS-15): the same save, damage and prone, as a
 * 30 ft cone the dragon aims.
 */
const breath: CreatureAuthored = {
  ...dragon,
  features: dragon.features?.map((feature) =>
    feature.id === legendary.id
      ? {
          ...feature,
          options: feature.options?.map((option) => ({
            ...option,
            effects: option.effects?.map((effect) =>
              effect.invocation.kind === 'ACTION' && effect.invocation.shape
                ? {
                    ...effect,
                    invocation: {
                      ...effect.invocation,
                      shape: {
                        id: effect.invocation.shape.id,
                        shapeKind: 'CONE' as const,
                        length: { amount: 30, unit: 'FEET' as const }
                      }
                    }
                  }
                : effect
            )
          }))
        }
      : feature
  )
}

/** The near Wolf ends its turn 5 ft from the dragon; the far Wolf, 65 ft off, is next. */
function wingRoom(creature: CreatureAuthored = dragon) {
  return movementRoom({
    actors: [
      srdCreatureActor({ id: NEAR_WOLF_ID, creature: plainWolf }),
      srdCreatureActor({ id: FAR_WOLF_ID, creature: plainWolf }),
      srdCreatureActor({ id: DRAGON_ID, creature })
    ],
    moverActorId: NEAR_WOLF_ID,
    positions: {
      [NEAR_WOLF_ID]: { x: 250, y: 150 },
      [FAR_WOLF_ID]: { x: 1450, y: 150 },
      [DRAGON_ID]: { x: 150, y: 150 }
    },
    autoRoll: 'GAME_MASTER',
    fallbackRoll: 1
  })
}

describe('a room ADVANCE_TURN that delegates a Legendary area option (SPELLS-33.T4l3)', () => {
  it('ends the turn, resolves the Wing Attack on the creatures in its sphere, then begins the next turn', async () => {
    const room = await wingRoom()
    const before = await readRoomHistory(room.base.stub)
    const advanceId = crypto.randomUUID()
    const advanced = await room.send(advanceId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId: advanceId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(advanced.type, JSON.stringify(advanced)).toBe('COMMAND_COMMITTED')

    const choice = await readLegendaryChoice(room.base.stub)
    const [wing] = choice?.options ?? []
    expect(choice?.ownerActorId).toBe(DRAGON_ID)
    expect(wing).toMatchObject({
      label: 'Wing Attack (Costs 2 Actions)',
      targetActorIds: [DRAGON_ID],
      delegated: true
    })
    const { answer } = await respondToLegendaryChoice(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: wing!.optionId,
      targetActorId: DRAGON_ID
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    expect(await readLegendaryChoice(room.base.stub)).toBeNull()
    // The Wolf within 15 ft fails its DC 25 save: it takes the damage and falls prone.
    expect(readActorHitPoints(after, NEAR_WOLF_ID)).toBeLessThan(
      readActorHitPoints(before, NEAR_WOLF_ID)
    )
    expect(readActorConditionIds(after, NEAR_WOLF_ID)).toContain(PRONE_ID)
    // The far Wolf and the dragon itself are outside its area.
    for (const actorId of [FAR_WOLF_ID, DRAGON_ID]) {
      expect(readActorHitPoints(after, actorId)).toBe(readActorHitPoints(before, actorId))
      expect(readActorConditionIds(after, actorId)).not.toContain(PRONE_ID)
    }
    // The delegated root spends the option's 2 Legendary Actions.
    const dragonRow = after.actors.find(({ id }) => id === DRAGON_ID)
    expect(dragonRow && featureChargeUsed(readStoredRunActor(dragonRow), legendary.id)).toBe(2)

    // The turn end records the delegation; the root and the continuation commit after it, in order.
    const receiptOf = (commandId: string) => {
      const receipt = after.receipts.find((candidate) => candidate.commandId === commandId)
      if (!receipt) throw new Error(`The room holds no receipt for ${commandId}.`)
      return receipt
    }
    const turnEnd = parseReceiptExecution(receiptOf(advanceId))
    if (turnEnd.status !== 'INITIATIVE_COMPLETE')
      throw new Error(`Expected an initiative receipt, got ${turnEnd.status}.`)
    expect(turnEnd.legendaryActions).toMatchObject([
      { resolution: { kind: 'DELEGATED', selectedOptionId: wing!.optionId } }
    ])
    const root = receiptOf(systemTriggerCommandId(advanceId, DRAGON_ID, wing!.actionId))
    const continuation = receiptOf(delegatedLegendaryContinuationCommandId(advanceId))
    expect(root.commandType).toBe('RESOLVE_ACTION')
    expect(continuation.commandType).toBe('ADVANCE_TURN')
    expect(receiptOf(advanceId).encounterVersion).toBeLessThan(root.encounterVersion)
    expect(root.encounterVersion).toBeLessThan(continuation.encounterVersion)
    const state = readRunState(after.runs[0]!)
    expect(state.currentActorId).toBe(FAR_WOLF_ID)
    expect(state.delegatedLegendaryAction).toBeUndefined()
  }, 120000)

  it('resolves an aimed breath where its controller aims it (SPELLS-15)', async () => {
    const room = await wingRoom(breath)
    const before = await readRoomHistory(room.base.stub)
    const advanceId = crypto.randomUUID()
    const advanced = await room.send(advanceId, {
      scope: 'ENCOUNTER',
      command: {
        type: 'ADVANCE_TURN',
        encounterId: room.encounterId,
        commandId: advanceId,
        expectedVersion: before.runs[0]!.version
      }
    })
    expect(advanced.type, JSON.stringify(advanced)).toBe('COMMAND_COMMITTED')
    const choice = await readLegendaryChoice(room.base.stub)
    const [cone] = choice?.options ?? []
    expect(cone).toMatchObject({
      targetActorIds: [DRAGON_ID],
      delegated: true,
      area: { kind: 'DIRECTED', area: { kind: 'CONE', length: { amount: 30, unit: 'FEET' } } }
    })
    // From the east edge of the dragon's token, toward the near Wolf.
    const aim = { kind: 'DIRECTED', origin: { x: 200, y: 150 }, toward: { x: 500, y: 150 } }
    const unaimed = await respondToLegendaryChoice(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: cone!.optionId,
      targetActorId: DRAGON_ID
    })
    expect(unaimed.answer.type).not.toBe('COMMAND_COMMITTED')
    const { answer } = await respondToLegendaryChoice(room, {
      kind: 'LEGENDARY_OPTION',
      optionId: cone!.optionId,
      targetActorId: DRAGON_ID,
      aim
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.base.stub)
    // The near Wolf in the cone fails its DC 25 save; the far Wolf, 65 ft off, is beyond it.
    expect(readActorHitPoints(after, NEAR_WOLF_ID)).toBeLessThan(
      readActorHitPoints(before, NEAR_WOLF_ID)
    )
    expect(readActorConditionIds(after, NEAR_WOLF_ID)).toContain(PRONE_ID)
    expect(readActorHitPoints(after, FAR_WOLF_ID)).toBe(readActorHitPoints(before, FAR_WOLF_ID))
    const root = after.receipts.find(
      ({ commandId }) => commandId === systemTriggerCommandId(advanceId, DRAGON_ID, cone!.actionId)
    )
    expect(root?.commandType).toBe('RESOLVE_ACTION')
    const state = readRunState(after.runs[0]!)
    expect(state.currentActorId).toBe(FAR_WOLF_ID)
    expect(state.delegatedLegendaryAction).toBeUndefined()
  }, 120000)
})
