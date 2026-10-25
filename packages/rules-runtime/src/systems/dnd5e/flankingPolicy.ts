import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  resolvedRuleCapabilityAvailabilityDtoSchema,
  type ResolvedRuleCapabilityAvailabilityDto
} from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  enumerateSquareGridFootprint,
  findSquareGridFlankingPairs,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

import type {
  FlankingInput,
  FlankingParticipant,
  OptionalCombatD20Contributor,
  OptionalCombatPolicyInput
} from '../../optionalCombatPolicyCapability.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_FLANKING_POLICY_MODULE } from './policyModuleRegistration.js'

const MAX_FLANKING_CANDIDATES = 256

function canonicalUuid(value: unknown): string | null {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value ? parsed.data : null
}

/** Whether a participant holds the definition-selected capability, intact and available. */
function holdsExactCapability(input: {
  expectedDefinitionId: string
  capability: ResolvedRuleCapabilityAvailabilityDto | null
  gameSystemId: string
}): boolean {
  const parsed = resolvedRuleCapabilityAvailabilityDtoSchema.safeParse(input.capability)
  if (!parsed.success) return false
  const capability = parsed.data.capability
  return (
    capability.capabilityDefinitionId === input.expectedDefinitionId &&
    capability.document.gameSystemId === input.gameSystemId &&
    checksumRuleDocument(capability.document) === capability.definitionChecksum &&
    parsed.data.available
  )
}

function resolveFlankingDefinition(
  input: OptionalCombatPolicyInput
): EncounterOptionalCombatSnapshotDto['definitions'][number] | null {
  if (
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
      definition.document.kind === 'FLANKING' &&
      checksumRuleDocument(definition.document) === definition.definitionChecksum &&
      definition.document.module.policyModuleKey === DND5E_FLANKING_POLICY_MODULE.key &&
      definition.document.module.contractVersion === DND5E_FLANKING_POLICY_MODULE.contractVersion
  )
  if (matches.length !== 1) return null
  return matches[0]!
}

/** The capability the current Flanking definition requires of each participant; null when it is off. */
export function dnd5eFlankingParticipantCapabilityDefinitionId(
  input: OptionalCombatPolicyInput
): string | null {
  const definition = resolveFlankingDefinition(input)
  if (!definition || definition.document.parameters.kind !== 'FLANKING') return null
  return canonicalUuid(definition.document.parameters.participantCapabilityDefinitionId)
}

function validActorTokenFact(input: { actorId: string; token: Pick<SceneToken, 'id'> }): boolean {
  return canonicalUuid(input.actorId) !== null && canonicalUuid(input.token.id) !== null
}

/**
 * The D&D optional flanking contributor: a melee attacker that sees its hostile target has
 * advantage while an ally that also sees it, and is hostile to it, stands on the opposite side
 * of it on a square grid. Both need the definition's participant capability (an incapacitated
 * creature has none). It neither resolves a roll nor chooses an action target.
 */
export function resolveDnd5eFlankingContributor(
  input: FlankingInput
): OptionalCombatD20Contributor | null {
  if (
    !input.melee ||
    input.grid.kind !== 'SQUARE' ||
    input.alliedCandidates.length > MAX_FLANKING_CANDIDATES ||
    input.attacker.targetRelationship !== 'HOSTILE' ||
    !input.attacker.canSeeTarget ||
    !validActorTokenFact(input.attacker) ||
    !validActorTokenFact(input.target)
  ) {
    return null
  }
  const definition = resolveFlankingDefinition(input)
  const capabilityDefinitionId = dnd5eFlankingParticipantCapabilityDefinitionId(input)
  if (!definition || capabilityDefinitionId === null) return null
  const holdsCapability = (participant: FlankingParticipant) =>
    holdsExactCapability({
      expectedDefinitionId: capabilityDefinitionId,
      capability: participant.participantCapability,
      gameSystemId: input.gameSystemId
    })
  if (!holdsCapability(input.attacker)) return null

  const actorIds = new Set<string>([input.attacker.actorId, input.target.actorId])
  const tokenIds = new Set<string>([input.attacker.token.id, input.target.token.id])
  if (actorIds.size !== 2 || tokenIds.size !== 2) return null
  for (const candidate of input.alliedCandidates) {
    if (
      !validActorTokenFact(candidate) ||
      actorIds.has(candidate.actorId) ||
      tokenIds.has(candidate.token.id)
    ) {
      return null
    }
    actorIds.add(candidate.actorId)
    tokenIds.add(candidate.token.id)
  }

  const attackerFootprint = enumerateSquareGridFootprint(input.grid, input.attacker.token)
  const targetFootprint = enumerateSquareGridFootprint(input.grid, input.target.token)
  if (!attackerFootprint || !targetFootprint) return null

  const flanked = input.alliedCandidates.some((candidate) => {
    if (
      candidate.attackerRelationship !== 'ALLIED' ||
      candidate.targetRelationship !== 'HOSTILE' ||
      !candidate.canSeeTarget ||
      !holdsCapability(candidate)
    )
      return false
    const footprint = enumerateSquareGridFootprint(input.grid, candidate.token)
    return (
      footprint !== null &&
      findSquareGridFlankingPairs({
        allied: footprint,
        attacker: attackerFootprint,
        grid: input.grid,
        target: targetFootprint
      }).length > 0
    )
  })
  return flanked
    ? {
        sourceId: definition.definitionId,
        grantId: null,
        domainKey: DND5E_FLANKING_POLICY_MODULE.key,
        influence: 'ADVANTAGE',
        source: { kind: 'AUTHORED', id: definition.definitionId, holderActorId: null }
      }
    : null
}
