import { coreRuleOperations, type RuleOperationContract } from '@artificer-toolkit/shared/rules'

import {
  createRulesRuntimeService,
  type PublishedRuleDefinitionSource,
  type RulesRuntimeService
} from '../../rulesRuntimeService.js'
import {
  dnd5eAttackTestOperation,
  dnd5eConditionApplyProposalOperation,
  dnd5eDamageProposalOperation,
  dnd5eHitPointMaximumReductionProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eSaveDamageTotalOperation,
  dnd5eEffectActionCapability,
  dnd5eHealProposalOperation,
  dnd5eHealTotalOperation,
  dnd5eSaveTestOperation,
  dnd5eTemporaryHitPointsProposalOperation,
  dnd5eTestConditionProposalOperation,
  dnd5eTestDamageProposalOperation,
  dnd5eTestHealProposalOperation,
  dnd5eTestTemporaryHitPointsProposalOperation
} from './effectActionCompiler.js'
import { dnd5eConcentrationDamageDcOperation } from './concentrationPolicy.js'
import { dnd5eLegendaryActionEligibilityOperation } from './encounterLifecyclePolicy.js'
import { dnd5eMovementReactionEligibilityOperation } from './reactionEligibilityPolicy.js'
import { DND5E_FLANKING_POLICY_MODULE } from './flankingPolicy.js'
import { DND5E_FACING_POLICY_MODULE } from './facingPolicy.js'
import { DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY } from './optionalCombatPolicy.js'
import { DND5E_DISARM_POLICY_MODULE } from './optionalActionPolicy.js'
import {
  DND5E_OVERRUN_POLICY_MODULE,
  DND5E_SHOVE_ASIDE_POLICY_MODULE,
  DND5E_TUMBLE_POLICY_MODULE
} from './optionalMovementPolicy.js'
import { DND5E_CLEAVING_POLICY_MODULE } from './optionalResolutionPolicy.js'
import { compileDnd5eCreatureRuleFacts } from './creatureRuleFacts.js'

export const dnd5eRulesRuntimeRegistration = {
  capabilities: [dnd5eEffectActionCapability],
  gameSystemId: dnd5eEffectActionCapability.gameSystemId,
  compileCreatureRuleFacts: compileDnd5eCreatureRuleFacts,
  policyModules: [
    { key: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY, contractVersion: 1 },
    DND5E_FLANKING_POLICY_MODULE,
    DND5E_FACING_POLICY_MODULE,
    DND5E_DISARM_POLICY_MODULE,
    DND5E_OVERRUN_POLICY_MODULE,
    DND5E_SHOVE_ASIDE_POLICY_MODULE,
    DND5E_TUMBLE_POLICY_MODULE,
    DND5E_CLEAVING_POLICY_MODULE
  ],
  operations: [
    dnd5eConcentrationDamageDcOperation,
    dnd5eLegendaryActionEligibilityOperation,
    dnd5eMovementReactionEligibilityOperation,
    dnd5eHealProposalOperation,
    dnd5eTemporaryHitPointsProposalOperation,
    dnd5eDamageProposalOperation,
    dnd5eHitPointMaximumReductionProposalOperation,
    dnd5eDamageTotalOperation,
    dnd5eSaveDamageTotalOperation,
    dnd5eHealTotalOperation,
    dnd5eConditionApplyProposalOperation,
    dnd5eAttackTestOperation,
    dnd5eSaveTestOperation,
    dnd5eTestHealProposalOperation,
    dnd5eTestTemporaryHitPointsProposalOperation,
    dnd5eTestDamageProposalOperation,
    dnd5eTestConditionProposalOperation
  ] satisfies readonly RuleOperationContract[]
} as const

/** Creates the exact D&D action runtime used by the Character-action service. */
export function createDnd5eCharacterActionRuntime(input: {
  continuationIntegrityKey: Uint8Array
  definitions: PublishedRuleDefinitionSource
}): RulesRuntimeService {
  const operations: readonly RuleOperationContract[] = [
    ...coreRuleOperations,
    ...dnd5eRulesRuntimeRegistration.operations
  ]
  return createRulesRuntimeService({
    capabilities: dnd5eRulesRuntimeRegistration.capabilities,
    continuationIntegrityKey: input.continuationIntegrityKey,
    definitions: input.definitions,
    operations
  })
}
