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
  /**
   * After a spell cast with a bonus action, only a cantrip cast with an action may follow; a bonus
   * action spell may not follow a spell other than a cantrip cast with an action. Reaction spells and
   * longer casting times are outside the limit.
   */
  spellCastingLimit({ activationKind, activationAmount, cantrip, held }) {
    if (activationAmount !== 1) return { refusal: null, marks: null }
    if (activationKind === 'BONUS_ACTION')
      return held.actionSpell || held.bonusActionSpell
        ? {
            refusal:
              'A bonus action spell can’t follow another spell cast this turn, except a cantrip cast with an action.',
            marks: 'bonusActionSpell'
          }
        : { refusal: null, marks: 'bonusActionSpell' }
    if (activationKind === 'ACTION')
      return held.bonusActionSpell && !cantrip
        ? {
            refusal: 'After a bonus action spell, only a cantrip cast with an action may be cast.',
            marks: 'actionSpell'
          }
        : { refusal: null, marks: cantrip ? null : 'actionSpell' }
    return { refusal: null, marks: null }
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
