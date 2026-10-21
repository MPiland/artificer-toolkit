import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  sizeRank
} from '@artificer-toolkit/shared/core'
import {
  checksumRuleDocument,
  compareCanonicalD20Contributors
} from '@artificer-toolkit/shared/rules'

import type {
  DisarmContestProposal,
  DisarmPreparationInput,
  OptionalCombatD20Contributor,
  OptionalCombatPolicyInput,
  OptionalCombatPolicyPin,
  OptionalCombatResolution
} from '../../optionalCombatPolicyCapability.js'
import { dnd5eAttackKind } from './attackKind.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_DISARM_POLICY_MODULE } from './policyModuleRegistration.js'
import { resolveDnd5eRollMode } from './rollModePolicy.js'

type D20Influence = 'ADVANTAGE' | 'DISADVANTAGE'

type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]

function exactDefinition(
  input: OptionalCombatPolicyInput & {
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
    checksumCanonicalJson(parsed.data) !== input.optionalCombatSnapshotChecksum
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

function pin(definition: PolicyDefinition): OptionalCombatPolicyPin {
  return {
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    definitionChecksum: definition.definitionChecksum,
    moduleContractVersion: definition.document.module.contractVersion,
    moduleKey: definition.document.module.policyModuleKey
  }
}

function exactUuid(value: string): boolean {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

function canonicalContributors(
  contributors: readonly OptionalCombatD20Contributor[]
): readonly OptionalCombatD20Contributor[] | null {
  const ordered = [...contributors].sort(compareCanonicalD20Contributors)
  for (let index = 1; index < ordered.length; index += 1) {
    if (compareCanonicalD20Contributors(ordered[index - 1]!, ordered[index]!) === 0) return null
  }
  return ordered
}

function resolveMode(contributors: readonly OptionalCombatD20Contributor[]) {
  return resolveDnd5eRollMode(contributors).rollMode
}

function contributor(input: {
  definition: PolicyDefinition
  influence: D20Influence
  reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS' | 'SIZE_RELATION'
}): OptionalCombatD20Contributor {
  return {
    sourceId: checksumRuleDocument({
      definitionChecksum: input.definition.definitionChecksum,
      definitionId: input.definition.definitionId,
      definitionVersion: input.definition.definitionVersion,
      reason: input.reason
    }),
    grantId: null,
    domainKey: input.reason,
    influence: input.influence,
    source: { kind: 'AUTHORED', id: input.definition.definitionId, holderActorId: null }
  }
}

/**
 * Resolves every pinned D&D policy fact required before contest dice exist.
 * The Encounter layer carries this opaque result into its one-stage graph; it
 * never reconstructs size, handedness, or UUID check policy itself.
 */
export function prepareDnd5eDisarmContest(
  input: DisarmPreparationInput
): OptionalCombatResolution<DisarmContestProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'DISARM',
    module: DND5E_DISARM_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'DISARM') return { kind: 'INERT' }
  const attackerSizeRank = sizeRank(input.attackerSize)
  const targetSizeRank = sizeRank(input.targetSize)
  if (
    !exactUuid(input.attackerActorId) ||
    !exactUuid(input.targetActorId) ||
    input.attackerActorId === input.targetActorId ||
    input.triggerCode === null ||
    input.targetEquipment === null ||
    input.targetCheckDefinitionId === null ||
    !exactUuid(input.targetCheckDefinitionId) ||
    !parameters.defenderCheckDefinitionIds.includes(input.targetCheckDefinitionId) ||
    input.heldItemId === null ||
    !exactUuid(input.heldItemId) ||
    input.targetItemOwnerState === null ||
    attackerSizeRank === null ||
    targetSizeRank === null ||
    input.sourceEquipment === null ||
    input.attack === null ||
    input.attack.modifier === null ||
    !Number.isSafeInteger(input.attack.modifier) ||
    input.attack.rollMode === null ||
    input.attack.baseContributors === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_DISARM_FACTS' }
  }
  // Disarm replaces a weapon attack: only melee and ranged weapon attacks qualify.
  const attackKind = dnd5eAttackKind(input.triggerCode)
  if (
    (attackKind !== 'MELEE' && attackKind !== 'RANGED') ||
    input.sourceEquipment.category !== EQUIPMENT_CATEGORY_CODE.WEAPON ||
    (input.sourceEquipment.state !== 'EQUIPPED' && input.sourceEquipment.state !== 'HELD')
  )
    return { kind: 'NOT_APPLICABLE' }
  const baseContributors = canonicalContributors(input.attack.baseContributors[attackKind])
  const relationshipContributors = canonicalContributors(input.attack.relationshipContributors)
  if (
    baseContributors === null ||
    relationshipContributors === null ||
    resolveMode(baseContributors) !== input.attack.rollMode
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'DISARM_ATTACK_POLICY_UNRESOLVED' }
  }
  if (
    input.targetEquipment.properties.includes(EQUIPMENT_PROPERTY_CODE.VERSATILE) &&
    !input.targetEquipment.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'DISARM_GRIP_UNRESOLVED' }
  }
  const initiatorContributors: OptionalCombatD20Contributor[] = [
    ...baseContributors,
    ...relationshipContributors
  ]
  const targetContributors: OptionalCombatD20Contributor[] = []
  if (input.targetEquipment.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED))
    initiatorContributors.push(
      contributor({
        definition,
        influence: 'DISADVANTAGE',
        reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS'
      })
    )
  if (attackerSizeRank > targetSizeRank)
    targetContributors.push(
      contributor({ definition, influence: 'DISADVANTAGE', reason: 'SIZE_RELATION' })
    )
  if (targetSizeRank > attackerSizeRank)
    targetContributors.push(
      contributor({ definition, influence: 'ADVANTAGE', reason: 'SIZE_RELATION' })
    )
  const canonicalInitiatorContributors = canonicalContributors(initiatorContributors)
  const canonicalTargetContributors = canonicalContributors(targetContributors)
  if (canonicalInitiatorContributors === null || canonicalTargetContributors === null) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'DISARM_ATTACK_POLICY_UNRESOLVED' }
  }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      contest: {
        targetCheckDefinitionId: input.targetCheckDefinitionId,
        initiatorContributors: canonicalInitiatorContributors,
        targetContributors: canonicalTargetContributors,
        initiatorMode: resolveMode(canonicalInitiatorContributors),
        targetMode: resolveMode(canonicalTargetContributors)
      },
      disposition: {
        heldItemId: input.heldItemId,
        ownerActorId: input.targetActorId,
        ownerState: input.targetItemOwnerState,
        transition: 'NO_LONGER_HELD',
        placement: 'JUDGMENT_REQUIRED'
      }
    }
  }
}
