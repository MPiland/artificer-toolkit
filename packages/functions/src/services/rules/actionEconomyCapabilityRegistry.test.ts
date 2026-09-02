import { describe, expect, it } from 'vitest'

import { createActionEconomyCapabilityRegistry } from './actionEconomyCapabilityRegistry.js'
import {
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  dnd5eActionEconomyCapabilityAdapter
} from './systems/dnd5e/actionEconomyPolicy.js'

const DND5E_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'

describe('action-economy capability registry', () => {
  it('maps only exact D&D ACTION and BONUS_ACTION activations to pinned capability IDs', () => {
    const registry = createActionEconomyCapabilityRegistry([dnd5eActionEconomyCapabilityAdapter])

    expect(
      registry.resolveActionEconomyCapability({
        gameSystemId: DND5E_SYSTEM_ID,
        activationKind: 'ACTION',
        activationAmount: 1
      })
    ).toEqual({ kind: 'REQUIRED', capabilityDefinitionId: DND5E_ACTION_ALLOWANCE_DEFINITION_ID })
    expect(
      registry.resolveActionEconomyCapability({
        gameSystemId: DND5E_SYSTEM_ID,
        activationKind: 'BONUS_ACTION',
        activationAmount: 1
      })
    ).toEqual({
      kind: 'REQUIRED',
      capabilityDefinitionId: DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
    })
    expect(
      registry.resolveActionEconomyCapability({
        gameSystemId: DND5E_SYSTEM_ID,
        activationKind: 'REACTION',
        activationAmount: 1
      })
    ).toEqual({ kind: 'NONE' })
  })

  it('does not invent economy semantics for a System without an adapter', () => {
    const registry = createActionEconomyCapabilityRegistry([])

    expect(() =>
      registry.resolveActionEconomyCapability({
        gameSystemId: DND5E_SYSTEM_ID,
        activationKind: 'ACTION',
        activationAmount: 1
      })
    ).toThrow('does not provide action-economy policy')
  })
})
