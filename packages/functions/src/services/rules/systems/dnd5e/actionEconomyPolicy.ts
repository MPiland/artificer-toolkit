import type { ActionEconomyCapabilityAdapter } from '../../actionEconomyCapabilityRegistry.js'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from './reactionEligibilityPolicy.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

export const DND5E_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d7'
export const DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d8'

/** D&D owns the authored activation-to-capability mapping. */
export const dnd5eActionEconomyCapabilityAdapter: ActionEconomyCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  resolveActionEconomyCapability({ activationKind, activationAmount }) {
    if (activationAmount !== 1) return { kind: 'NONE' }
    if (activationKind === 'ACTION') {
      return { kind: 'REQUIRED', capabilityDefinitionId: DND5E_ACTION_ALLOWANCE_DEFINITION_ID }
    }
    if (activationKind === 'BONUS_ACTION') {
      return {
        kind: 'REQUIRED',
        capabilityDefinitionId: DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
      }
    }
    return { kind: 'NONE' }
  },
  refreshCapabilityDefinitionIds() {
    return [
      DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
      DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
      DND5E_REACTION_ALLOWANCE_DEFINITION_ID
    ]
  }
}
