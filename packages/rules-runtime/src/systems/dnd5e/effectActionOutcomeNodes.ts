import type { ForcedMovementCollisionAuthored } from '@artificer-toolkit/shared/authored'
import { addNumbersRuleOperation, type RuleInputBinding } from '@artificer-toolkit/shared/rules'
import {
  type CharacterRuleActionForcedMovementCollision,
  isCharacterRuleActionForcedMovementDirection
} from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  UUID,
  type Outcome,
  type EntryDiceDamageOutcome,
  uuid,
  unsupported,
  multipliedDamageAmount,
  COLLISION_DICE_CONFIG
} from './effectActionContracts.js'
import { effectOutcomeProposalNode } from '../../effectOutcomeRegistry.js'
import {
  dnd5eOutcomeDefinition,
  dnd5eTestPathTargetOnlyOutcome,
  dnd5eUnsupportedPlanUnderTest,
  type Dnd5eAuthoredOutcome
} from './effectActionOutcomes.js'
import { type BoundedDiceTerm } from './effectActionScalingFacts.js'

/** The target every outcome proposal reads: the target actor and its state checksum. */
export const DND5E_OUTCOME_TARGET = {
  targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
  targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
} as const satisfies Readonly<Record<string, RuleInputBinding>>

export function damageTypeIdentity(damageTypeId: string | undefined): string {
  uuid(damageTypeId, 'D&D damage type identity')
  return damageTypeId
}

/**
 * The factor an authored damage outcome scales its total by: its `multiplier` (the monster
 * vocabulary for half on a successful save) times its `amountKind` (the spell vocabulary: HALF is
 * 0.5, DOUBLE is 2). Every compiled damage amount reads it, so both vocabularies compile alike.
 */
export function damageMultiplier(outcome: {
  amountKind?: 'FULL' | 'HALF' | 'DOUBLE'
  multiplier?: number
}): number {
  const kind = outcome.amountKind === 'HALF' ? 0.5 : outcome.amountKind === 'DOUBLE' ? 2 : 1
  return (outcome.multiplier ?? 1) * kind
}

/** `amount` times an authored damage multiplier, rounded down (SRD); no node when it is 1. */
export function multipliedDamage(id: string, amount: RuleInputBinding, multiplier: number) {
  return multiplier === 1
    ? { nodes: [], amount }
    : {
        nodes: [
          {
            id,
            operation: { key: DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY, contractVersion: 1 },
            inputs: { amount, multiplier: { kind: 'LITERAL' as const, value: multiplier } }
          }
        ],
        amount: { kind: 'NODE_OUTPUT' as const, nodeId: id, port: 'value' }
      }
}

export function boundedOutcome(outcome: Dnd5eAuthoredOutcome, killAdmitted: boolean): Outcome {
  if (outcome.effectKind === 'CONDITION') {
    uuid(outcome.conditionId, 'D&D condition definition identity')
    return { kind: 'CONDITION_APPLY', conditionId: outcome.conditionId }
  }
  if (outcome.effectKind === 'SCALAR_REDUCTION') {
    uuid(outcome.valueDefinitionId, 'D&D scalar definition identity')
    return {
      kind: 'SCALAR_REDUCTION',
      amount: 1,
      valueDefinitionId: outcome.valueDefinitionId,
      recoveryTriggers: outcome.recoveryTriggers,
      terminalConsequence: outcome.terminalConsequence
    }
  }
  if (outcome.effectKind === 'FORCED_MOVEMENT')
    return (
      settledForcedMovement(outcome) ??
      unsupported('D&D forced movement must move its target a distance in feet, at no cost to it.')
    )
  if (outcome.effectKind === 'KILL' && killAdmitted) return { kind: 'KILL' }
  const targetOnly = dnd5eTestPathTargetOnlyOutcome(outcome)
  if (targetOnly) return targetOnly
  if (outcome.effectKind !== 'HEAL' && outcome.effectKind !== 'DAMAGE')
    unsupported('D&D test action outcome is not supported.')
  if (
    outcome.valueKind !== 'FIXED' ||
    outcome.scalingKind !== 'NONE' ||
    outcome.bonuses?.length ||
    !Number.isSafeInteger(outcome.amount) ||
    outcome.amount <= 0
  )
    unsupported('D&D test action outcomes must use positive safe fixed amounts.')
  if (outcome.effectKind === 'HEAL')
    return {
      kind: outcome.temporary ? 'TEMPORARY_HIT_POINTS' : 'HEAL',
      amount: outcome.amount
    }
  uuid(outcome.damageTypeId, 'D&D damage type identity')
  return {
    kind: 'DAMAGE',
    amount: multipliedDamageAmount(outcome.amount, damageMultiplier(outcome)),
    damageTypeId: outcome.damageTypeId
  }
}

/**
 * An authored forced movement the room settles on the Scene (D105, D157): an exact or up-to distance
 * in feet, in any authored direction, that costs the target nothing. Null for any other forced
 * movement, which the System cannot settle yet.
 */
export function settledForcedMovement(outcome: {
  direction: string
  actionEconomy: string
  distanceMode: string
  amount?: number
  unit?: string
  collision?: ForcedMovementCollisionAuthored
}): Extract<Outcome, { kind: 'FORCED_MOVEMENT' }> | null {
  if (
    !isCharacterRuleActionForcedMovementDirection(outcome.direction) ||
    outcome.actionEconomy !== 'NONE' ||
    (outcome.distanceMode !== 'EXACT' && outcome.distanceMode !== 'UP_TO') ||
    outcome.unit !== 'FEET' ||
    typeof outcome.amount !== 'number' ||
    !Number.isSafeInteger(outcome.amount) ||
    outcome.amount <= 0
  )
    return null
  const collision = outcome.collision ? settledForcedMovementCollision(outcome.collision) : null
  if (outcome.collision && !collision) return null
  return {
    kind: 'FORCED_MOVEMENT',
    direction: outcome.direction,
    feet: outcome.amount,
    upTo: outcome.distanceMode === 'UP_TO',
    collision
  }
}

/**
 * The collision of an authored forced movement (D159), flat for the proposal. Null for one the System
 * cannot settle: a save that is not a fixed DC, or a damage or condition identity that is not a UUID.
 */
export function settledForcedMovementCollision(
  collision: ForcedMovementCollisionAuthored
): CharacterRuleActionForcedMovementCollision | null {
  const { savingThrow } = collision
  if (
    savingThrow.dcMethod !== 'FIXED_DC' ||
    savingThrow.bonuses?.length ||
    !Number.isSafeInteger(savingThrow.baseDc) ||
    !COLLISION_DICE_CONFIG.test(collision.diceConfig) ||
    !UUID.test(collision.damageTypeId) ||
    !UUID.test(savingThrow.abilityDefinitionId) ||
    !UUID.test(collision.conditionId)
  )
    return null
  return {
    diceConfig: collision.diceConfig,
    damageTypeId: collision.damageTypeId,
    abilityDefinitionId: savingThrow.abilityDefinitionId,
    dc: savingThrow.baseDc,
    conditionId: collision.conditionId
  }
}

/**
 * One evidence node per die plus the running sums, and the output that holds the rolled subtotal.
 * With `enabled` the dice ask for no request (and settle at 1) unless that output is true.
 */
export function rolledDiceNodes(
  term: BoundedDiceTerm,
  prefix: string,
  enabled?: { kind: 'NODE_OUTPUT'; nodeId: string; port: string }
) {
  const dieNodeId = (index: number) => `${prefix}die-${index + 1}`
  const sumNodeId = (index: number) => `${prefix}sum-${index + 1}`
  const diceNodes = Array.from({ length: term.count }, (_, index) => ({
    id: dieNodeId(index),
    operation: {
      key: enabled ? 'evidence.optional-integer-range' : 'evidence.integer-range',
      contractVersion: 1
    },
    inputs: {
      min: { kind: 'LITERAL' as const, value: 1 },
      max: { kind: 'LITERAL' as const, value: term.die },
      ...(enabled ? { enabled } : {})
    }
  }))
  const sumNodes = Array.from({ length: Math.max(0, term.count - 1) }, (_, index) => ({
    id: sumNodeId(index),
    operation: {
      key: addNumbersRuleOperation.key,
      contractVersion: addNumbersRuleOperation.contractVersion
    },
    inputs: {
      left:
        index === 0
          ? {
              kind: 'NODE_OUTPUT' as const,
              nodeId: dieNodeId(0),
              port: 'value'
            }
          : {
              kind: 'NODE_OUTPUT' as const,
              nodeId: sumNodeId(index - 1),
              port: 'value'
            },
      right: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: dieNodeId(index + 1),
        port: 'value'
      }
    }
  }))
  const subtotal =
    term.count === 1
      ? { kind: 'NODE_OUTPUT' as const, nodeId: dieNodeId(0), port: 'value' }
      : {
          kind: 'NODE_OUTPUT' as const,
          nodeId: sumNodeId(term.count - 2),
          port: 'value'
        }
  return { nodes: [...diceNodes, ...sumNodes], subtotal }
}

/** An outcome from the registry gated on a test node's result path, with the amount its own dice rolled. */
export function pathGatedProposalNode(input: {
  id: string
  pathCode: string
  testNodeId: string
  outcome: Outcome | EntryDiceDamageOutcome
  conditionImmuneFactKey: string | undefined
  amount?: RuleInputBinding
}) {
  const { outcome } = input
  if (outcome.kind === 'FORCED_MOVEMENT')
    unsupported('D&D forced movement resolves only in its selected outcome phase.')
  const definition = dnd5eOutcomeDefinition(outcome.kind)
  if (definition.pathGatedOperationKey === null) dnd5eUnsupportedPlanUnderTest(outcome.kind)
  return effectOutcomeProposalNode({
    id: input.id,
    definition,
    outcome,
    context: { conditionImmuneFactKey: input.conditionImmuneFactKey },
    target: DND5E_OUTCOME_TARGET,
    phase: {
      kind: 'PATH_GATED',
      resolvedPath: { kind: 'NODE_OUTPUT', nodeId: input.testNodeId, port: 'resultPath' },
      authoredPath: input.pathCode
    },
    extraInputs: input.amount ? { amount: input.amount } : {}
  })
}

export function validateDamageBonuses(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > 100)
    unsupported('D&D dice outcome bonuses exceed the bounded contract.')
  for (const bonus of value) {
    if (!bonus || typeof bonus !== 'object' || Array.isArray(bonus))
      unsupported('D&D dice outcome bonus is malformed.')
    const row = bonus as Record<string, unknown>
    if (
      (row.bonusKind !== 'ABILITY_BONUS' &&
        row.bonusKind !== 'SKILL_BONUS' &&
        row.bonusKind !== 'PROFICIENCY_BONUS') ||
      !Number.isSafeInteger(row.order) ||
      Number(row.order) < 0 ||
      (row.min !== undefined && !Number.isSafeInteger(row.min)) ||
      (row.max !== undefined && !Number.isSafeInteger(row.max)) ||
      (row.multiplier !== undefined && !Number.isSafeInteger(row.multiplier)) ||
      (row.bonusKind === 'ABILITY_BONUS' &&
        (typeof row.ability !== 'string' || row.ability.length === 0)) ||
      (row.bonusKind === 'SKILL_BONUS' &&
        (typeof row.skillId !== 'string' || row.skillId.length === 0))
    ) {
      unsupported('D&D dice outcome bonus is malformed.')
    }
  }
}
