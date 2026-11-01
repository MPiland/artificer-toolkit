import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { concentrationCapacityItem } from '@artificer-toolkit/rules-runtime/testing/concentrationCapacityItem'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom, type ActionRoomConfig } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { dependentEffectDefinition } from './movementRoomFixture.js'
import { parseReceiptExecution, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-12.T1 through the room: a worn item's authored Concentration capacity lets the Fighter
 * keep two Concentrations at once, and a third asks which one ends before it takes effect.
 */

const FIGHTER_ACTOR_ID = testUuid(0xe00)
const FIGHTER_ID = testUuid(0xe01)
const WOLF_ID = testUuid(0xe02)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Feature that ward-grants +2 AC to one target for 1 minute while its user concentrates. */
function wardFeature(seed: number, label: string): ClassFeature {
  return {
    id: testUuid(seed),
    label,
    description: 'Wards a creature while you concentrate.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(seed + 1),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: testUuid(seed + 2), rangeKind: 'UNLIMITED' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: testUuid(seed + 3),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(seed + 4),
              resultKind: 'SINGLE',
              maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
              duration: { id: testUuid(seed + 5), durationKind: 'MINUTE', amount: 1 },
              outcomes: [
                {
                  id: testUuid(seed + 6),
                  effectKind: 'APPLY_GRANT',
                  grants: {
                    modifiers: [
                      {
                        id: testUuid(seed + 7),
                        grantKind: 'MODIFIER_GRANT',
                        valueDomainCode: 'ARMOR_CLASS',
                        domain: {},
                        modifierKind: 'BONUS',
                        scope: 'GLOBAL',
                        selectionKind: 'GRANTED',
                        payload: { valueKind: 'FIXED', amount: 2 },
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

/** A Feature that deals its user `amount` force damage: the damage a Concentration check answers. */
function backlashFeature(seed: number, label: string, amount: number): ClassFeature {
  return {
    id: testUuid(seed),
    label,
    description: 'Hurts you.',
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(seed + 1),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 },
          range: { id: testUuid(seed + 2), rangeKind: 'SELF' },
          targeting: { selectionKind: 'SELF' }
        },
        paths: [
          {
            id: testUuid(seed + 3),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(seed + 4),
              resultKind: 'SINGLE',
              outcomes: [
                {
                  id: testUuid(seed + 5),
                  effectKind: 'DAMAGE',
                  damageTypeId: srdSystemRecord.damageTypes!.find(({ code }) => code === 'FORCE')!
                    .id,
                  valueKind: 'FIXED',
                  scalingKind: 'NONE',
                  amount
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

const firstWard = wardFeature(0xe100, 'First Ward')
const secondWard = wardFeature(0xe200, 'Second Ward')
const thirdWard = wardFeature(0xe300, 'Third Ward')
const minorBacklash = backlashFeature(0xe400, 'Minor Backlash', 5)
const fatalBacklash = backlashFeature(0xe500, 'Fatal Backlash', 500)

const capacityItem = concentrationCapacityItem({ number: 920, label: 'Capacity Item', bonus: 1 })

function wardRoom(
  equipment: readonly EquipmentAuthored[],
  seed?: ActionRoomConfig['seed'],
  rolls?: ActionRoomConfig['rolls']
) {
  return actionRoom({
    seed,
    rolls,
    autoRoll: 'BOTH',
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterClassFeatures: [firstWard, secondWard, thirdWard, minorBacklash, fatalBacklash],
    characterEquipment: equipment,
    characterAction: (action) => action.label.includes('First Ward')
  })
}

type WardRoom = Awaited<ReturnType<typeof wardRoom>>

/** Casts the ward whose label contains `label` on the Wolf, soft-overriding the turn's one Action. */
async function cast(
  room: WardRoom,
  label: string,
  endedMaintainedStateId?: string,
  targetActorId = WOLF_ID
) {
  const actionId = (await room.actionChoices()).actions.find((action) =>
    action.label.includes(label)
  )?.id
  if (!actionId) throw new Error(`The Fighter offers no ${label}.`)
  return room.startAction(
    targetActorId,
    ['ACTION_ECONOMY_UNAVAILABLE'],
    null,
    null,
    actionId,
    undefined,
    undefined,
    undefined,
    undefined,
    endedMaintainedStateId
  )
}

/** The Concentration checks the Run settled, in the order they ran. */
const concentrationChecks = (history: RoomHistory) =>
  history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK' &&
      execution.applicationOutputs.source === 'CONCENTRATION'
      ? [execution.applicationOutputs]
      : []
  })

const heldStateIds = async (room: WardRoom) =>
  (await readRoomHistory(room.room.base.stub)).maintainedStates.map((state) => state.id)

describe('Concentration capacity (SPELLS-12.T1)', () => {
  it('replaces the one Concentration a Character without capacity items holds', async () => {
    const room = await wardRoom([])
    expect((await cast(room, 'First Ward')).answer.type).toBe('COMMAND_COMMITTED')
    const [first] = await heldStateIds(room)
    expect((await cast(room, 'Second Ward')).answer.type).toBe('COMMAND_COMMITTED')
    const held = await heldStateIds(room)
    expect(held).toHaveLength(1)
    expect(held).not.toContain(first)
  })

  it('keeps two Concentrations at capacity two and asks which ends for a third', async () => {
    const room = await wardRoom([capacityItem])
    expect((await cast(room, 'First Ward')).answer.type).toBe('COMMAND_COMMITTED')
    expect((await cast(room, 'Second Ward')).answer.type).toBe('COMMAND_COMMITTED')
    const [first, second] = await heldStateIds(room)
    expect(await heldStateIds(room)).toHaveLength(2)

    const refused = await cast(room, 'Third Ward')
    expect(refused.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'MAINTAINED_REPLACEMENT_REQUIRED',
      heldStates: [{ id: first }, { id: second }]
    })
    expect(await heldStateIds(room)).toEqual([first, second])

    const chosen = await cast(room, 'Third Ward', second)
    expect(chosen.answer.type, JSON.stringify(chosen.answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(room.room.base.stub)
    const held = after.maintainedStates.map((state) => state.id)
    expect(held).toHaveLength(2)
    expect(held).toContain(first)
    expect(held).not.toContain(second)
    // The ended Concentration's grant ends with it; the kept one's grant stays.
    const dependents = after.activeEffects.map((effect) => effect.maintainedEffectStateId)
    expect(dependents).not.toContain(second)
    expect(dependents).toContain(first)
  })

  it('asks again when the chosen Concentration is no longer held', async () => {
    const room = await wardRoom([capacityItem])
    expect((await cast(room, 'First Ward')).answer.type).toBe('COMMAND_COMMITTED')
    expect((await cast(room, 'Second Ward')).answer.type).toBe('COMMAND_COMMITTED')
    const refused = await cast(room, 'Third Ward', testUuid(0xe999))
    expect(refused.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'MAINTAINED_REPLACEMENT_REQUIRED'
    })
    expect(await heldStateIds(room)).toHaveLength(2)
  })

  it('keeps a carried grant of the caster while room remains beside it and ends it once none does', async () => {
    const carriedId = testUuid(0xe700)
    const room = await wardRoom([capacityItem], async ({ effects, encounterId, occurredAt }) => {
      await effects.create({
        id: carriedId,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: FIGHTER_ACTOR_ID },
        lifecycle: {
          schemaVersion: 1,
          remainingTicks: 3,
          concentrationCasterCharacterId: FIGHTER_ID
        },
        definition: dependentEffectDefinition({ encounterId, sourceActorId: FIGHTER_ACTOR_ID }),
        occurredAt
      })
    })
    const carried = async () =>
      (await readRoomHistory(room.room.base.stub)).characterEffects.map(({ id }) => id)
    const first = await cast(room, 'First Ward')
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    expect(await carried()).toContain(carriedId)
    const second = await cast(room, 'Second Ward')
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')
    expect(await carried()).not.toContain(carriedId)
  })
})

describe('Concentration saves per spell (SPELLS-12.T3a)', () => {
  it('rolls one save per held Concentration in casting order and ends only the one it fails', async () => {
    // The first save shows 1 and fails; the second shows 20 and holds.
    const room = await wardRoom([capacityItem], undefined, [0, 19])
    expect((await cast(room, 'First Ward')).answer.type).toBe('COMMAND_COMMITTED')
    expect((await cast(room, 'Second Ward')).answer.type).toBe('COMMAND_COMMITTED')
    const [first, second] = await heldStateIds(room)

    const hurt = await cast(room, 'Minor Backlash', undefined, FIGHTER_ACTOR_ID)
    expect(hurt.answer.type, JSON.stringify(hurt.answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(
      concentrationChecks(after).map(({ application, outcome }) => ({
        stateId: 'maintainedStateId' in application ? application.maintainedStateId : null,
        outcome
      }))
    ).toEqual([
      { stateId: first, outcome: 'SAVE_FAILURE' },
      { stateId: second, outcome: 'SAVE_SUCCESS' }
    ])
    expect(after.maintainedStates.map((state) => state.id)).toEqual([second])
    // The lost Concentration's grant ends with it; the kept one's grant stays.
    const dependents = after.activeEffects.map((effect) => effect.maintainedEffectStateId)
    expect(dependents).not.toContain(first)
    expect(dependents).toContain(second)
  })

  it('ends every held Concentration at once, with no save, when the holder is defeated (D95)', async () => {
    const room = await wardRoom([capacityItem])
    expect((await cast(room, 'First Ward')).answer.type).toBe('COMMAND_COMMITTED')
    expect((await cast(room, 'Second Ward')).answer.type).toBe('COMMAND_COMMITTED')
    expect(await heldStateIds(room)).toHaveLength(2)

    const slain = await cast(room, 'Fatal Backlash', undefined, FIGHTER_ACTOR_ID)
    expect(slain.answer.type, JSON.stringify(slain.answer)).toBe('COMMAND_COMMITTED')

    const after = await readRoomHistory(room.room.base.stub)
    expect(after.maintainedStates).toEqual([])
    expect(concentrationChecks(after)).toEqual([])
    expect(after.activeEffects.map((effect) => effect.maintainedEffectStateId)).toEqual([])
  })
})
