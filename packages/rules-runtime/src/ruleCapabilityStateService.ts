import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  resolvedRuleCapabilityStateDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema,
  type ResolvedRuleCapabilityStateDto
} from '@artificer-toolkit/schema/shared/ruleState'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import {
  checksumRuleDocument,
  resolveRuleCapabilityAvailability
} from '@artificer-toolkit/shared/rules'

import {
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY
} from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'

export interface CurrentReusableDefinitionSource {
  requireCurrent(definitionId: string): Promise<ReusableDefinitionCurrentDto>
}

export function requireResolvedRuleCapabilityStateIntegrity(
  value: unknown
): ResolvedRuleCapabilityStateDto {
  const state = resolvedRuleCapabilityStateDtoSchema.parse(value)
  const { checksum, ...unsignedState } = state
  if (checksumRuleDocument(unsignedState) !== checksum)
    throw new Error('Resolved rule capability state checksum is invalid.')
  for (const definition of state.conditionDefinitions)
    if (checksumRuleDocument(definition.document) !== definition.definitionChecksum)
      throw new Error('Pinned condition rule-state definition checksum is invalid.')
  for (const capability of state.capabilities) {
    if (
      checksumRuleDocument(capability.capability.document) !==
      capability.capability.definitionChecksum
    )
      throw new Error('Pinned rule capability definition checksum is invalid.')
    const resolved = resolveRuleCapabilityAvailability({
      gameSystemId: state.gameSystemId,
      capabilityDefinitionId: capability.capability.capabilityDefinitionId,
      conditions: state.conditionDefinitions.map((definition) => definition.document),
      activeEffectSuppressions: (capability.activeEffectSuppressions ?? []).map((suppression) => ({
        ...suppression,
        capabilityDefinitionIds: [capability.capability.capabilityDefinitionId]
      }))
    })
    if (
      capability.available !== resolved.available ||
      capability.suppressingConditionDefinitionIds.join('\0') !==
        resolved.suppressingConditionDefinitionIds.join('\0') ||
      capability.suppressingActiveEffectIds.join('\0') !==
        resolved.suppressingActiveEffectIds.join('\0') ||
      (capability.activeEffectSuppressions ?? [])
        .map(({ activeEffectId, contributionId }) => `${activeEffectId}:${contributionId}`)
        .join('\0') !==
        resolved.activeEffectSuppressions
          .map(({ activeEffectId, contributionId }) => `${activeEffectId}:${contributionId}`)
          .join('\0') ||
      capability.contributionIds.join('\0') !== resolved.contributionIds.join('\0')
    )
      throw new Error('Resolved rule capability availability is inconsistent with its definitions.')
  }
  return state
}

function requireCurrentIntegrity(current: ReusableDefinitionCurrentDto): void {
  if (checksumRuleDocument(current.document) !== current.checksum)
    throw new Error('Current reusable definition checksum does not match its document.')
}

function uniqueSortedIds(values: readonly string[], label: string): string[] {
  const parsed = values.map((value) => serverUuidIdentityDtoSchema.parse(value)).sort()
  if (new Set(parsed).size !== parsed.length) throw new Error(`${label} identities must be unique.`)
  return parsed
}

/**
 * Resolves and freezes one actor's current condition-driven capability state.
 * Missing or cross-System definitions fail closed; labels never participate.
 */
export async function resolveRuleCapabilityState(input: {
  definitions: CurrentReusableDefinitionSource
  gameSystemId: string
  activeConditionDefinitionIds: readonly string[]
  capabilityDefinitionIds: readonly string[]
  activeEffectSuppressions?: readonly {
    activeEffectId: string
    contributionId: string
    capabilityDefinitionIds: readonly string[]
  }[]
}): Promise<ResolvedRuleCapabilityStateDto> {
  const gameSystemId = serverUuidIdentityDtoSchema.parse(input.gameSystemId)
  const conditionDefinitionIds = uniqueSortedIds(
    input.activeConditionDefinitionIds,
    'Active condition definition'
  )
  const capabilityDefinitionIds = uniqueSortedIds(
    input.capabilityDefinitionIds,
    'Rule capability definition'
  )

  const conditionDefinitions: ResolvedRuleCapabilityStateDto['conditionDefinitions'] = []
  for (const definitionId of conditionDefinitionIds) {
    const current = await input.definitions.requireCurrent(definitionId)
    requireCurrentIntegrity(current)
    if (
      current.id !== definitionId ||
      current.gameSystemId !== gameSystemId ||
      current.definitionFamilyKey !== CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY
    )
      throw new Error('Active condition rule-state definition does not match its actor or System.')
    const document = conditionRuleStateReusableDefinitionDocumentDtoSchema.parse(current.document)
    conditionDefinitions.push({
      conditionDefinitionId: definitionId,
      definitionVersion: current.version,
      definitionContractVersion: current.contractVersion,
      definitionChecksum: current.checksum,
      document
    })
  }

  const capabilities: ResolvedRuleCapabilityStateDto['capabilities'] = []
  for (const definitionId of capabilityDefinitionIds) {
    const current = await input.definitions.requireCurrent(definitionId)
    requireCurrentIntegrity(current)
    if (
      current.id !== definitionId ||
      current.gameSystemId !== gameSystemId ||
      current.definitionFamilyKey !== RULE_CAPABILITY_DEFINITION_FAMILY_KEY
    )
      throw new Error('Rule capability definition does not match its actor or System.')
    const document = ruleCapabilityReusableDefinitionDocumentDtoSchema.parse(current.document)
    const availability = resolveRuleCapabilityAvailability({
      gameSystemId,
      capabilityDefinitionId: definitionId,
      conditions: conditionDefinitions.map((condition) => condition.document),
      activeEffectSuppressions: input.activeEffectSuppressions ?? []
    })
    capabilities.push({
      capability: {
        capabilityDefinitionId: definitionId,
        definitionVersion: current.version,
        definitionContractVersion: current.contractVersion,
        definitionChecksum: current.checksum,
        document
      },
      available: availability.available,
      suppressingConditionDefinitionIds: [...availability.suppressingConditionDefinitionIds],
      suppressingActiveEffectIds: [...availability.suppressingActiveEffectIds],
      activeEffectSuppressions: availability.activeEffectSuppressions.map((suppression) => ({
        ...suppression
      })),
      contributionIds: [...availability.contributionIds]
    })
  }

  const state = {
    schemaVersion: 1 as const,
    gameSystemId,
    conditionDefinitions,
    capabilities
  }
  return requireResolvedRuleCapabilityStateIntegrity({
    ...state,
    checksum: checksumRuleDocument(state)
  })
}
