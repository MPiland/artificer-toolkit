import { type RuleOperationContract } from '@artificer-toolkit/shared/rules'
import {
  dnd5eAttackTestOperation,
  dnd5eActorRelationshipStateOperation,
  dnd5eConditionApplyProposalOperation,
  dnd5eConditionDurationOperation,
  dnd5eDamageProposalOperation,
  dnd5eHitPointLossProposalOperation,
  dnd5eHitPointMaximumReductionProposalOperation,
  dnd5eScalarReductionProposalOperation,
  dnd5eForcedMovementProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eDamageReductionOperation,
  dnd5eDamageMultiplierOperation,
  dnd5eEffectActionCapability,
  dnd5eHealProposalOperation,
  dnd5eHealTotalOperation,
  dnd5eSaveTestOperation,
  dnd5eActorLinkProposalOperation,
  dnd5eCreatureFormProposalOperation,
  dnd5eAddSpeedToMovementProposalOperation,
  dnd5eCancelTriggeringEventProposalOperation,
  dnd5eSubtractFromTriggeringRollProposalOperation,
  dnd5eImposeRollModeOnTriggeringRollProposalOperation,
  dnd5eEndEffectsProposalOperation,
  dnd5eConcealProposalOperation,
  dnd5ePlayAbsenceProposalOperation,
  dnd5eDetectConcealedProposalOperation,
  dnd5eManualAdjudicationProposalOperation,
  dnd5eModifierGrantProposalOperation,
  dnd5eStabilizeProposalOperation,
  dnd5eKillProposalOperation,
  dnd5eReviveProposalOperation,
  dnd5eHitPointGatedConditionApplyProposalOperation,
  dnd5eHitPointGatedHealProposalOperation,
  dnd5eHitPointGatedKillProposalOperation,
  dnd5eDepartProposalOperation,
  dnd5eHitPointsToZeroProposalOperation,
  dnd5eTeleportAllowanceProposalOperation,
  dnd5eTemporaryHitPointsProposalOperation,
  dnd5eMovementInterruptionAuthorizationOperation,
  dnd5eNestedSaveGateOperation,
  dnd5eRollTableRowGateOperation,
  dnd5eRollTableRerollFaceOperation,
  dnd5ePathGatedProposalOperations
} from './effectActionOperationRegistry.js'
import { dnd5eDamageDerivedHealProposalOperation } from './effectActionDamageDerivedHeal.js'
import { dnd5eAttackKind, isDnd5eMeleeAttackKind, isDnd5eSpellAttackKind } from './attackKind.js'
import { dnd5eConcentrationDamageDcOperation } from './concentrationPolicy.js'
import { dnd5eLegendaryActionEligibilityOperation } from './encounterLifecyclePolicy.js'
import { dnd5eMovementReactionEligibilityOperation } from './reactionEligibilityPolicy.js'

/**
 * D&D 5e's rules runtime tier (D195): its published-graph contract, operations and compilers. One
 * export per capability of `GameSystemRuntimeTier`, so a bundle keeps only what it reaches (ADR 0042).
 */
export { compileDnd5eCreatureRuleFacts as compileCreatureRuleFacts } from './creatureRuleFacts.js'
export { DND5E_SYSTEM_ID as gameSystemId } from './identity.js'

export const capabilities = [dnd5eEffectActionCapability]

export const isMeleeAttackTrigger = (triggerCode: string) =>
  isDnd5eMeleeAttackKind(dnd5eAttackKind(triggerCode))

export const isSpellAttackTrigger = (triggerCode: string) =>
  isDnd5eSpellAttackKind(dnd5eAttackKind(triggerCode))

export const operations: readonly RuleOperationContract[] = [
  dnd5eConcentrationDamageDcOperation,
  dnd5eLegendaryActionEligibilityOperation,
  dnd5eMovementReactionEligibilityOperation,
  dnd5eHealProposalOperation,
  dnd5eTemporaryHitPointsProposalOperation,
  dnd5eStabilizeProposalOperation,
  dnd5eKillProposalOperation,
  dnd5eReviveProposalOperation,
  dnd5eHitPointGatedConditionApplyProposalOperation,
  dnd5eHitPointGatedHealProposalOperation,
  dnd5eHitPointGatedKillProposalOperation,
  dnd5eDepartProposalOperation,
  dnd5eHitPointsToZeroProposalOperation,
  dnd5eModifierGrantProposalOperation,
  dnd5eActorLinkProposalOperation,
  dnd5eCreatureFormProposalOperation,
  dnd5eManualAdjudicationProposalOperation,
  dnd5eConcealProposalOperation,
  dnd5ePlayAbsenceProposalOperation,
  dnd5eDetectConcealedProposalOperation,
  dnd5eAddSpeedToMovementProposalOperation,
  dnd5eTeleportAllowanceProposalOperation,
  dnd5eCancelTriggeringEventProposalOperation,
  dnd5eSubtractFromTriggeringRollProposalOperation,
  dnd5eImposeRollModeOnTriggeringRollProposalOperation,
  dnd5eEndEffectsProposalOperation,
  dnd5eDamageProposalOperation,
  dnd5eHitPointLossProposalOperation,
  dnd5eHitPointMaximumReductionProposalOperation,
  dnd5eDamageDerivedHealProposalOperation,
  dnd5eScalarReductionProposalOperation,
  dnd5eForcedMovementProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eDamageReductionOperation,
  dnd5eDamageMultiplierOperation,
  dnd5eHealTotalOperation,
  dnd5eConditionApplyProposalOperation,
  dnd5eActorRelationshipStateOperation,
  dnd5eConditionDurationOperation,
  dnd5eAttackTestOperation,
  dnd5eSaveTestOperation,
  dnd5eNestedSaveGateOperation,
  dnd5eRollTableRowGateOperation,
  dnd5eRollTableRerollFaceOperation,
  dnd5eMovementInterruptionAuthorizationOperation,
  ...dnd5ePathGatedProposalOperations
]
