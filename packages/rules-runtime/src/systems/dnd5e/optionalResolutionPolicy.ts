import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  activeOptionalCombatDefinitions,
  DND5E_MORALE_OPERATION_KEY,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatOutcomeDescriptorDto,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_CLEAVING_POLICY_MODULE } from './policyModuleRegistration.js'
const DND5E_MORALE_POLICY_MODULE = {
  key: DND5E_MORALE_OPERATION_KEY,
  contractVersion: 1
} as const

/** Attacker and initial target consume two Encounter actor identities. */
const MAX_DND5E_CLEAVING_TARGETS = MAX_ENCOUNTER_ACTORS - 2

type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]
type Resolution<T> =
  | { readonly kind: 'INERT' }
  | { readonly kind: 'JUDGMENT_REQUIRED'; readonly reason: string }
  | { readonly kind: 'NOT_APPLICABLE' }
  | { readonly kind: 'PROPOSED'; readonly proposal: T }

interface PolicyInput {
  readonly automationMode: AutomationModeDto
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

interface Dnd5eCleavingProposal {
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

interface Dnd5eMoraleProposal {
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

function resolveDnd5eMorale(
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
