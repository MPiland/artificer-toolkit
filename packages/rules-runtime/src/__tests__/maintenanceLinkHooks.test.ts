import { describe, expect, it } from 'vitest'
import { planDamageSaveChain } from '../encounterDamageSaveChain.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import type { EncounterEvent } from '../events/encounterEventTable.js'
import { maintenanceLinkCapabilityRegistry } from '../platformPolicyModules.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const { hooks } = maintenanceLinkCapabilityRegistry.require(DND5E_SYSTEM_ID)
const discover = (events: EncounterEvent[]) =>
  discoverEncounterEventHooks({ maintenanceHooks: hooks, events })

const CAST_AT = '2026-01-01T00:00:00.000Z'

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
      holderActorId: 'holder',
      hits: [{ damagerActorId: null, damageTypeIds: [null] }],
      dispositions: new Map()
    }
    // The boolean `maintenanceSave` became the indexes of the hits owed a save: hit 0 is owed one.
    expect(discover([damaged]).maintenanceSaveHits).toEqual([0])
    expect(discover([{ kind: 'DEFEATED' }]).maintenanceSaveHits).toEqual([])
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
      planDamageSaveChain({
        gameSystemId: DND5E_SYSTEM_ID,
        applications: [application('held'), application('bare')],
        maintainedStates: new Map([['held', [{ id: 'state-1', createdAt: CAST_AT }]]]),
        parentOccurrenceId: 'parent',
        damagerActorId: null,
        dispositions: new Map(),
        effectSaves: null
      })
    ).toEqual([{ ...application('held'), maintainedStateId: 'state-1', castAt: CAST_AT }])
  })

  it('owes a holder one save per held link, each carrying when its link began', () => {
    const damage = {
      ordinal: 0,
      sourceNodeId: 'n',
      sourceOperationKey: 'k',
      targetActorId: 'held',
      appliedAmount: 7,
      damageTypeId: null
    }
    const later = '2026-01-01T00:00:05.000Z'
    expect(
      planDamageSaveChain({
        gameSystemId: DND5E_SYSTEM_ID,
        applications: [damage],
        maintainedStates: new Map([
          [
            'held',
            [
              { id: 'state-1', createdAt: CAST_AT },
              { id: 'state-2', createdAt: later }
            ]
          ]
        ]),
        parentOccurrenceId: 'parent',
        damagerActorId: null,
        dispositions: new Map(),
        effectSaves: null
      })
    ).toEqual([
      { ...damage, maintainedStateId: 'state-1', castAt: CAST_AT },
      { ...damage, maintainedStateId: 'state-2', castAt: later }
    ])
  })
})
