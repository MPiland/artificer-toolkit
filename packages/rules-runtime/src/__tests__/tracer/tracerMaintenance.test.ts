import { describe, expect, it } from 'vitest'

import { concentrationSaveApplications } from '../../encounterConcentration.js'
import { encounterConcentrationEndReason } from '../../encounterConcentrationEnd.js'
import { maintenanceLinkCapabilityRegistry } from '../../platformPolicyModules.js'
import { tracerCreatureActor, tracerDefinitions } from './encounter.js'
import { TRACER_SYSTEM_ID } from './system.js'

const HOLDER_ID = '00000000-0000-4000-8000-0000000fa201'
const BYSTANDER_ID = '00000000-0000-4000-8000-0000000fa202'
const SIDE_ID = '00000000-0000-4000-8000-0000000fc201'
const STUNT_STATE_ID = '00000000-0000-4000-8000-0000000fd201'

const ratings = { CAREFUL: 2, CLEVER: 1, FLASHY: 0, FORCEFUL: 1, QUICK: 1, SNEAKY: 0 }

function endReason(defeated: boolean) {
  return encounterConcentrationEndReason({
    actor: { ...tracerCreatureActor({ id: HOLDER_ID, sideId: SIDE_ID, ratings }), defeated },
    deadCharacterIds: new Set(),
    conditionIds: [],
    activeEffects: [],
    gameSystemId: TRACER_SYSTEM_ID,
    definitions: tracerDefinitions
  })
}

function stress(targetActorId: string, ordinal: number) {
  return {
    ordinal,
    sourceNodeId: 'stress',
    sourceOperationKey: 'damage.apply',
    targetActorId,
    appliedAmount: 2,
    damageTypeId: null
  }
}

describe('the tracer maintenance link on the neutral event table (RULES-2.T12b)', () => {
  it('breaks a held stunt when its holder is taken out, for the tracer reason', async () => {
    expect(await endReason(true)).toBe('DEFEATED')
  })

  it('keeps a held stunt while its holder can still act', async () => {
    expect(await endReason(false)).toBeNull()
  })

  it('owes a defence only for stress taken by a holder of a stunt', () => {
    const owed = concentrationSaveApplications({
      gameSystemId: TRACER_SYSTEM_ID,
      applications: [stress(HOLDER_ID, 0), stress(BYSTANDER_ID, 1)],
      maintainedStateIds: new Map([[HOLDER_ID, STUNT_STATE_ID]]),
      damagerActorId: null,
      dispositions: new Map()
    })
    expect(owed).toEqual([{ ...stress(HOLDER_ID, 0), maintainedStateId: STUNT_STATE_ID }])
    expect(maintenanceLinkCapabilityRegistry.require(TRACER_SYSTEM_ID).saveDc(2)).toBe(12)
  })
})
