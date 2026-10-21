import { describe, expect, it } from 'vitest'

import {
  abilityScoreCapabilityRegistry,
  actionEconomyCapabilityRegistry,
  creatureConditionCapabilityRegistry
} from '../platformPolicyModules.js'
import { initiativeCapabilityRegistry } from '../platformEncounterPolicy.js'
import { createSystemCapabilityRegistry } from '../systemCapabilityRegistry.js'
import {
  DND5E_ABILITY_DEFINITION_ID_BY_CODE,
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_EXHAUSTION_CONDITION_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_SYSTEM_ID,
  DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID
} from '../systems/dnd5e/identity.js'
import { dnd5eInitiativeFactAdapter } from '../systems/dnd5e/initiativeFactAdapter.js'

const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'
const adapter = { gameSystemId: DND5E_SYSTEM_ID, value: 1 }

describe('System capability registry', () => {
  it('resolves the installed adapter by UUID-canonical gameSystemId', () => {
    const registry = createSystemCapabilityRegistry('sample', [adapter])
    expect(registry.require(DND5E_SYSTEM_ID)).toBe(adapter)
    expect(registry.require(DND5E_SYSTEM_ID.toUpperCase())).toBe(adapter)
  })

  it('fails closed on a System that does not provide the capability', () => {
    const registry = createSystemCapabilityRegistry('sample', [adapter])
    expect(() => registry.require(UNKNOWN_SYSTEM_ID)).toThrow(
      'The Game System does not provide sample policy.'
    )
  })

  it('finds an optional capability and returns nothing for a System that does not provide it', () => {
    const registry = createSystemCapabilityRegistry('sample', [adapter])
    expect(registry.find(DND5E_SYSTEM_ID.toUpperCase())).toBe(adapter)
    expect(registry.find(UNKNOWN_SYSTEM_ID)).toBeUndefined()
    expect(() => registry.find('dnd5e')).toThrow(
      'Sample System identity must be a PostgreSQL UUID.'
    )
  })

  it('refuses a duplicate System adapter', () => {
    expect(() => createSystemCapabilityRegistry('sample', [adapter, { ...adapter }])).toThrow(
      `Duplicate sample System adapter: ${DND5E_SYSTEM_ID}.`
    )
  })

  it('refuses a System identity that is not a UUID', () => {
    expect(() =>
      createSystemCapabilityRegistry('sample', [{ ...adapter, gameSystemId: 'dnd5e' }])
    ).toThrow('Sample System identity must be a PostgreSQL UUID.')
    expect(() => createSystemCapabilityRegistry('sample', [adapter]).require('dnd5e')).toThrow(
      'Sample System identity must be a PostgreSQL UUID.'
    )
  })
})

describe('installed D&D capability adapters', () => {
  it('action economy refreshes the three allowances, distinct and sorted', () => {
    expect(
      actionEconomyCapabilityRegistry.require(DND5E_SYSTEM_ID).refreshCapabilityDefinitionIds()
    ).toEqual(
      [
        DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
      ].sort()
    )
  })

  it('ability scores give the 5e modifier and keep the mental abilities in a Creature form', () => {
    const abilities = abilityScoreCapabilityRegistry.require(DND5E_SYSTEM_ID)
    expect([1, 8, 9, 10, 11, 15, 20, 30].map(abilities.abilityModifier)).toEqual([
      -5, -1, -1, 0, 0, 2, 5, 10
    ])
    expect(abilities.formRetainedAbilityIds).toEqual({
      INTELLIGENCE: DND5E_ABILITY_DEFINITION_ID_BY_CODE.INTELLIGENCE,
      WISDOM: DND5E_ABILITY_DEFINITION_ID_BY_CODE.WISDOM,
      CHARISMA: DND5E_ABILITY_DEFINITION_ID_BY_CODE.CHARISMA
    })
  })

  it('creature conditions are Unconscious at 0 hit points and Exhaustion for exhaustion levels', () => {
    expect(creatureConditionCapabilityRegistry.require(DND5E_SYSTEM_ID)).toMatchObject({
      zeroHitPointsConditionDefinitionId: DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID,
      exhaustionConditionDefinitionId: DND5E_EXHAUSTION_CONDITION_DEFINITION_ID
    })
  })

  it('initiative resolves the D&D initiative fact adapter', () => {
    expect(initiativeCapabilityRegistry.require(DND5E_SYSTEM_ID)).toBe(dnd5eInitiativeFactAdapter)
  })
})
