import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_CLEAVING_POLICY_MODULE } from './policyModuleRegistration.js'
import { dnd5eFacingRule } from './facingPolicy.js'
import { dnd5eMassiveDamageRule, dnd5eMassiveDamageSaveFacts } from './massiveDamagePolicy.js'
import {
  dnd5eFlankingParticipantCapabilityDefinitionId,
  resolveDnd5eFlankingContributor
} from './flankingPolicy.js'
import { prepareDnd5eDisarmContest } from './optionalActionPolicy.js'
import { prepareDnd5eOverrunContest, prepareDnd5eTumbleContest } from './optionalMovementPolicy.js'
import {
  exactOptionalCombatDefinition,
  optionalCombatPolicyPin
} from './optionalCombatDefinition.js'
import { offerDnd5eMoraleTriggers, prepareDnd5eMoraleSave } from './moralePolicy.js'
import { dnd5eConsequenceRollTables } from './injuriesPolicy.js'
import { dnd5eAttackAppliedEffects } from './optionalMarkPolicy.js'
import type {
  CleavingInput,
  CleavingProposal,
  OptionalCombatPolicyCapabilityAdapter,
  OptionalCombatResolution
} from '../../optionalCombatPolicyCapability.js'

/** Attacker and initial target consume two Encounter actor identities. */
const MAX_DND5E_CLEAVING_TARGETS = MAX_ENCOUNTER_ACTORS - 2

function canonicalUuid(value: string): boolean {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

function isSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value)
}

function validCleavingChain(input: {
  readonly attackerActorId: string
  readonly chainStep: number
  readonly eligibleTargetActorIds: readonly string[] | null
  readonly initialTargetActorId: string
  readonly visitedTargetActorIds: readonly string[] | null
}): boolean {
  if (
    input.eligibleTargetActorIds === null ||
    input.visitedTargetActorIds === null ||
    input.eligibleTargetActorIds.length === 0 ||
    input.eligibleTargetActorIds.length > MAX_DND5E_CLEAVING_TARGETS ||
    input.visitedTargetActorIds.length === 0 ||
    input.visitedTargetActorIds.length > MAX_DND5E_CLEAVING_TARGETS + 1 ||
    input.visitedTargetActorIds[0] !== input.initialTargetActorId ||
    input.chainStep !== input.visitedTargetActorIds.length - 1
  ) {
    return false
  }
  const eligible = new Set<string>()
  for (const actorId of input.eligibleTargetActorIds) {
    if (
      !canonicalUuid(actorId) ||
      actorId === input.attackerActorId ||
      actorId === input.initialTargetActorId ||
      eligible.has(actorId)
    ) {
      return false
    }
    eligible.add(actorId)
  }
  const visited = new Set<string>()
  for (const actorId of input.visitedTargetActorIds) {
    if (!canonicalUuid(actorId) || actorId === input.attackerActorId || visited.has(actorId)) {
      return false
    }
    visited.add(actorId)
  }
  return true
}

function canonicalizeCleavingCandidates(candidateActorIds: readonly string[]): readonly string[] {
  return [...candidateActorIds].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

/** Proposes one exact next target; later outcome settlement owns damage application and further chaining. */
export function resolveDnd5eCleaving(
  input: CleavingInput
): OptionalCombatResolution<CleavingProposal> {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'CLEAVING',
    module: DND5E_CLEAVING_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (definition.document.parameters.kind !== 'CLEAVING') return { kind: 'INERT' }
  if (
    input.attackKind === null ||
    !isSafeInteger(input.attackTotal) ||
    !canonicalUuid(input.attackerActorId) ||
    !canonicalUuid(input.initialTargetActorId) ||
    input.attackerActorId === input.initialTargetActorId ||
    input.initialTargetReducedToZero === null ||
    input.initialTargetWasUndamaged === null ||
    input.mixedDamageOrRiderAmbiguity === null ||
    !isSafeInteger(input.chainStep) ||
    input.chainStep < 0 ||
    !isSafeInteger(input.remainingFinalDamage) ||
    !validCleavingChain({
      attackerActorId: input.attackerActorId,
      chainStep: input.chainStep ?? -1,
      eligibleTargetActorIds: input.eligibleTargetActorIds,
      initialTargetActorId: input.initialTargetActorId,
      visitedTargetActorIds: input.visitedTargetActorIds
    })
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLEAVING_FACTS' }
  }
  if (input.attackKind !== definition.document.parameters.qualifyingAttackKind) {
    return { kind: 'NOT_APPLICABLE' }
  }
  if (input.mixedDamageOrRiderAmbiguity) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'AMBIGUOUS_CLEAVING_DAMAGE' }
  }
  if (
    !input.initialTargetReducedToZero ||
    !input.initialTargetWasUndamaged ||
    input.remainingFinalDamage <= 0
  ) {
    return { kind: 'NOT_APPLICABLE' }
  }
  if (input.nextTarget === null) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'CLEAVING_TARGET_REQUIRED' }
  }
  if (
    !canonicalUuid(input.nextTarget.actorId) ||
    input.nextTarget.actorId === input.attackerActorId ||
    input.nextTarget.actorId === input.initialTargetActorId ||
    input.eligibleTargetActorIds === null ||
    input.visitedTargetActorIds === null ||
    !input.eligibleTargetActorIds.includes(input.nextTarget.actorId) ||
    input.visitedTargetActorIds.includes(input.nextTarget.actorId) ||
    !isSafeInteger(input.nextTarget.armorClass) ||
    input.nextTarget.withinAttackerReach === null ||
    input.nextTarget.originalAttackResolution === null ||
    !isSafeInteger(input.nextTarget.originalAttackResolution.naturalRoll) ||
    input.nextTarget.originalAttackResolution.naturalRoll < 1 ||
    input.nextTarget.originalAttackResolution.naturalRoll > 20 ||
    input.nextTarget.originalAttackResolution.originalAttackCanHitNextTarget === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLEAVING_TARGET_FACTS' }
  }
  const { naturalRoll, originalAttackCanHitNextTarget } = input.nextTarget.originalAttackResolution
  if (
    (naturalRoll === 1 && originalAttackCanHitNextTarget) ||
    (naturalRoll === 20 && !originalAttackCanHitNextTarget)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'CONTRADICTORY_CLEAVING_ATTACK_RESOLUTION' }
  }
  if (!input.nextTarget.withinAttackerReach || !originalAttackCanHitNextTarget)
    return { kind: 'NOT_APPLICABLE' }
  const eligibleTargetActorIds = canonicalizeCleavingCandidates(input.eligibleTargetActorIds)
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: optionalCombatPolicyPin(definition),
      chainStep: input.chainStep + 1,
      attackTotal: input.attackTotal,
      eligibleTargetActorIds,
      remainingFinalDamage: input.remainingFinalDamage,
      nextTargetActorId: input.nextTarget.actorId,
      visitedTargetActorIds: [...input.visitedTargetActorIds, input.nextTarget.actorId]
    }
  }
}

export const dnd5eOptionalCombatPolicyCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  prepareDisarmContest: prepareDnd5eDisarmContest,
  prepareOverrunContest: prepareDnd5eOverrunContest,
  prepareTumbleContest: prepareDnd5eTumbleContest,
  resolveCleaving: resolveDnd5eCleaving,
  offerMoraleTriggers: offerDnd5eMoraleTriggers,
  prepareMoraleSave: prepareDnd5eMoraleSave,
  consequenceRollTables: dnd5eConsequenceRollTables,
  attackAppliedEffects: dnd5eAttackAppliedEffects,
  facingRule: dnd5eFacingRule,
  flankingParticipantCapabilityDefinitionId: dnd5eFlankingParticipantCapabilityDefinitionId,
  resolveFlanking: resolveDnd5eFlankingContributor,
  massiveDamageRule: dnd5eMassiveDamageRule,
  massiveDamageSaveFacts: dnd5eMassiveDamageSaveFacts
} as const satisfies OptionalCombatPolicyCapabilityAdapter
