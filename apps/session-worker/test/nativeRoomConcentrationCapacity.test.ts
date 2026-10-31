import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import {
  equipId,
  magicArmorModifiers
} from '@artificer-toolkit/source-data/srd/equipment/shared.js'
import { signetRing } from '@artificer-toolkit/source-data/srd/equipment/signet-ring.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

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

const firstWard = wardFeature(0xe100, 'First Ward')
const secondWard = wardFeature(0xe200, 'Second Ward')
const thirdWard = wardFeature(0xe300, 'Third Ward')

/** A worn item whose authored modifier adds one to how many Concentrations its holder keeps. */
const capacityItem: EquipmentAuthored = {
  ...signetRing,
  id: equipId(920),
  label: 'Capacity Item',
  modifiers: magicArmorModifiers(equipId(920), 1).map((modifier) => ({
    ...modifier,
    valueDomainCode: 'CONCENTRATION_CAPACITY' as const,
    domain: {}
  }))
}

function wardRoom(equipment: readonly EquipmentAuthored[]) {
  return actionRoom({
    autoRoll: 'BOTH',
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterClassFeatures: [firstWard, secondWard, thirdWard],
    characterEquipment: equipment,
    characterAction: (action) => action.label.includes('First Ward')
  })
}

type WardRoom = Awaited<ReturnType<typeof wardRoom>>

/** Casts the ward whose label contains `label` on the Wolf, soft-overriding the turn's one Action. */
async function cast(room: WardRoom, label: string, endedMaintainedStateId?: string) {
  const actionId = (await room.actionChoices()).actions.find((action) =>
    action.label.includes(label)
  )?.id
  if (!actionId) throw new Error(`The Fighter offers no ${label}.`)
  return room.startAction(
    WOLF_ID,
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
})
