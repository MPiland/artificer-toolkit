import { describe, expect, it } from 'vitest'

import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import type { EncounterEvent, EncounterRaiseActionHook } from '../events/encounterEventTable.js'
import { eventVocabularyCapabilityRegistry } from '../platformPolicyModules.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

/**
 * QUALITY-11.T1b: the actions the rules raise are event-table subscriptions. A System binds its
 * passive trigger codes to the neutral events, and one discovery entry answers which actions an
 * event raises for its holder.
 */

const DEFINITION = { id: 'rule-definition', version: 3, checksum: 'a'.repeat(64) }

const raised = (actionId: string, subscription: EncounterRaiseActionHook['subscription']) => ({
  actionId,
  hook: { hook: 'RAISE_ACTION' as const, subscription }
})

const raisedActions = [
  raised('on-defeat', { event: 'DEFEATED' }),
  raised('on-turn-start', { event: 'TURN_STARTED' }),
  raised('on-failed-save', { event: 'SAVE_FAILED', definition: DEFINITION }),
  raised('second-on-defeat', { event: 'DEFEATED' })
]

const raisedBy = (...events: EncounterEvent[]) =>
  discoverEncounterEventHooks({ raisedActions, events }).raisedActions.map(
    ({ actionId }) => actionId
  )

describe('raise-action hooks on the event table (QUALITY-11.T1b)', () => {
  it('binds the 5e passive trigger codes to the neutral events, and no other code', () => {
    const adapter = eventVocabularyCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect(adapter.raiseActionHook('HP_ZERO')).toEqual({
      hook: 'RAISE_ACTION',
      subscription: { event: 'DEFEATED' }
    })
    expect(adapter.raiseActionHook('START_OF_TURN')).toEqual({
      hook: 'RAISE_ACTION',
      subscription: { event: 'TURN_STARTED' }
    })
    for (const code of ['SAVING_THROW', 'INCOMING_DAMAGE', 'ACTIVATED', 'toString'])
      expect(adapter.raiseActionHook(code)).toBeNull()
  })

  it('raises each action on its own event, in the order given', () => {
    expect(raisedBy({ kind: 'DEFEATED' })).toEqual(['on-defeat', 'second-on-defeat'])
    expect(raisedBy({ kind: 'TURN_STARTED' })).toEqual(['on-turn-start'])
    expect(raisedBy({ kind: 'TURN_STARTED' }, { kind: 'DEFEATED' })).toEqual([
      'on-defeat',
      'on-turn-start',
      'second-on-defeat'
    ])
    expect(raisedBy({ kind: 'MAINTENANCE_BARRED' })).toEqual([])
    expect(raisedBy()).toEqual([])
  })

  it('raises a failed-save action only for the save of the exact pinned definition', () => {
    expect(raisedBy({ kind: 'SAVE_FAILED', definition: { ...DEFINITION } })).toEqual([
      'on-failed-save'
    ])
    for (const definition of [
      { ...DEFINITION, id: 'other-definition' },
      { ...DEFINITION, version: DEFINITION.version + 1 },
      { ...DEFINITION, checksum: 'b'.repeat(64) }
    ])
      expect(raisedBy({ kind: 'SAVE_FAILED', definition })).toEqual([])
  })

  it('raises nothing when no raised action is given', () => {
    expect(discoverEncounterEventHooks({ events: [{ kind: 'DEFEATED' }] }).raisedActions).toEqual(
      []
    )
  })
})
