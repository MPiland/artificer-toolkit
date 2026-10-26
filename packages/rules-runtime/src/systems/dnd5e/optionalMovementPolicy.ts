import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { compileEffect } from '@artificer-toolkit/shared/compilers'

import {
  exactOptionalCombatDefinition,
  optionalCombatPolicyPin,
  type OptionalCombatPolicyDefinition
} from './optionalCombatDefinition.js'
import {
  DND5E_CLIMB_ONTO_LARGER_CREATURE_POLICY_MODULE,
  DND5E_OVERRUN_POLICY_MODULE,
  DND5E_TUMBLE_POLICY_MODULE
} from './policyModuleRegistration.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { relationshipPlan } from './effectActionCompiler.js'
import { resolveDnd5eRollMode } from './rollModePolicy.js'
import type {
  ClimbOntoContestProposal,
  ClimbOntoPreparationInput,
  MovementPassageProposal,
  OptionalCombatPolicyInput,
  OptionalCombatResolution,
  OptionalMovementContributor,
  PassageAppliedEffect,
  OverrunContestProposal,
  OverrunPreparationInput,
  TumbleContestProposal,
  TumblePreparationInput
} from '../../optionalCombatPolicyCapability.js'

function exactUuid(value: string): boolean {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

function validSizeRank(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0
}

function sizeContributor(input: {
  readonly definitionId: string
  readonly initiatorSizeRank: number
  readonly targetSizeRank: number
}): OptionalMovementContributor | null {
  if (input.initiatorSizeRank === input.targetSizeRank) return null
  return {
    id: `${input.definitionId}:size-relation`,
    influence: input.initiatorSizeRank > input.targetSizeRank ? 'ADVANTAGE' : 'DISADVANTAGE',
    reason: 'SIZE_RELATION'
  }
}

function resolvedInitiatorD20(
  definition: OptionalCombatPolicyDefinition,
  initiatorSizeRank: number,
  targetSizeRank: number,
  qualifiedContributors: readonly OptionalMovementContributor[]
) {
  const contributors = [...qualifiedContributors]
  const contribution = sizeContributor({
    definitionId: definition.definitionId,
    initiatorSizeRank,
    targetSizeRank
  })
  if (contribution) contributors.push(contribution)
  return { contributors, rollMode: resolveDnd5eRollMode(contributors).rollMode }
}

type ValidPassageFacts<TInput extends TumblePreparationInput> = TInput & {
  readonly actionEconomy: NonNullable<TumblePreparationInput['actionEconomy']>
  readonly actionEconomyAvailable: boolean
  readonly passageAlreadyUsedThisTurn: boolean
}

function validCommonPassageFacts<
  TInput extends TumblePreparationInput & {
    readonly initiatorSizeRank: number | null
    readonly targetSizeRank: number | null
  }
>(
  input: TInput
): input is ValidPassageFacts<
  TInput & { readonly initiatorSizeRank: number; readonly targetSizeRank: number }
> {
  return (
    exactUuid(input.initiatorActorId) &&
    exactUuid(input.blockerActorId) &&
    input.initiatorActorId !== input.blockerActorId &&
    input.actionEconomy !== null &&
    input.actionEconomyAvailable !== null &&
    input.passageAlreadyUsedThisTurn !== null &&
    validSizeRank(input.initiatorSizeRank) &&
    validSizeRank(input.targetSizeRank)
  )
}

function passage(blockerActorId: string): MovementPassageProposal {
  return {
    kind: 'PASS_THROUGH_HOSTILE',
    hostileActorId: blockerActorId,
    currentTurnOnly: true,
    opportunityAttackSuppression: false,
    prohibitEndingInOccupiedSpace: true
  }
}

/** Seals an available Overrun contest before either participant rolls. */
export function prepareDnd5eOverrunContest(
  input: OverrunPreparationInput
): OptionalCombatResolution<OverrunContestProposal> {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'OVERRUN',
    module: DND5E_OVERRUN_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'OVERRUN') return { kind: 'INERT' }
  if (!validCommonPassageFacts(input)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_OVERRUN_FACTS' }
  }
  const economy = input.actionEconomy
  if (economy === null || !input.actionEconomyAvailable || input.passageAlreadyUsedThisTurn) {
    return { kind: 'NOT_APPLICABLE' }
  }
  const d20 = resolvedInitiatorD20(
    definition,
    input.initiatorSizeRank,
    input.targetSizeRank,
    input.qualifiedInitiatorContributors
  )
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: optionalCombatPolicyPin(definition),
      consumes: { economy, amount: 1 },
      contest: {
        initiatorCheckDefinitionId: parameters.initiatorCheckDefinitionId,
        targetCheckDefinitionId: parameters.targetCheckDefinitionId,
        initiatorContributors: d20.contributors,
        initiatorMode: d20.rollMode
      },
      passage: passage(input.blockerActorId)
    }
  }
}

function validTumbleFacts(
  input: TumblePreparationInput
): input is ValidPassageFacts<TumblePreparationInput> {
  return (
    exactUuid(input.initiatorActorId) &&
    exactUuid(input.blockerActorId) &&
    input.initiatorActorId !== input.blockerActorId &&
    input.actionEconomy !== null &&
    input.actionEconomyAvailable !== null &&
    input.passageAlreadyUsedThisTurn !== null
  )
}

/** Seals an available Tumble contest before either participant rolls. */
export function prepareDnd5eTumbleContest(
  input: TumblePreparationInput
): OptionalCombatResolution<TumbleContestProposal> {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'TUMBLE',
    module: DND5E_TUMBLE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'TUMBLE') return { kind: 'INERT' }
  if (!validTumbleFacts(input)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_TUMBLE_FACTS' }
  }
  const economy = input.actionEconomy
  if (economy === null || !input.actionEconomyAvailable || input.passageAlreadyUsedThisTurn) {
    return { kind: 'NOT_APPLICABLE' }
  }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: optionalCombatPolicyPin(definition),
      consumes: { economy, amount: 1 },
      contest: {
        initiatorCheckDefinitionId: parameters.initiatorCheckDefinitionId,
        targetCheckDefinitionId: parameters.targetCheckDefinitionId
      },
      passage: passage(input.blockerActorId)
    }
  }
}

/**
 * Seals an available climb-onto contest before either participant rolls: the target must be at
 * least the authored number of sizes larger, the economy authored, and the check one of the
 * climber's authored choices.
 */
export function prepareDnd5eClimbOntoContest(
  input: ClimbOntoPreparationInput
): OptionalCombatResolution<ClimbOntoContestProposal> {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'CLIMB_ONTO_LARGER_CREATURE',
    module: DND5E_CLIMB_ONTO_LARGER_CREATURE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'CLIMB_ONTO_LARGER_CREATURE') return { kind: 'INERT' }
  if (!validCommonPassageFacts(input)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLIMB_ONTO_FACTS' }
  }
  const economy = input.actionEconomy
  if (
    economy === null ||
    !input.actionEconomyAvailable ||
    input.passageAlreadyUsedThisTurn ||
    !parameters.economies.includes(economy) ||
    !parameters.initiatorCheckDefinitionIds.includes(input.initiatorCheckDefinitionId) ||
    input.targetSizeRank - input.initiatorSizeRank < parameters.minimumTargetSizeSteps
  ) {
    return { kind: 'NOT_APPLICABLE' }
  }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: optionalCombatPolicyPin(definition),
      consumes: { economy, amount: 1 },
      contest: {
        initiatorCheckDefinitionId: input.initiatorCheckDefinitionId,
        targetCheckDefinitionId: parameters.targetCheckDefinitionId
      }
    }
  }
}

/**
 * The cling an enabled climb-onto rule gives the creature a won climb passed: its authored relationship
 * Effect, planned like a contest hold's. None while the rule is off.
 */
export function dnd5ePassageAppliedEffects(
  input: OptionalCombatPolicyInput
): readonly PassageAppliedEffect[] {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'CLIMB_ONTO_LARGER_CREATURE',
    module: DND5E_CLIMB_ONTO_LARGER_CREATURE_POLICY_MODULE
  })
  if (definition?.document.parameters.kind !== 'CLIMB_ONTO_LARGER_CREATURE') return []
  const { effect } = definition.document.parameters
  const plan = relationshipPlan({
    gameSystemId: DND5E_SYSTEM_ID,
    entryPointDefinitionId: effect.id,
    effectId: effect.id,
    compiledEffect: compileEffect(effect)
  })
  if (!plan) throw new Error('D&D passage-applied effect must author one relationship.')
  return [
    {
      definitionId: optionalCombatPolicyPin(definition).definitionId,
      effectId: effect.id,
      label: definition.label,
      plan
    }
  ]
}
