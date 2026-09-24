import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  activeOptionalCombatDefinitions,
  DND5E_HITTING_COVER_OPERATION_KEY,
  DND5E_INJURIES_OPERATION_KEY,
  DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
  DND5E_MORALE_OPERATION_KEY,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatOutcomeDescriptorDto,
  type Dnd5eOptionalCombatRecoveryDescriptorDto,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_CLEAVING_POLICY_MODULE } from './policyModuleRegistration.js'

export { DND5E_CLEAVING_POLICY_MODULE } from './policyModuleRegistration.js'
export const DND5E_HITTING_COVER_POLICY_MODULE = {
  key: DND5E_HITTING_COVER_OPERATION_KEY,
  contractVersion: 1
} as const
export const DND5E_INJURIES_POLICY_MODULE = {
  key: DND5E_INJURIES_OPERATION_KEY,
  contractVersion: 1
} as const
export const DND5E_MASSIVE_DAMAGE_POLICY_MODULE = {
  key: DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
  contractVersion: 1
} as const
export const DND5E_MORALE_POLICY_MODULE = {
  key: DND5E_MORALE_OPERATION_KEY,
  contractVersion: 1
} as const

/** Attacker and initial target consume two Encounter actor identities. */
export const MAX_DND5E_CLEAVING_TARGETS = MAX_ENCOUNTER_ACTORS - 2

type AutomationMode = 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]
type Resolution<T> =
  | { readonly kind: 'INERT' }
  | { readonly kind: 'JUDGMENT_REQUIRED'; readonly reason: string }
  | { readonly kind: 'NOT_APPLICABLE' }
  | { readonly kind: 'PROPOSED'; readonly proposal: T }

interface PolicyInput {
  readonly automationMode: AutomationMode
  readonly gameSystemId: string
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
}

export interface Dnd5eOptionalResolutionPin {
  readonly definitionChecksum: string
  readonly definitionId: string
  readonly definitionVersion: number
  readonly moduleContractVersion: number
  readonly moduleKey: string
}

function exactDefinition(
  input: PolicyInput & {
    readonly kind: Dnd5eOptionalCombatRuleKindDto
    readonly module: { readonly key: string; readonly contractVersion: number }
  }
): PolicyDefinition | null {
  if (
    input.automationMode === 'MANUAL' ||
    input.gameSystemId !== DND5E_SYSTEM_ID ||
    input.optionalCombatSnapshot === null ||
    input.optionalCombatSnapshotChecksum === null
  ) {
    return null
  }
  const parsed = encounterOptionalCombatSnapshotDtoSchema.safeParse(input.optionalCombatSnapshot)
  if (
    !parsed.success ||
    parsed.data.gameSystemId !== input.gameSystemId ||
    checksumRuleDocument(parsed.data) !== input.optionalCombatSnapshotChecksum
  ) {
    return null
  }
  const matches = activeOptionalCombatDefinitions({
    automationMode: input.automationMode,
    snapshot: parsed.data
  }).filter(
    (definition) =>
      definition.document.kind === input.kind &&
      checksumRuleDocument(definition.document) === definition.definitionChecksum &&
      definition.document.module.policyModuleKey === input.module.key &&
      definition.document.module.contractVersion === input.module.contractVersion
  )
  return matches.length === 1 ? matches[0]! : null
}

function pin(definition: PolicyDefinition): Dnd5eOptionalResolutionPin {
  return {
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    definitionChecksum: definition.definitionChecksum,
    moduleKey: definition.document.module.policyModuleKey,
    moduleContractVersion: definition.document.module.contractVersion
  }
}

function canonicalUuid(value: string): boolean {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

function isSafeInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value)
}

function findBand<TBand extends { readonly minimum: number; readonly maximum: number }>(
  bands: readonly TBand[],
  roll: number
): TBand | null {
  return bands.find((band) => roll >= band.minimum && roll <= band.maximum) ?? null
}

function hasValidMoraleTriggerScope(
  trigger: NonNullable<Parameters<typeof resolveDnd5eMorale>[0]['trigger']>
): boolean {
  switch (trigger.kind) {
    case 'INDIVIDUAL_SURPRISED':
    case 'INDIVIDUAL_REDUCED_TO_HALF':
    case 'INDIVIDUAL_CANNOT_HARM_OPPOSITION':
      return trigger.scope === 'INDIVIDUAL'
    case 'GROUP_SURPRISED':
    case 'GROUP_HALF_REMOVED':
    case 'GROUP_LEADER_REMOVED':
    case 'GROUP_LEADER_INCAPACITATED':
    case 'GROUP_LEADER_TAKEN_PRISONER':
      return trigger.scope === 'GROUP'
  }
}

export interface Dnd5eHittingCoverRedirectProposal {
  readonly attackTotal: number
  readonly coverProviderActorId: string
  readonly coveredTargetActorId: string
  readonly pin: Dnd5eOptionalResolutionPin
  readonly redirect: 'COVER_PROVIDER'
}

/** Proposes only the creature-cover redirect; application remains in ordered outcome settlement. */
export function resolveDnd5eHittingCover(
  input: PolicyInput & {
    readonly attackKind: 'RANGED' | 'OTHER' | null
    readonly attackTotal: number | null
    readonly attackResolution: {
      readonly naturalRoll: number | null
      readonly missedBecauseOfCover: boolean | null
      readonly wouldHitProtectedTargetWithoutCover: boolean | null
    } | null
    readonly coveredTargetActorId: string
    readonly coveredTargetArmorClass: number | null
    readonly coverProviders:
      | readonly {
          readonly actorId: string | null
          readonly armorClass: number | null
          readonly kind: 'CREATURE' | 'OBJECT' | 'TERRAIN' | 'BARRIER'
        }[]
      | null
  }
): Resolution<Dnd5eHittingCoverRedirectProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'HITTING_COVER',
    module: DND5E_HITTING_COVER_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (definition.document.parameters.kind !== 'HITTING_COVER') return { kind: 'INERT' }
  if (
    input.attackKind === null ||
    !isSafeInteger(input.attackTotal) ||
    !isSafeInteger(input.coveredTargetArmorClass) ||
    !canonicalUuid(input.coveredTargetActorId) ||
    input.attackResolution === null ||
    !isSafeInteger(input.attackResolution.naturalRoll) ||
    input.attackResolution.naturalRoll < 1 ||
    input.attackResolution.naturalRoll > 20 ||
    input.attackResolution.missedBecauseOfCover === null ||
    input.attackResolution.wouldHitProtectedTargetWithoutCover === null ||
    input.coverProviders === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_HITTING_COVER_FACTS' }
  }
  if (input.attackKind !== definition.document.parameters.qualifyingAttackKind)
    return { kind: 'NOT_APPLICABLE' }
  const { naturalRoll, missedBecauseOfCover, wouldHitProtectedTargetWithoutCover } =
    input.attackResolution
  if (
    (naturalRoll === 1 && (missedBecauseOfCover || wouldHitProtectedTargetWithoutCover)) ||
    (naturalRoll === 20 && (!wouldHitProtectedTargetWithoutCover || missedBecauseOfCover)) ||
    (naturalRoll !== 1 &&
      naturalRoll !== 20 &&
      missedBecauseOfCover &&
      !wouldHitProtectedTargetWithoutCover)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'CONTRADICTORY_HITTING_COVER_RESOLUTION' }
  }
  if (naturalRoll === 1 || naturalRoll === 20 || !missedBecauseOfCover) {
    return { kind: 'NOT_APPLICABLE' }
  }
  if (input.coverProviders.length !== 1) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'AMBIGUOUS_COVER_PROVIDER' }
  }
  const provider = input.coverProviders[0]!
  if (
    provider.kind !== definition.document.parameters.redirectCoverProviderKinds[0] ||
    provider.actorId === null ||
    provider.armorClass === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'UNSUPPORTED_COVER_PROVIDER' }
  }
  if (!canonicalUuid(provider.actorId) || !isSafeInteger(provider.armorClass)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_COVER_PROVIDER_FACTS' }
  }
  if (input.attackTotal <= provider.armorClass) return { kind: 'NOT_APPLICABLE' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      redirect: 'COVER_PROVIDER',
      attackTotal: input.attackTotal,
      coveredTargetActorId: input.coveredTargetActorId,
      coverProviderActorId: provider.actorId
    }
  }
}

export interface Dnd5eCleavingProposal {
  readonly attackTotal: number
  readonly chainStep: number
  readonly eligibleTargetActorIds: readonly string[]
  readonly nextTargetActorId: string
  readonly pin: Dnd5eOptionalResolutionPin
  readonly remainingFinalDamage: number
  readonly visitedTargetActorIds: readonly string[]
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
  input: PolicyInput & {
    readonly attackKind: 'MELEE' | 'OTHER' | null
    readonly attackTotal: number | null
    readonly attackerActorId: string
    readonly chainStep: number | null
    readonly eligibleTargetActorIds: readonly string[] | null
    readonly initialTargetActorId: string
    readonly initialTargetReducedToZero: boolean | null
    readonly initialTargetWasUndamaged: boolean | null
    readonly mixedDamageOrRiderAmbiguity: boolean | null
    readonly nextTarget: {
      readonly actorId: string
      readonly armorClass: number | null
      readonly withinAttackerReach: boolean | null
      readonly originalAttackResolution: {
        readonly naturalRoll: number | null
        readonly originalAttackCanHitNextTarget: boolean | null
      } | null
    } | null
    readonly remainingFinalDamage: number | null
    readonly visitedTargetActorIds: readonly string[] | null
  }
): Resolution<Dnd5eCleavingProposal> {
  const definition = exactDefinition({
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
      pin: pin(definition),
      chainStep: input.chainStep + 1,
      attackTotal: input.attackTotal,
      eligibleTargetActorIds,
      remainingFinalDamage: input.remainingFinalDamage,
      nextTargetActorId: input.nextTarget.actorId,
      visitedTargetActorIds: [...input.visitedTargetActorIds, input.nextTarget.actorId]
    }
  }
}

interface Dnd5eConsequenceProposal {
  readonly consequence: Dnd5eOptionalCombatOutcomeDescriptorDto
  readonly pin: Dnd5eOptionalResolutionPin
  readonly recovery: Dnd5eOptionalCombatRecoveryDescriptorDto | null
  readonly tableRoll: number
}

export function resolveDnd5eMassiveDamage(
  input: PolicyInput & {
    readonly damageSourceCount: number | null
    readonly finalizedAppliedDamage: number | null
    readonly maximumHitPoints: number | null
    readonly savingThrow: {
      readonly abilityDefinitionId: string
      readonly total: number | null
    } | null
    readonly tableRoll: number | null
  }
): Resolution<Dnd5eConsequenceProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'MASSIVE_DAMAGE',
    module: DND5E_MASSIVE_DAMAGE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (definition.document.parameters.kind !== 'MASSIVE_DAMAGE') return { kind: 'INERT' }
  if (
    !isSafeInteger(input.damageSourceCount) ||
    !isSafeInteger(input.finalizedAppliedDamage) ||
    !isSafeInteger(input.maximumHitPoints) ||
    input.damageSourceCount < 1 ||
    input.finalizedAppliedDamage < 0 ||
    input.maximumHitPoints <= 0
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MASSIVE_DAMAGE_FACTS' }
  }
  if (input.damageSourceCount !== 1)
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MULTIPLE_DAMAGE_SOURCES' }
  const threshold = Math.ceil(
    (input.maximumHitPoints * definition.document.parameters.threshold.numerator) /
      definition.document.parameters.threshold.denominator
  )
  if (input.finalizedAppliedDamage < threshold) return { kind: 'NOT_APPLICABLE' }
  if (
    input.savingThrow === null ||
    input.savingThrow.abilityDefinitionId !==
      definition.document.parameters.savingThrowAbilityDefinitionId ||
    !isSafeInteger(input.savingThrow.total) ||
    !isSafeInteger(input.tableRoll)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MASSIVE_DAMAGE_SAVE_FACTS' }
  }
  if (input.savingThrow.total >= definition.document.parameters.savingThrowDifficultyClass)
    return { kind: 'NOT_APPLICABLE' }
  const band = findBand(definition.document.parameters.bands, input.tableRoll)
  if (band === null)
    return { kind: 'JUDGMENT_REQUIRED', reason: 'INVALID_MASSIVE_DAMAGE_TABLE_ROLL' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      tableRoll: input.tableRoll,
      consequence: band.outcome,
      recovery: band.recovery
    }
  }
}

export function resolveDnd5eInjury(
  input: PolicyInput & {
    readonly anatomy: 'SUPPORTED' | 'UNSUPPORTED' | 'JUDGMENT_REQUIRED' | null
    readonly recoveryContext: 'SUPPORTED' | 'UNSUPPORTED' | 'JUDGMENT_REQUIRED' | null
    readonly tableRoll: number | null
    readonly trigger: {
      readonly authorized: boolean
      readonly kind: 'CRITICAL_HIT' | 'DROP_TO_ZERO' | 'FAIL_DEATH_SAVE_BY_FIVE_OR_MORE'
    } | null
  }
): Resolution<Dnd5eConsequenceProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'INJURIES',
    module: DND5E_INJURIES_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (definition.document.parameters.kind !== 'INJURIES') return { kind: 'INERT' }
  if (input.trigger === null) return { kind: 'NOT_APPLICABLE' }
  if (
    !input.trigger.authorized ||
    !definition.document.parameters.triggerKinds.includes(input.trigger.kind)
  )
    return { kind: 'JUDGMENT_REQUIRED', reason: 'INJURY_TRIGGER_NOT_AUTHORIZED' }
  if (input.anatomy === null || input.recoveryContext === null || !isSafeInteger(input.tableRoll))
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_INJURY_FACTS' }
  if (input.anatomy !== 'SUPPORTED')
    return { kind: 'JUDGMENT_REQUIRED', reason: 'INJURY_ANATOMY_UNRESOLVED' }
  if (input.recoveryContext !== 'SUPPORTED')
    return { kind: 'JUDGMENT_REQUIRED', reason: 'INJURY_RECOVERY_UNRESOLVED' }
  const band = findBand(definition.document.parameters.bands, input.tableRoll)
  if (band === null) return { kind: 'JUDGMENT_REQUIRED', reason: 'INVALID_INJURY_TABLE_ROLL' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      tableRoll: input.tableRoll,
      consequence: band.outcome,
      recovery: band.recovery
    }
  }
}

export interface Dnd5eMoraleProposal {
  readonly evidence: {
    readonly automaticFailure: boolean
    readonly rollMode: 'NORMAL' | 'DISADVANTAGE'
    readonly triggerKind:
      | 'INDIVIDUAL_SURPRISED'
      | 'INDIVIDUAL_REDUCED_TO_HALF'
      | 'INDIVIDUAL_CANNOT_HARM_OPPOSITION'
      | 'GROUP_SURPRISED'
      | 'GROUP_HALF_REMOVED'
      | 'GROUP_LEADER_REMOVED'
      | 'GROUP_LEADER_INCAPACITATED'
      | 'GROUP_LEADER_TAKEN_PRISONER'
    readonly triggerScope: 'GROUP' | 'INDIVIDUAL'
  } & (
    | { readonly rollerActorId: string; readonly rollerKind: 'SELF' }
    | { readonly rollerActorId: string; readonly rollerKind: 'LEADER_OR_FALLBACK' }
  )
  readonly pin: Dnd5eOptionalResolutionPin
  readonly resolution: Dnd5eOptionalCombatOutcomeDescriptorDto
  readonly routeOrTerms: 'JUDGMENT_REQUIRED' | null
}

export function resolveDnd5eMorale(
  input: PolicyInput & {
    readonly overwhelmingOpposition: boolean | null
    readonly escapePossible: boolean | null
    readonly trigger:
      | {
          readonly scope: 'INDIVIDUAL'
          readonly kind:
            | 'INDIVIDUAL_SURPRISED'
            | 'INDIVIDUAL_REDUCED_TO_HALF'
            | 'INDIVIDUAL_CANNOT_HARM_OPPOSITION'
          readonly fact: 'SURPRISED' | 'HALF_HIT_POINTS_REACHED' | 'CANNOT_HARM_OPPOSITION'
          readonly satisfied: boolean
        }
      | {
          readonly scope: 'GROUP'
          readonly kind: 'GROUP_HALF_REMOVED'
          readonly fact: 'HALF_PARTICIPANTS_REMOVED'
          readonly satisfied: true
          readonly opposingSideHasLosses: false
        }
      | {
          readonly scope: 'GROUP'
          readonly kind:
            | 'GROUP_SURPRISED'
            | 'GROUP_LEADER_REMOVED'
            | 'GROUP_LEADER_INCAPACITATED'
            | 'GROUP_LEADER_TAKEN_PRISONER'
          readonly fact:
            | 'GROUP_SURPRISED'
            | 'LEADER_REMOVED'
            | 'LEADER_INCAPACITATED'
            | 'LEADER_TAKEN_PRISONER'
            | 'OPPONENT_REMOVED'
          readonly satisfied: boolean
        }
      | null
    readonly individualSavingThrow: {
      readonly actorId: string
      readonly savingThrowAbilityDefinitionId: string
      readonly savingThrowTotal: number | null
    } | null
    readonly leaderOrFallback: {
      readonly selectedActorId: string
      readonly selection:
        | {
            readonly kind: 'LEADER'
            readonly leaderActorId: string
            readonly leaderIsEligible: true
          }
        | {
            readonly kind: 'FALLBACK'
            readonly leaderIsEligible: false
            readonly selectedHasHighestEligibleMorale: true
          }
      readonly savingThrowAbilityDefinitionId: string
      readonly savingThrowTotal: number | null
    } | null
  }
): Resolution<Dnd5eMoraleProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'MORALE',
    module: DND5E_MORALE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (definition.document.parameters.kind !== 'MORALE') return { kind: 'INERT' }
  if (input.trigger === null) return { kind: 'NOT_APPLICABLE' }
  const expectedFact = {
    INDIVIDUAL_SURPRISED: 'SURPRISED',
    INDIVIDUAL_REDUCED_TO_HALF: 'HALF_HIT_POINTS_REACHED',
    INDIVIDUAL_CANNOT_HARM_OPPOSITION: 'CANNOT_HARM_OPPOSITION',
    GROUP_SURPRISED: 'GROUP_SURPRISED',
    GROUP_HALF_REMOVED: 'HALF_PARTICIPANTS_REMOVED',
    GROUP_LEADER_REMOVED: 'LEADER_REMOVED',
    GROUP_LEADER_INCAPACITATED: 'LEADER_INCAPACITATED',
    GROUP_LEADER_TAKEN_PRISONER: 'LEADER_TAKEN_PRISONER'
  } as const
  if (
    !hasValidMoraleTriggerScope(input.trigger) ||
    !input.trigger.satisfied ||
    (input.trigger.kind === 'GROUP_HALF_REMOVED' &&
      input.trigger.opposingSideHasLosses !== false) ||
    expectedFact[input.trigger.kind] !== input.trigger.fact ||
    !definition.document.parameters.triggerKinds.includes(input.trigger.kind)
  )
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_TRIGGER_NOT_AUTHORIZED' }
  if (input.overwhelmingOpposition === null || input.escapePossible === null) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MORALE_FACTS' }
  }
  const groupRoller = input.trigger.scope === 'GROUP' ? input.leaderOrFallback : null
  const roller = input.trigger.scope === 'INDIVIDUAL' ? input.individualSavingThrow : groupRoller
  const rollerActorId =
    input.trigger.scope === 'INDIVIDUAL'
      ? input.individualSavingThrow?.actorId
      : input.leaderOrFallback?.selectedActorId
  if (
    roller === null ||
    rollerActorId === undefined ||
    !canonicalUuid(rollerActorId) ||
    roller.savingThrowAbilityDefinitionId !==
      definition.document.parameters.savingThrowAbilityDefinitionId ||
    !isSafeInteger(roller.savingThrowTotal)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MORALE_ROLLER_FACTS' }
  }
  if (
    groupRoller !== null &&
    ((groupRoller.selection.kind === 'LEADER' &&
      (groupRoller.selection.leaderActorId !== groupRoller.selectedActorId ||
        groupRoller.selection.leaderIsEligible !== true)) ||
      (groupRoller.selection.kind === 'LEADER' &&
        !canonicalUuid(groupRoller.selection.leaderActorId)) ||
      (groupRoller.selection.kind === 'FALLBACK' &&
        groupRoller.selection.selectedHasHighestEligibleMorale !== true))
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_LEADER_SELECTION_UNVERIFIED' }
  }
  const rollMode = input.overwhelmingOpposition
    ? definition.document.parameters.overwhelmingOpposition.rollMode
    : 'NORMAL'
  const automaticFailure =
    input.overwhelmingOpposition &&
    definition.document.parameters.overwhelmingOpposition.automaticFailure
  const outcomeKind =
    !automaticFailure &&
    roller.savingThrowTotal >= definition.document.parameters.savingThrowDifficultyClass
      ? 'CONTINUE'
      : !input.escapePossible
        ? 'SURRENDER'
        : 'FLEE'
  const outcomes =
    input.trigger.scope === 'INDIVIDUAL'
      ? definition.document.parameters.individualOutcomes
      : definition.document.parameters.groupOutcomes
  const resolution = outcomes.find((outcome) => outcome.kind === outcomeKind)
  if (
    resolution === undefined ||
    (resolution.kind !== 'CONTINUE' &&
      resolution.kind !== 'FLEE' &&
      resolution.kind !== 'SURRENDER')
  )
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MORALE_OUTCOME' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      resolution,
      evidence: {
        triggerKind: input.trigger.kind,
        triggerScope: input.trigger.scope,
        rollMode,
        automaticFailure,
        rollerActorId,
        rollerKind: input.trigger.scope === 'INDIVIDUAL' ? 'SELF' : 'LEADER_OR_FALLBACK'
      },
      routeOrTerms: outcomeKind === 'CONTINUE' ? null : 'JUDGMENT_REQUIRED'
    }
  }
}
