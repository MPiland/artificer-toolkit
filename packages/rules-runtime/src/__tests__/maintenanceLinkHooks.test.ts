import { describe, expect, it } from 'vitest'
import { concentrationSaveApplications } from '../encounterConcentration.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import type { EncounterEvent } from '../events/encounterEventTable.js'
import { maintenanceLinkCapabilityRegistry } from '../platformPolicyModules.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const { hooks } = maintenanceLinkCapabilityRegistry.require(DND5E_SYSTEM_ID)
const discover = (events: EncounterEvent[]) =>
  discoverEncounterEventHooks({ maintenanceHooks: hooks, events })

describe('maintenance link hooks', () => {
  it('breaks with the first break hook an event meets, defeat before incapacity', () => {
    expect(discover([{ kind: 'DEFEATED' }]).maintenanceBreakReason).toBe('DEFEATED')
    expect(
      discover([{ kind: 'INCAPACITATED', of: 'HOLDER' }, { kind: 'DEFEATED' }])
        .maintenanceBreakReason
    ).toBe('DEFEATED')
    expect(discover([{ kind: 'INCAPACITATED', of: 'HOLDER' }]).maintenanceBreakReason).toBe(
      'INCAPACITATED'
    )
    expect(discover([{ kind: 'MAINTENANCE_BARRED' }]).maintenanceBreakReason).toBe(
      'SPELLCASTING_LOCKED'
    )
    expect(discover([{ kind: 'HIT' }]).maintenanceBreakReason).toBeNull()
  })

  it('owes a save to damage of any type and side, and to nothing else', () => {
    const damaged: EncounterEvent = {
      kind: 'DAMAGED',
      phase: 'AFTER',
      damagerActorId: null,
      damageTypeIds: [null],
      dispositions: new Map()
    }
    expect(discover([damaged]).maintenanceSave).toBe(true)
    expect(discover([{ kind: 'DEFEATED' }]).maintenanceSave).toBe(false)
  })

  it('fails closed on a System that provides no maintenance link', () => {
    expect(() =>
      maintenanceLinkCapabilityRegistry.require('00000000-0000-0000-0000-0000000000ff')
    ).toThrow('does not provide maintenance-link policy')
  })

  it('binds a save only to damage on a holder that holds a link', () => {
    const application = (targetActorId: string) => ({
      ordinal: 0,
      sourceNodeId: 'n',
      sourceOperationKey: 'k',
      targetActorId,
      appliedAmount: 7,
      damageTypeId: null
    })
    expect(
      concentrationSaveApplications({
        gameSystemId: DND5E_SYSTEM_ID,
        applications: [application('held'), application('bare')],
        maintainedStateIds: new Map([['held', 'state-1']]),
        damagerActorId: null,
        dispositions: new Map()
      })
    ).toEqual([{ ...application('held'), maintainedStateId: 'state-1' }])
  })
})
