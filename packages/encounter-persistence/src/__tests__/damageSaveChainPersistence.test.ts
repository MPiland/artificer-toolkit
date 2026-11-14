import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  ENCOUNTER_ID,
  srdCreatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { describe, expect, it, vi } from 'vitest'

import { bindEncounterDamageSaveChain } from '../effectRepeatSavePersistence.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'

/**
 * QUALITY-14.T2: persistence re-derives a command's damage-save chain through the same planner the
 * room planned from, so a held Concentration the System's maintenance hook does not owe a save for is
 * not bound. Persistence once bound every held state with no hook, so it disagreed with the room.
 */

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const COLD = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'COLD')!.id
const HOLDER_ID = '00000000-0000-4000-8000-0000000c1001'
const STATE_ID = '00000000-0000-4000-8000-0000000c1002'
const CAST_AT = '2026-01-01T00:00:00.000Z'

const findMaintainedStates = vi.hoisted(() => vi.fn())

vi.mock('../effectStore.js', () => ({
  createActiveRuleEffectStore: () => ({ findMaintainedStates, list: async () => [] })
}))
vi.mock('../characterStates.js', () => ({ readDeadCharacterIds: async () => new Set<string>() }))
// A System whose maintenance hook owes a Concentration save for fire damage only.
vi.mock('@artificer-toolkit/rules-runtime/platformPolicyModules', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@artificer-toolkit/rules-runtime/platformPolicyModules')>()
  return {
    ...original,
    maintenanceLinkCapabilityRegistry: {
      require: (gameSystemId: string) => ({
        ...original.maintenanceLinkCapabilityRegistry.require(gameSystemId),
        hooks: [
          {
            hook: 'SAVE',
            subscription: { event: 'DAMAGED', by: 'ANYONE', damageTypeIds: [FIRE] }
          }
        ]
      })
    }
  }
})

const application = (damageTypeId: string, ordinal: number) => ({
  ordinal,
  sourceNodeId: 'damage',
  sourceOperationKey: 'damage',
  targetActorId: HOLDER_ID,
  appliedAmount: 5,
  damageTypeId
})

describe('the persisted damage-save chain follows the maintenance hook (QUALITY-14.T2)', () => {
  const holder = srdCreatureActor({ id: HOLDER_ID, creature: knight })
  const state = srdEncounterState({ actors: [holder], currentActorId: HOLDER_ID })
  const bind = (applications: ReturnType<typeof application>[]) =>
    bindEncounterDamageSaveChain({} as EncounterCharacterWriteTransaction, {
      state: { ...state, id: ENCOUNTER_ID },
      actors: [holder],
      applications,
      parentOccurrenceId: 'parent',
      damagerActorId: null
    })

  it('binds no check to damage the hook does not owe a save for, and one to damage it does', async () => {
    findMaintainedStates.mockResolvedValue([{ id: STATE_ID, createdAt: CAST_AT }])
    expect(await bind([application(COLD, 0)])).toEqual([])
    expect(await bind([application(COLD, 0), application(FIRE, 1)])).toEqual([
      { ...application(FIRE, 1), maintainedStateId: STATE_ID, castAt: CAST_AT }
    ])
  })
})
