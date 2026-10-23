import {
  hitPointMaximumReductionRecoveryTagsSchema,
  type HitPointMaximumReductionRecoveryTag
} from '@artificer-toolkit/schema/effects/hitPointMaximumReduction'
import type { HitPointMaximumReductionAuthored } from '@artificer-toolkit/shared/authored'
import {
  RULE_VALUE_KIND,
  addNumbersRuleOperation,
  addedDiceTotalEvidenceRuleOperation,
  type GameSystemRuleCapabilityContract,
  type ProposalRuleOperationContract,
  type PureRuleOperationContract,
  type RuleGraphDefinition,
  type RuleInputBinding
} from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionConditionOutcomeRules } from '../../characterRuleActionSystemAdapter.js'
import { isCharacterRuleActionForcedMovementDirection } from '../../characterRuleActionSystemAdapter.js'
import { pathGatedProposalOperation } from '../../effectOutcomeRegistry.js'
import { DND5E_GATE_INPUT_KINDS, gatesAdmit } from './effectActionGates.js'
import {
  BASIC_ACTION_DEFINITION_FAMILY_KEY,
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
  SENSE_DEFINITION_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import {
  REACTION_CHOICE_MAX_FACT_KEY,
  REACTION_CHOICE_MIN_FACT_KEY,
  REACTION_CHOICE_OPERATION_KEY
} from '../../reactionChoiceDefinition.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eAddedDiceFactContracts } from './d20AddedDiceGraph.js'
import { DEFAULT_CRITICAL_HIT_THRESHOLD } from '@artificer-toolkit/schema/shared/attackCriticalRules'
import { dnd5eConcentrationCapabilityContribution } from './concentrationPolicy.js'
import { dnd5eEncounterLifecycleCapabilityContribution } from './encounterLifecyclePolicy.js'
import { dnd5eInitiativeCapabilityContribution } from './initiativeFactAdapter.js'
import { dnd5eOptionalCombatContestCapabilityContribution } from './optionalCombatContestGraph.js'
import { dnd5eReactionEligibilityCapabilityContribution } from './reactionEligibilityPolicy.js'
import {
  DND5E_ATTACK_TEST_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  dnd5ePathGatedOperationKey
} from './dnd5eTestOperationKeys.js'
import { DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY } from './addSpeedToMovement.js'
import { DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY } from './teleportAllowance.js'
import { isTeleportAllowanceDestinationKind } from '@artificer-toolkit/shared/vtt/teleportAllowanceDestinationKind'
import { DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY } from './cancelTriggeringEvent.js'
import { DND5E_END_EFFECTS_PROPOSAL_OPERATION_KEY } from './endEffects.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
  DND5E_KILL_PROPOSAL_OPERATION_KEY,
  DND5E_DEPART_PROPOSAL_OPERATION_KEY,
  DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
  DND5E_ACTOR_LINK_PROPOSAL_OPERATION_KEY,
  DND5E_CREATURE_FORM_PROPOSAL_OPERATION_KEY,
  DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
  DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
  DND5E_PLAY_ABSENCE_PROPOSAL_OPERATION_KEY,
  DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  DND5E_DAMAGE_REDUCTION_OPERATION_KEY,
  DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
  DND5E_HEAL_TOTAL_OPERATION_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
  DND5E_NESTED_SAVE_GATE_OPERATION_KEY,
  NESTED_SAVE_GATE_CLOSED_PATH,
  DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  DND5E_CONDITION_DURATION_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_ATTACK_MODIFIER_FACT_KEY,
  DND5E_TARGET_DEFENSE_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY,
  DND5E_CRITICAL_EXTRA_DICE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY,
  DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY,
  DND5E_CONDITION_IMMUNE_FACT_KEYS,
  MAX_CONDITIONS_PER_PATH,
  conditionImmuneFactKey,
  DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS,
  DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY,
  DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
  DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY,
  DND5E_SPELL_CAST_LEVEL_FACT_KEY,
  DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY,
  DND5E_CLASS_LEVELS_FACT_KEY,
  DND5E_WEAPON_DAMAGE_DIE_FACT_KEY,
  DND5E_TARGET_CREATURE_TYPE_FACT_KEY,
  DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY,
  DND5E_ATTACK_MOVE_TOWARD_FACT_KEY,
  DND5E_ATTACK_TURN_USES_FACT_KEY,
  DND5E_DAMAGE_ADDED_DICE_FACT_KEY,
  DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY,
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  UUID,
  type Outcome,
  type TestKind,
  type SpecializedPath,
  isSpecializedPath,
  multipliedDamageAmount,
  encodeForcedMovementCollision,
  decodeForcedMovementCollision
} from './effectActionContracts.js'

export function simpleOperation(key: string): ProposalRuleOperationContract {
  return {
    key,
    contractVersion: 1,
    executionKind: 'PROPOSAL',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      amount: RULE_VALUE_KIND.NUMBER,
      targetStateChecksum: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      amount: RULE_VALUE_KIND.NUMBER,
      applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
      authorized: RULE_VALUE_KIND.BOOLEAN,
      targetStateChecksum: RULE_VALUE_KIND.TEXT
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const amount = inputs.amount
      if (typeof targetActorId !== 'string' || !UUID.test(targetActorId))
        throw new Error('D&D proposal requires a canonical target actor UUID.')
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0)
        throw new Error('D&D proposal requires a positive integer amount.')
      const targetStateChecksum = inputs.targetStateChecksum
      if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
        throw new Error('D&D proposal requires target state checksum.')
      return {
        targetActorId,
        amount,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum
      }
    }
  }
}
export const dnd5eHealProposalOperation = simpleOperation(DND5E_HEAL_PROPOSAL_OPERATION_KEY)
/**
 * A proposal that applies one fixed outcome to the target and carries no amount. With
 * `changesTargetState` false the outcome stores nothing on the target (an Active Effect owns it), so
 * a stored-state batch needs no application for it.
 */
export function targetOnlyProposalOperation(
  key: string,
  label: string,
  changesTargetState = true
): ProposalRuleOperationContract {
  return {
    key,
    contractVersion: 1,
    executionKind: 'PROPOSAL',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      targetStateChecksum: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
      authorized: RULE_VALUE_KIND.BOOLEAN,
      targetStateChecksum: RULE_VALUE_KIND.TEXT,
      ...(changesTargetState ? {} : { changesTargetState: RULE_VALUE_KIND.BOOLEAN })
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const targetStateChecksum = inputs.targetStateChecksum
      if (typeof targetActorId !== 'string' || !UUID.test(targetActorId))
        throw new Error(`D&D ${label} proposal requires a canonical target actor UUID.`)
      if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
        throw new Error(`D&D ${label} proposal requires target state checksum.`)
      return {
        targetActorId,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum,
        ...(changesTargetState ? {} : { changesTargetState: false })
      }
    }
  }
}
export const dnd5eStabilizeProposalOperation = targetOnlyProposalOperation(
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
  'stabilize'
)
export const dnd5eKillProposalOperation = targetOnlyProposalOperation(
  DND5E_KILL_PROPOSAL_OPERATION_KEY,
  'kill'
)
/**
 * Version 2 of a proposal also reads every gate kind's inputs, and is authorized only while the
 * base proposal authorizes and the target passes every gate.
 */
export function gatedProposalOperation(
  base: ProposalRuleOperationContract,
  label: string
): ProposalRuleOperationContract {
  return {
    ...base,
    contractVersion: 2,
    inputs: { ...base.inputs, ...DND5E_GATE_INPUT_KINDS },
    execute(inputs) {
      const admitted = gatesAdmit(inputs)
      if (admitted === null)
        throw new Error(
          `D&D ${label} proposal requires the target's hit points and a hit-point gate.`
        )
      const result = base.execute(inputs)
      return { ...result, authorized: result.authorized === true && admitted }
    }
  }
}
export const dnd5eHitPointGatedKillProposalOperation = gatedProposalOperation(
  dnd5eKillProposalOperation,
  'kill'
)
export const dnd5eHitPointGatedHealProposalOperation = gatedProposalOperation(
  dnd5eHealProposalOperation,
  'heal'
)
export const dnd5eDepartProposalOperation = targetOnlyProposalOperation(
  DND5E_DEPART_PROPOSAL_OPERATION_KEY,
  'depart'
)
export const dnd5eModifierGrantProposalOperation = targetOnlyProposalOperation(
  DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
  'modifier grant',
  false
)
export const dnd5eActorLinkProposalOperation = targetOnlyProposalOperation(
  DND5E_ACTOR_LINK_PROPOSAL_OPERATION_KEY,
  'actor link',
  false
)
export const dnd5eCreatureFormProposalOperation = targetOnlyProposalOperation(
  DND5E_CREATURE_FORM_PROPOSAL_OPERATION_KEY,
  'creature form',
  false
)
export const dnd5eManualAdjudicationProposalOperation = targetOnlyProposalOperation(
  DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
  'manual adjudication',
  false
)
export const dnd5ePlayAbsenceProposalOperation = targetOnlyProposalOperation(
  DND5E_PLAY_ABSENCE_PROPOSAL_OPERATION_KEY,
  'play absence',
  false
)
export const dnd5eConcealProposalOperation = targetOnlyProposalOperation(
  DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
  'conceal',
  false
)
export const dnd5eDetectConcealedProposalOperation = targetOnlyProposalOperation(
  DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
  'detect concealed',
  false
)
export const dnd5eAddSpeedToMovementProposalOperation = targetOnlyProposalOperation(
  DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY,
  'add speed to movement',
  false
)
/** A teleport spell's proposal: it stores nothing on the caster and records its range for the commit to grant. */
export const dnd5eTeleportAllowanceProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT,
    maxFeet: RULE_VALUE_KIND.NUMBER,
    destinationKind: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT,
    changesTargetState: RULE_VALUE_KIND.BOOLEAN,
    maxFeet: RULE_VALUE_KIND.NUMBER,
    destinationKind: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const { targetActorId, targetStateChecksum, maxFeet, destinationKind } = inputs
    if (typeof targetActorId !== 'string' || !UUID.test(targetActorId))
      throw new Error('D&D teleport allowance proposal requires a canonical target actor UUID.')
    if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
      throw new Error('D&D teleport allowance proposal requires target state checksum.')
    if (typeof maxFeet !== 'number' || !Number.isSafeInteger(maxFeet) || maxFeet <= 0)
      throw new Error('D&D teleport allowance proposal requires a positive integer range.')
    if (!isTeleportAllowanceDestinationKind(destinationKind))
      throw new Error('D&D teleport allowance proposal requires a destination kind.')
    return {
      targetActorId,
      applicationCandidate: true,
      authorized: true,
      targetStateChecksum,
      changesTargetState: false,
      maxFeet,
      destinationKind
    }
  }
}
export const dnd5eCancelTriggeringEventProposalOperation = targetOnlyProposalOperation(
  DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY,
  'cancel triggering event',
  false
)
export const dnd5eEndEffectsProposalOperation = targetOnlyProposalOperation(
  DND5E_END_EFFECTS_PROPOSAL_OPERATION_KEY,
  'end effects',
  false
)
export const dnd5eTemporaryHitPointsProposalOperation = simpleOperation(
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
)
export const dnd5eDamageProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    damageTypeId: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    damageTypeId: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const targetActorId = inputs.targetActorId
    const amount = inputs.amount
    const damageTypeId = inputs.damageTypeId
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      typeof damageTypeId !== 'string' ||
      !UUID.test(damageTypeId)
    )
      throw new Error(
        'D&D damage proposal requires canonical identities and a nonnegative integer amount.'
      )
    const targetStateChecksum = inputs.targetStateChecksum
    if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
      throw new Error('D&D damage proposal requires target state checksum.')
    return {
      targetActorId,
      amount,
      damageTypeId,
      applicationCandidate: true,
      authorized: true,
      targetStateChecksum
    }
  }
}
/** A reduction's recovery tags travel through its graph as canonical JSON text. */
export function parseRecoveryTags(value: unknown): HitPointMaximumReductionRecoveryTag[] | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = hitPointMaximumReductionRecoveryTagsSchema.safeParse(JSON.parse(value))
    return parsed.success && JSON.stringify(parsed.data) === value ? parsed.data : null
  } catch {
    return null
  }
}

export const dnd5eHitPointMaximumReductionProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    authorizedPath: RULE_VALUE_KIND.TEXT,
    sourceDamageNodeId: RULE_VALUE_KIND.TEXT,
    sourceDamageOperationKey: RULE_VALUE_KIND.TEXT,
    sourceDamageOutcomeId: RULE_VALUE_KIND.TEXT,
    recoveryTags: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    sourceDamageNodeId: RULE_VALUE_KIND.TEXT,
    sourceDamageOperationKey: RULE_VALUE_KIND.TEXT,
    sourceDamageOutcomeId: RULE_VALUE_KIND.TEXT,
    recoveryTags: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const targetActorId = inputs.targetActorId
    const resultPath = inputs.resultPath
    const authorizedPath = inputs.authorizedPath
    const sourceDamageNodeId = inputs.sourceDamageNodeId
    const sourceDamageOperationKey = inputs.sourceDamageOperationKey
    const sourceDamageOutcomeId = inputs.sourceDamageOutcomeId
    const recoveryTags = inputs.recoveryTags
    const targetStateChecksum = inputs.targetStateChecksum
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof resultPath !== 'string' ||
      typeof authorizedPath !== 'string' ||
      !isSpecializedPath(authorizedPath) ||
      typeof sourceDamageNodeId !== 'string' ||
      sourceDamageNodeId.length === 0 ||
      typeof sourceDamageOperationKey !== 'string' ||
      sourceDamageOperationKey.length === 0 ||
      typeof sourceDamageOutcomeId !== 'string' ||
      !UUID.test(sourceDamageOutcomeId) ||
      typeof recoveryTags !== 'string' ||
      !parseRecoveryTags(recoveryTags) ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    ) {
      throw new Error('D&D hit point maximum reduction proposal is invalid.')
    }
    return {
      targetActorId,
      resultPath,
      sourceDamageNodeId,
      sourceDamageOperationKey,
      sourceDamageOutcomeId,
      recoveryTags,
      applicationCandidate: true,
      authorized: resultPath === authorizedPath,
      targetStateChecksum
    }
  }
}

/**
 * Reduces the target's hit point maximum by the damage it took from one proposal of the same graph,
 * when the result path is the authorized one: a nested save's failure, or the selected direct path.
 */
export function hitPointMaximumReductionProposalNode(input: {
  id: string
  resultPath: RuleGraphDefinition['nodes'][number]['inputs'][string]
  authorizedPath: SpecializedPath
  sourceDamageNodeId: string
  reduction: Pick<HitPointMaximumReductionAuthored, 'amountSource' | 'recoveryTags'>
}): RuleGraphDefinition['nodes'][number] {
  return {
    id: input.id,
    operation: {
      key: DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
      contractVersion: 1
    },
    inputs: {
      targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      resultPath: input.resultPath,
      authorizedPath: { kind: 'LITERAL', value: input.authorizedPath },
      sourceDamageNodeId: { kind: 'LITERAL', value: input.sourceDamageNodeId },
      sourceDamageOperationKey: { kind: 'LITERAL', value: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY },
      sourceDamageOutcomeId: {
        kind: 'LITERAL',
        value: input.reduction.amountSource.damageOutcomeId
      },
      recoveryTags: { kind: 'LITERAL', value: JSON.stringify(input.reduction.recoveryTags) },
      targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
    }
  }
}
export const dnd5eScalarReductionProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    valueDefinitionId: RULE_VALUE_KIND.TEXT,
    recoveryTriggers: RULE_VALUE_KIND.TEXT,
    terminalConsequence: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    amount: RULE_VALUE_KIND.NUMBER,
    valueDefinitionId: RULE_VALUE_KIND.TEXT,
    recoveryTriggers: RULE_VALUE_KIND.TEXT,
    terminalConsequence: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const {
      targetActorId,
      amount,
      valueDefinitionId,
      recoveryTriggers,
      terminalConsequence,
      targetStateChecksum
    } = inputs
    let triggers: unknown
    if (typeof recoveryTriggers === 'string') {
      try {
        triggers = JSON.parse(recoveryTriggers)
      } catch {
        triggers = null
      }
    }
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      typeof valueDefinitionId !== 'string' ||
      !UUID.test(valueDefinitionId) ||
      typeof recoveryTriggers !== 'string' ||
      !Array.isArray(triggers) ||
      typeof terminalConsequence !== 'string' ||
      terminalConsequence !== 'TARGET_DIED' ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    )
      throw new Error('D&D scalar reduction proposal is invalid.')
    if (
      triggers.length < 1 ||
      triggers.length > 2 ||
      new Set(triggers).size !== triggers.length ||
      triggers.some((trigger) => trigger !== 'SHORT_REST' && trigger !== 'LONG_REST')
    )
      throw new Error('D&D scalar reduction recovery is invalid.')
    return {
      targetActorId,
      amount,
      valueDefinitionId,
      recoveryTriggers,
      terminalConsequence,
      applicationCandidate: true,
      authorized: true,
      targetStateChecksum
    }
  }
}
/**
 * Proposes an authored push or pull on its result path: the room settles it along the straight line
 * from the action's source (D105), so the proposal changes no target state of its own.
 */
export const dnd5eForcedMovementProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    sourceEntryId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    authoredPath: RULE_VALUE_KIND.TEXT,
    direction: RULE_VALUE_KIND.TEXT,
    feet: RULE_VALUE_KIND.NUMBER,
    upTo: RULE_VALUE_KIND.BOOLEAN,
    collision: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    sourceEntryId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    authoredPath: RULE_VALUE_KIND.TEXT,
    direction: RULE_VALUE_KIND.TEXT,
    feet: RULE_VALUE_KIND.NUMBER,
    upTo: RULE_VALUE_KIND.BOOLEAN,
    collision: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    changesTargetState: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const {
      targetActorId,
      sourceEntryId,
      resultPath,
      authoredPath,
      direction,
      feet,
      upTo,
      collision,
      targetStateChecksum
    } = inputs
    decodeForcedMovementCollision(collision)
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof sourceEntryId !== 'string' ||
      !UUID.test(sourceEntryId) ||
      typeof resultPath !== 'string' ||
      typeof authoredPath !== 'string' ||
      !isCharacterRuleActionForcedMovementDirection(direction) ||
      typeof feet !== 'number' ||
      !Number.isSafeInteger(feet) ||
      feet <= 0 ||
      typeof upTo !== 'boolean' ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    ) {
      throw new Error('D&D forced movement proposal is invalid.')
    }
    return {
      targetActorId,
      sourceEntryId,
      resultPath,
      authoredPath,
      direction,
      feet,
      upTo,
      collision,
      applicationCandidate: true,
      authorized: resultPath === authoredPath,
      changesTargetState: false,
      targetStateChecksum
    }
  }
}

/** The proposal node of an authored push or pull, authorized when the test resolves to its path. */
export function forcedMovementProposalNode(input: {
  id: string
  sourceEntryId: string
  resultPath: RuleInputBinding
  authoredPath: string
  outcome: Extract<Outcome, { kind: 'FORCED_MOVEMENT' }>
}) {
  return {
    id: input.id,
    operation: { key: DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
    inputs: {
      targetActorId: { kind: 'FACT' as const, factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      sourceEntryId: { kind: 'LITERAL' as const, value: input.sourceEntryId },
      resultPath: input.resultPath,
      authoredPath: { kind: 'LITERAL' as const, value: input.authoredPath },
      direction: { kind: 'LITERAL' as const, value: input.outcome.direction },
      feet: { kind: 'LITERAL' as const, value: input.outcome.feet },
      upTo: { kind: 'LITERAL' as const, value: input.outcome.upTo },
      collision: {
        kind: 'LITERAL' as const,
        value: encodeForcedMovementCollision(input.outcome.collision)
      },
      targetStateChecksum: { kind: 'FACT' as const, factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
    }
  }
}
export const dnd5eDamageTotalOperation: PureRuleOperationContract = {
  key: DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    subtotal: RULE_VALUE_KIND.NUMBER,
    modifier: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const subtotal = inputs.subtotal
    const modifier = inputs.modifier
    if (
      typeof subtotal !== 'number' ||
      !Number.isSafeInteger(subtotal) ||
      typeof modifier !== 'number' ||
      !Number.isSafeInteger(modifier) ||
      !Number.isSafeInteger(subtotal + modifier)
    ) {
      throw new Error('D&D damage total requires safe integer operands.')
    }
    return { value: flooredDamage(subtotal + modifier) }
  }
}
/** Damage is never negative: a total or a reduction below zero deals none. */
export function flooredDamage(amount: number) {
  return Math.max(0, amount)
}
/** Takes rolled dice off an amount of damage (Reduce's 1d4 less), floored like every damage total. */
export const dnd5eDamageReductionOperation: PureRuleOperationContract = {
  key: DND5E_DAMAGE_REDUCTION_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    amount: RULE_VALUE_KIND.NUMBER,
    reduction: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const amount = inputs.amount
    const reduction = inputs.reduction
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      typeof reduction !== 'number' ||
      !Number.isSafeInteger(reduction) ||
      reduction < 0
    )
      throw new Error('D&D damage reduction requires nonnegative safe integer operands.')
    return { value: flooredDamage(amount - reduction) }
  }
}
/** Applies an authored damage multiplier to rolled damage, rounding down (SRD). */
export const dnd5eDamageMultiplierOperation: PureRuleOperationContract = {
  key: DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    amount: RULE_VALUE_KIND.NUMBER,
    multiplier: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const amount = inputs.amount
    const multiplier = inputs.multiplier
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      typeof multiplier !== 'number'
    ) {
      throw new Error('D&D damage multiplier requires a safe damage amount.')
    }
    return { value: multipliedDamageAmount(amount, multiplier) }
  }
}
export const dnd5eHealTotalOperation: PureRuleOperationContract = {
  key: DND5E_HEAL_TOTAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    subtotal: RULE_VALUE_KIND.NUMBER,
    modifier: RULE_VALUE_KIND.NUMBER
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  execute(inputs) {
    const subtotal = inputs.subtotal
    const modifier = inputs.modifier
    if (
      typeof subtotal !== 'number' ||
      !Number.isSafeInteger(subtotal) ||
      typeof modifier !== 'number' ||
      !Number.isSafeInteger(modifier) ||
      !Number.isSafeInteger(subtotal + modifier)
    ) {
      throw new Error('D&D healing total requires safe integer operands.')
    }
    return { value: Math.max(0, subtotal + modifier) }
  }
}
export const dnd5eConditionApplyProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    conditionId: RULE_VALUE_KIND.TEXT,
    conditionImmune: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    conditionId: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    authorized: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const targetActorId = inputs.targetActorId
    const conditionId = inputs.conditionId
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof conditionId !== 'string' ||
      !UUID.test(conditionId)
    )
      throw new Error('D&D condition proposal requires canonical target and condition identities.')
    const targetStateChecksum = inputs.targetStateChecksum
    if (typeof targetStateChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(targetStateChecksum))
      throw new Error('D&D condition proposal requires target state checksum.')
    const conditionImmune = inputs.conditionImmune
    if (typeof conditionImmune !== 'boolean')
      throw new Error('D&D condition proposal requires normalized target protections.')
    return {
      targetActorId,
      conditionId,
      applicationCandidate: true,
      authorized: !conditionImmune,
      targetStateChecksum
    }
  }
}

export const dnd5eHitPointGatedConditionApplyProposalOperation = gatedProposalOperation(
  dnd5eConditionApplyProposalOperation,
  'condition'
)

export const DND5E_TEST_OUTCOME_RULES = [
  'NONE',
  'SAVE_AUTO_FAIL',
  'SAVE_AUTO_SUCCESS',
  'HIT_IS_CRITICAL'
] as const
export type Dnd5eTestOutcomeRule = (typeof DND5E_TEST_OUTCOME_RULES)[number]

export function isDnd5eTestOutcomeRule(value: unknown): value is Dnd5eTestOutcomeRule {
  return DND5E_TEST_OUTCOME_RULES.some((rule) => rule === value)
}

/**
 * The D&D test result path. An attack's roll at or above its critical threshold (a natural 20 unless
 * a grant lowers it, D158) hits critically whatever the target's defense, and a natural 1 always
 * misses; a target's condition can make a hit critical or a save fail without counting the roll
 * (D94), and an authored automatic success (a poison-immune creature) makes a save succeed without
 * counting it.
 */
export function dnd5eTestResultPath(
  input: {
    naturalD20: number
    total: number
    threshold: number
    outcomeRule: Dnd5eTestOutcomeRule
  } & ({ kind: 'SAVE' } | { kind: 'ATTACK'; criticalThreshold: number })
) {
  if (input.kind === 'SAVE')
    return input.outcomeRule === 'SAVE_AUTO_SUCCESS' ||
      (input.outcomeRule !== 'SAVE_AUTO_FAIL' && input.total >= input.threshold)
      ? 'ON_SAVE_SUCCESS'
      : 'ON_SAVE_FAIL'
  if (input.naturalD20 === 1) return 'ON_MISS'
  if (input.naturalD20 >= input.criticalThreshold) return 'ON_CRIT'
  if (input.total < input.threshold) return 'ON_MISS'
  return input.outcomeRule === 'HIT_IS_CRITICAL' ? 'ON_CRIT' : 'ON_HIT'
}

/** A target's save outcome rule: its conditions fail saves of these abilities unrolled (D94). */
export function dnd5eSaveOutcomeRule(
  rules: CharacterRuleActionConditionOutcomeRules | null | undefined,
  abilityDefinitionId: string
): Dnd5eTestOutcomeRule {
  return rules?.saveAutoFailAbilityIds.includes(abilityDefinitionId) ? 'SAVE_AUTO_FAIL' : 'NONE'
}

/**
 * Version 3 adds the test's added dice (D156) after the kept d20; the attack's version 4 adds its
 * required critical threshold (D158).
 */
export function testContractVersion(kind: TestKind) {
  return kind === 'ATTACK' ? 4 : 3
}

export function testOperation(key: string, kind: TestKind): PureRuleOperationContract {
  return {
    key,
    contractVersion: testContractVersion(kind),
    executionKind: 'PURE',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      naturalD20: RULE_VALUE_KIND.NUMBER,
      modifier: RULE_VALUE_KIND.NUMBER,
      addedTotal: RULE_VALUE_KIND.NUMBER,
      threshold: RULE_VALUE_KIND.NUMBER,
      ...(kind === 'ATTACK' ? { criticalThreshold: RULE_VALUE_KIND.NUMBER } : {}),
      contributorChecksum: RULE_VALUE_KIND.TEXT,
      outcomeRule: RULE_VALUE_KIND.TEXT
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      naturalD20: RULE_VALUE_KIND.NUMBER,
      total: RULE_VALUE_KIND.NUMBER,
      resultPath: RULE_VALUE_KIND.TEXT,
      contributorChecksum: RULE_VALUE_KIND.TEXT
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const naturalD20 = inputs.naturalD20
      const modifier = inputs.modifier
      const addedTotal = inputs.addedTotal
      const threshold = inputs.threshold
      const outcomeRule = inputs.outcomeRule
      if (
        !isDnd5eTestOutcomeRule(outcomeRule) ||
        typeof targetActorId !== 'string' ||
        !UUID.test(targetActorId) ||
        typeof naturalD20 !== 'number' ||
        !Number.isSafeInteger(naturalD20) ||
        naturalD20 < 1 ||
        naturalD20 > 20 ||
        typeof modifier !== 'number' ||
        !Number.isSafeInteger(modifier) ||
        typeof addedTotal !== 'number' ||
        !Number.isSafeInteger(addedTotal) ||
        typeof threshold !== 'number' ||
        !Number.isSafeInteger(threshold)
      )
        throw new Error('D&D test resolution requires canonical target and safe integer facts.')
      const total = naturalD20 + modifier + addedTotal
      if (!Number.isSafeInteger(total))
        throw new Error('D&D test total exceeds safe integer range.')
      const criticalThreshold = inputs.criticalThreshold
      if (
        kind === 'ATTACK' &&
        (typeof criticalThreshold !== 'number' ||
          !Number.isInteger(criticalThreshold) ||
          criticalThreshold < 2 ||
          criticalThreshold > DEFAULT_CRITICAL_HIT_THRESHOLD)
      )
        throw new Error('D&D attack resolution requires a critical threshold from 2 to 20.')
      const resultPath = dnd5eTestResultPath(
        kind === 'ATTACK'
          ? {
              kind,
              naturalD20,
              total,
              threshold,
              outcomeRule,
              criticalThreshold: criticalThreshold as number
            }
          : { kind, naturalD20, total, threshold, outcomeRule }
      )
      const contributorChecksum = inputs.contributorChecksum
      if (typeof contributorChecksum !== 'string' || !/^[a-f0-9]{64}$/.test(contributorChecksum))
        throw new Error('D&D test resolution requires contributor evidence checksum.')
      return {
        targetActorId,
        naturalD20,
        total,
        resultPath,
        contributorChecksum
      }
    }
  }
}

export const dnd5eAttackTestOperation = testOperation(DND5E_ATTACK_TEST_OPERATION_KEY, 'ATTACK')
export const dnd5eSaveTestOperation = testOperation(DND5E_SAVE_TEST_OPERATION_KEY, 'SAVE')
export const dnd5eMovementInterruptionAuthorizationOperation: PureRuleOperationContract = {
  key: DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: { resultPath: RULE_VALUE_KIND.TEXT, authoredPath: RULE_VALUE_KIND.TEXT },
  outputs: { authorized: RULE_VALUE_KIND.BOOLEAN },
  execute(inputs) {
    const { resultPath, authoredPath } = inputs
    if (
      typeof resultPath !== 'string' ||
      typeof authoredPath !== 'string' ||
      !isSpecializedPath(resultPath) ||
      !isSpecializedPath(authoredPath)
    )
      throw new Error('D&D movement interruption requires canonical result paths.')
    return { authorized: dnd5eResultPathSatisfies(resultPath, authoredPath) }
  }
}

/**
 * A nested save band's gate: hands its outcomes the save's result path while every gate kind admits
 * the target, and a path no authored outcome satisfies otherwise.
 */
export const dnd5eNestedSaveGateOperation: PureRuleOperationContract = {
  key: DND5E_NESTED_SAVE_GATE_OPERATION_KEY,
  contractVersion: 2,
  executionKind: 'PURE',
  inputs: { resultPath: RULE_VALUE_KIND.TEXT, ...DND5E_GATE_INPUT_KINDS },
  outputs: { authorized: RULE_VALUE_KIND.BOOLEAN, resultPath: RULE_VALUE_KIND.TEXT },
  execute(inputs) {
    const { resultPath } = inputs
    const admitted = gatesAdmit(inputs)
    if (typeof resultPath !== 'string' || !isSpecializedPath(resultPath) || admitted === null)
      throw new Error('D&D nested save gate requires a result path and the gate inputs.')
    return {
      authorized: admitted,
      resultPath: admitted ? resultPath : NESTED_SAVE_GATE_CLOSED_PATH
    }
  }
}

/** A test's result path selects an outcome authored on it, and a critical hit also selects the hit's. */
export function dnd5eResultPathSatisfies(resolvedPath: string, authoredPath: string): boolean {
  return resolvedPath === authoredPath || (resolvedPath === 'ON_CRIT' && authoredPath === 'ON_HIT')
}
/** The resolved test paths that select an outcome authored on this path: an active-effect plan's gate. */
export function dnd5eResultGate(authoredPath: string): { paths: string[] } {
  const resolvedPaths = [
    'ON_HIT',
    'ON_MISS',
    'ON_CRIT',
    'ON_SAVE_FAIL',
    'ON_SAVE_SUCCESS',
    'ON_CHECK_SUCCESS'
  ]
  return {
    paths: resolvedPaths.filter((resolvedPath) =>
      dnd5eResultPathSatisfies(resolvedPath, authoredPath)
    )
  }
}
/** The target-only proposals a test's result path gates; each is its direct contract plus the path. */
export const dnd5ePathGatedTargetProposalOperations = [
  dnd5eStabilizeProposalOperation,
  dnd5eKillProposalOperation,
  dnd5eDepartProposalOperation,
  dnd5eManualAdjudicationProposalOperation,
  dnd5eAddSpeedToMovementProposalOperation,
  dnd5eTeleportAllowanceProposalOperation,
  dnd5eCancelTriggeringEventProposalOperation
].map((base) =>
  pathGatedProposalOperation(base, dnd5ePathGatedOperationKey(base.key), dnd5eResultPathSatisfies)
)
export function testProposalOperation(
  key: string,
  payload: Readonly<Record<string, typeof RULE_VALUE_KIND.NUMBER | typeof RULE_VALUE_KIND.TEXT>>,
  conditionProtection = false,
  /** Version 2 also reads whether the save cleared a failure margin, and is refused when it did. */
  marginGated = false
): ProposalRuleOperationContract {
  return {
    key,
    contractVersion: marginGated ? 2 : 1,
    executionKind: 'PROPOSAL',
    inputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      resolvedPath: RULE_VALUE_KIND.TEXT,
      authoredPath: RULE_VALUE_KIND.TEXT,
      targetStateChecksum: RULE_VALUE_KIND.TEXT,
      ...(conditionProtection ? { conditionImmune: RULE_VALUE_KIND.BOOLEAN } : {}),
      ...(marginGated ? { marginCleared: RULE_VALUE_KIND.BOOLEAN } : {}),
      ...payload
    },
    outputs: {
      targetActorId: RULE_VALUE_KIND.TEXT,
      resolvedPath: RULE_VALUE_KIND.TEXT,
      authoredPath: RULE_VALUE_KIND.TEXT,
      authorized: RULE_VALUE_KIND.BOOLEAN,
      applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
      targetStateChecksum: RULE_VALUE_KIND.TEXT,
      ...payload
    },
    execute(inputs) {
      const targetActorId = inputs.targetActorId
      const resolvedPath = inputs.resolvedPath
      const authoredPath = inputs.authoredPath
      const targetStateChecksum = inputs.targetStateChecksum
      if (
        typeof targetActorId !== 'string' ||
        !UUID.test(targetActorId) ||
        typeof resolvedPath !== 'string' ||
        typeof authoredPath !== 'string' ||
        typeof targetStateChecksum !== 'string' ||
        !/^[a-f0-9]{64}$/.test(targetStateChecksum)
      )
        throw new Error('D&D test proposal requires exact target and path identities.')
      for (const [port, kind] of Object.entries(payload)) {
        const value = inputs[port]
        // A halved roll of 1 rounds down to 0, which is still the result the path proposes.
        if (
          (kind === RULE_VALUE_KIND.NUMBER &&
            (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) ||
          (kind === RULE_VALUE_KIND.TEXT && typeof value !== 'string')
        )
          throw new Error('D&D test proposal payload is invalid.')
      }
      const conditionImmune = inputs.conditionImmune
      if (conditionProtection && typeof conditionImmune !== 'boolean')
        throw new Error('D&D test condition proposal requires normalized target protections.')
      const marginCleared = inputs.marginCleared
      if (marginGated && typeof marginCleared !== 'boolean')
        throw new Error('D&D margin condition proposal requires the evaluated failure margin.')
      return {
        targetActorId,
        resolvedPath,
        authoredPath,
        authorized:
          dnd5eResultPathSatisfies(resolvedPath, authoredPath) &&
          (!conditionProtection || !conditionImmune) &&
          (!marginGated || !marginCleared),
        applicationCandidate: true,
        targetStateChecksum,
        ...Object.fromEntries(Object.keys(payload).map((port) => [port, inputs[port]!]))
      }
    }
  }
}

export const dnd5eTestHealProposalOperation = testProposalOperation(
  DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
  { amount: RULE_VALUE_KIND.NUMBER }
)
export const dnd5eTestTemporaryHitPointsProposalOperation = testProposalOperation(
  DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  { amount: RULE_VALUE_KIND.NUMBER }
)
export const dnd5eTestDamageProposalOperation = testProposalOperation(
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
  { amount: RULE_VALUE_KIND.NUMBER, damageTypeId: RULE_VALUE_KIND.TEXT }
)
export const dnd5eTestConditionProposalOperation = testProposalOperation(
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  { conditionId: RULE_VALUE_KIND.TEXT },
  true
)
/** A failure-margin rider's condition: applied only when the save fails by the rider's margin. */
export const dnd5eTestMarginConditionProposalOperation = testProposalOperation(
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  { conditionId: RULE_VALUE_KIND.TEXT },
  true,
  true
)
export const dnd5eTestScalarReductionProposalOperation = testProposalOperation(
  DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  {
    amount: RULE_VALUE_KIND.NUMBER,
    valueDefinitionId: RULE_VALUE_KIND.TEXT,
    recoveryTriggers: RULE_VALUE_KIND.TEXT,
    terminalConsequence: RULE_VALUE_KIND.TEXT
  }
)
/** Every proposal a test's result path gates, each told apart by its key and contract version. */
export const dnd5ePathGatedProposalOperations = [
  dnd5eTestHealProposalOperation,
  dnd5eTestTemporaryHitPointsProposalOperation,
  dnd5eTestDamageProposalOperation,
  dnd5eTestScalarReductionProposalOperation,
  dnd5eTestConditionProposalOperation,
  dnd5eTestMarginConditionProposalOperation,
  ...dnd5ePathGatedTargetProposalOperations
]
/** Binds a persistent relationship's authored entry; application is owned by the effect planner. */
export const dnd5eActorRelationshipStateOperation: PureRuleOperationContract = {
  key: DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {},
  outputs: {},
  execute: () => ({})
}
/** Marks one counted turn of a timed condition; the effect planner owns its removal. */
export const dnd5eConditionDurationOperation: PureRuleOperationContract = {
  key: DND5E_CONDITION_DURATION_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {},
  outputs: {},
  execute: () => ({})
}
export const dnd5eEffectActionCapability: GameSystemRuleCapabilityContract = {
  gameSystemId: DND5E_SYSTEM_ID,
  contractVersion: 1,
  authoredRootKinds: ['effect'],
  definitionFamilyKeys: [
    DND5E_EFFECT_ACTION_FAMILY_KEY,
    SENSE_DEFINITION_FAMILY_KEY,
    'dnd5e-optional-combat',
    RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
    CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
    RULE_MAINTENANCE_DEFINITION_FAMILY_KEY,
    BASIC_ACTION_DEFINITION_FAMILY_KEY,
    ...new Set([
      ...dnd5eConcentrationCapabilityContribution.definitionFamilyKeys,
      ...dnd5eEncounterLifecycleCapabilityContribution.definitionFamilyKeys,
      ...dnd5eInitiativeCapabilityContribution.definitionFamilyKeys,
      ...dnd5eOptionalCombatContestCapabilityContribution.definitionFamilyKeys,
      ...dnd5eReactionEligibilityCapabilityContribution.definitionFamilyKeys
    ])
  ],
  factContracts: [
    { key: DND5E_TARGET_ACTOR_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_ATTACK_MODIFIER_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_TARGET_DEFENSE_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_SAVE_MODIFIER_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_SAVE_DC_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    {
      key: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    { key: DND5E_TEST_OUTCOME_RULE_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_CRITICAL_EXTRA_DICE_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    {
      key: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    {
      key: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    { key: DND5E_TARGET_CURRENT_HIT_POINTS_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
    { key: DND5E_TARGET_DAMAGE_TYPES_TAKEN_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    ...Object.keys(DND5E_CONDITION_IMMUNE_FACT_KEYS).flatMap((pathCode) =>
      Array.from({ length: MAX_CONDITIONS_PER_PATH }, (_, index) => ({
        key: conditionImmuneFactKey(pathCode, index + 1)!,
        valueKind: RULE_VALUE_KIND.BOOLEAN
      }))
    ),
    ...Object.values(DND5E_RESOLVED_DAMAGE_EXPRESSION_FACT_KEYS).map((key) => ({
      key,
      valueKind: RULE_VALUE_KIND.TEXT
    })),
    {
      key: DND5E_RESOLVED_DAMAGE_OUTCOME_EXPRESSIONS_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    {
      key: DND5E_WEAPON_DAMAGE_DIE_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_RESOLVED_HEAL_MODIFIER_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: DND5E_SPELL_CAST_LEVEL_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    { key: DND5E_CLASS_LEVELS_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_SELECTED_OPTIONAL_RIDERS_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_TARGET_CREATURE_TYPE_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_ATTACK_ENEMY_PROXIMITY_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_ATTACK_MOVE_TOWARD_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_ATTACK_TURN_USES_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_DAMAGE_ADDED_DICE_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    { key: DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY, valueKind: RULE_VALUE_KIND.BOOLEAN },
    ...dnd5eAddedDiceFactContracts,
    {
      key: REACTION_CHOICE_MIN_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    {
      key: REACTION_CHOICE_MAX_FACT_KEY,
      valueKind: RULE_VALUE_KIND.NUMBER
    },
    ...dnd5eConcentrationCapabilityContribution.factContracts,
    ...dnd5eEncounterLifecycleCapabilityContribution.factContracts,
    ...dnd5eInitiativeCapabilityContribution.factContracts,
    ...dnd5eOptionalCombatContestCapabilityContribution.factContracts,
    ...dnd5eReactionEligibilityCapabilityContribution.factContracts
  ],
  operationContracts: [
    'evidence.integer-range',
    'evidence.optional-integer-range',
    addedDiceTotalEvidenceRuleOperation.key,
    addNumbersRuleOperation.key,
    REACTION_CHOICE_OPERATION_KEY,
    DND5E_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
    DND5E_KILL_PROPOSAL_OPERATION_KEY,
    DND5E_DEPART_PROPOSAL_OPERATION_KEY,
    DND5E_MODIFIER_GRANT_PROPOSAL_OPERATION_KEY,
    DND5E_ACTOR_LINK_PROPOSAL_OPERATION_KEY,
    DND5E_CREATURE_FORM_PROPOSAL_OPERATION_KEY,
    DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY,
    DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
    DND5E_PLAY_ABSENCE_PROPOSAL_OPERATION_KEY,
    DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
    DND5E_ADD_SPEED_TO_MOVEMENT_PROPOSAL_OPERATION_KEY,
    DND5E_TELEPORT_ALLOWANCE_PROPOSAL_OPERATION_KEY,
    DND5E_CANCEL_TRIGGERING_EVENT_PROPOSAL_OPERATION_KEY,
    DND5E_END_EFFECTS_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
    DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
    DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
    DND5E_DAMAGE_TOTAL_OPERATION_KEY,
    DND5E_DAMAGE_REDUCTION_OPERATION_KEY,
    DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
    DND5E_HEAL_TOTAL_OPERATION_KEY,
    DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
    DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
    DND5E_CONDITION_DURATION_OPERATION_KEY,
    DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
    DND5E_TEST_HEAL_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
    DND5E_TEST_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
    ...dnd5ePathGatedTargetProposalOperations.map(({ key }) => key),
    ...dnd5eConcentrationCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eEncounterLifecycleCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eInitiativeCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eOptionalCombatContestCapabilityContribution.operationContracts.map(({ key }) => key),
    ...dnd5eReactionEligibilityCapabilityContribution.operationContracts.map(({ key }) => key)
  ]
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .map((key) => ({ key, contractVersion: 1 }))
    .concat(
      [
        dnd5eAttackTestOperation,
        dnd5eSaveTestOperation,
        dnd5eTestMarginConditionProposalOperation,
        dnd5eNestedSaveGateOperation,
        dnd5eHitPointGatedKillProposalOperation,
        dnd5eHitPointGatedHealProposalOperation,
        dnd5eHitPointGatedConditionApplyProposalOperation
      ].map(({ key, contractVersion }) => ({ key, contractVersion }))
    )
}
