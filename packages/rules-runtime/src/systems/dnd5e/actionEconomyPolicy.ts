import type { ActionEconomyCapabilityAdapter } from '../../actionEconomyCapabilityRegistry.js'
import { dnd5eAttackKind } from './attackKind.js'
import {
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_SYSTEM_ID
} from './identity.js'
import { DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID } from './reactionEligibilityPolicy.js'

const spendsDnd5eAttackAction: ActionEconomyCapabilityAdapter['spendsAttackAction'] = ({
  activationKind,
  activationAmount
}) => activationKind === 'ACTION' && activationAmount === 1

/** D&D owns the authored activation-to-capability mapping. */
export const dnd5eActionEconomyCapabilityAdapter: ActionEconomyCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  resolveActionEconomyCapability({ activationKind, activationAmount }) {
    if (activationAmount !== 1) return { kind: 'NONE' }
    if (activationKind === 'ACTION') {
      return {
        kind: 'REQUIRED',
        capabilityDefinitionId: DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
        grantedCountDomain: 'ACTION_COUNT',
        exclusiveWithCapabilityDefinitionId: DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
      }
    }
    if (activationKind === 'BONUS_ACTION') {
      return {
        kind: 'REQUIRED',
        capabilityDefinitionId: DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
        exclusiveWithCapabilityDefinitionId: DND5E_ACTION_ALLOWANCE_DEFINITION_ID
      }
    }
    if (activationKind === 'REACTION') {
      return { kind: 'REQUIRED', capabilityDefinitionId: DND5E_REACTION_ALLOWANCE_DEFINITION_ID }
    }
    return { kind: 'NONE' }
  },
  /**
   * Weapon and unarmed attacks made with the Action are the Attack action, and so is an action that
   * takes the place of one of its attacks; spell attacks are not.
   */
  spendsAttackAction: spendsDnd5eAttackAction,
  isAttackActionAttack({ activationKind, activationAmount, triggerCode, replacesAttack }) {
    const attackKind = dnd5eAttackKind(triggerCode)
    return (
      spendsDnd5eAttackAction({ activationKind, activationAmount }) &&
      (replacesAttack ||
        attackKind === 'MELEE' ||
        attackKind === 'RANGED' ||
        attackKind === 'UNARMED')
    )
  },
  allowanceDefinitionIdByCountDomain: {
    ACTION_COUNT: DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
    BONUS_ACTION_COUNT: DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
    REACTION_COUNT: DND5E_REACTION_ALLOWANCE_DEFINITION_ID
  },
  actorActionCapabilityDefinitionId() {
    return DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID
  },
  refreshCapabilityDefinitionIds() {
    return [
      DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
      DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
      DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
    ]
  }
}
