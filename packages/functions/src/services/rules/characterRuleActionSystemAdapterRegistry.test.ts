import { describe, expect, it } from 'vitest'

import { createCharacterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { dnd5eCharacterRuleActionSystemAdapter } from './systems/dnd5e/effectActionCompiler.js'

const DND5E_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'

describe('Character rule-action System adapter registry', () => {
  it('resolves canonical PostgreSQL UUID identities case-insensitively', () => {
    const registry = createCharacterRuleActionSystemAdapterRegistry([
      dnd5eCharacterRuleActionSystemAdapter
    ])

    expect(registry.get(DND5E_SYSTEM_ID.toUpperCase())).toBe(dnd5eCharacterRuleActionSystemAdapter)
  })

  it('rejects duplicate adapters after PostgreSQL UUID normalization', () => {
    expect(() =>
      createCharacterRuleActionSystemAdapterRegistry([
        dnd5eCharacterRuleActionSystemAdapter,
        {
          ...dnd5eCharacterRuleActionSystemAdapter,
          gameSystemId: DND5E_SYSTEM_ID.toUpperCase()
        }
      ])
    ).toThrow('Duplicate Character rule-action System adapter')
  })

  it('does not dispatch arbitrary system names or editions', () => {
    const registry = createCharacterRuleActionSystemAdapterRegistry([
      dnd5eCharacterRuleActionSystemAdapter
    ])

    expect(() => registry.get('dnd5e-2014')).toThrow('PostgreSQL UUID')
  })
})
