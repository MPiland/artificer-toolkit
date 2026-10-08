import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_CLEAVING_POLICY_MODULE } from './policyModuleRegistration.js'

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
