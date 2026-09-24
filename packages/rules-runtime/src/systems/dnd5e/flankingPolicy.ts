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
  type SceneGrid,
  type SceneToken,
  type SquareGridFlankingPair
} from '@artificer-toolkit/shared/vtt'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_FLANKING_POLICY_MODULE } from './policyModuleRegistration.js'

export { DND5E_FLANKING_POLICY_MODULE } from './policyModuleRegistration.js'

const MAX_FLANKING_CANDIDATES = 256

type RelationshipKind = 'ALLIED' | 'HOSTILE' | 'NEUTRAL'

interface Dnd5eFlankingCapabilityFact {
  readonly availability: ResolvedRuleCapabilityAvailabilityDto
  readonly availabilityChecksum: string
}

interface Dnd5eFlankingCombatant {
  readonly actorId: string
  readonly participantCapability: Dnd5eFlankingCapabilityFact
  readonly token: Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>
}

export interface Dnd5eFlankingCandidate extends Dnd5eFlankingCombatant {
  readonly attackerRelationship: RelationshipKind
  readonly canSeeTarget: boolean
  readonly targetRelationship: RelationshipKind
}

export interface Dnd5eFlankingContributor {
  readonly domainKey: typeof DND5E_FLANKING_POLICY_MODULE.key
  readonly geometry: {
    readonly alliedActorId: string
    readonly alliedCellId: string
    readonly alliedSector: SquareGridFlankingPair['alliedSector']
    readonly alliedTokenId: string
    readonly attackerParticipantCapabilityDefinitionChecksum: string
    readonly attackerCellId: string
    readonly attackerSector: SquareGridFlankingPair['attackerSector']
    readonly flankingDefinitionChecksum: string
    readonly flankingDefinitionId: string
    readonly participantCapabilityDefinitionChecksum: string
    readonly participantCapabilityDefinitionId: string
    readonly targetActorId: string
    readonly targetTokenId: string
  }
  readonly grantId: null
  readonly influence: 'ADVANTAGE'
  readonly sourceId: string
}

export interface Dnd5eFlankingPolicyResult {
  readonly contributor: Dnd5eFlankingContributor | null
}

function canonicalUuid(value: unknown): string | null {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value ? parsed.data : null
}

function resolveExactCapability(input: {
  expectedDefinitionId: string
  fact: Dnd5eFlankingCapabilityFact
  gameSystemId: string
}): ResolvedRuleCapabilityAvailabilityDto | null {
  const parsed = resolvedRuleCapabilityAvailabilityDtoSchema.safeParse(input.fact.availability)
  if (!parsed.success || checksumRuleDocument(parsed.data) !== input.fact.availabilityChecksum)
    return null
  const capability = parsed.data.capability
  if (
    capability.capabilityDefinitionId !== input.expectedDefinitionId ||
    capability.document.gameSystemId !== input.gameSystemId ||
    checksumRuleDocument(capability.document) !== capability.definitionChecksum ||
    !parsed.data.available
  ) {
    return null
  }
  return parsed.data
}

function resolveFlankingDefinition(input: {
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  gameSystemId: string
  optionalCombatSnapshot: unknown
  optionalCombatSnapshotChecksum: string | null | undefined
}): EncounterOptionalCombatSnapshotDto['definitions'][number] | null {
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

/** Resolves only the current definition-selected positional capability identity. */
export function resolveDnd5eFlankingParticipantCapabilityDefinitionIds(input: {
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  gameSystemId: string
  optionalCombatSnapshot: unknown
  optionalCombatSnapshotChecksum: string | null | undefined
}): readonly string[] {
  const definition = resolveFlankingDefinition(input)
  if (!definition || definition.document.parameters.kind !== 'FLANKING') return []
  const capabilityDefinitionId = canonicalUuid(
    definition.document.parameters.participantCapabilityDefinitionId
  )
  return capabilityDefinitionId === null ? [] : [capabilityDefinitionId]
}

function validActorTokenFact(input: { actorId: string; token: Pick<SceneToken, 'id'> }): boolean {
  return canonicalUuid(input.actorId) !== null && canonicalUuid(input.token.id) !== null
}

/**
 * Qualifies the D&D optional flanking contributor from frozen source pins and
 * authoritative geometry/fact inputs. It neither resolves a roll nor chooses
 * an action target; d20 cancellation and Encounter execution remain separate.
 */
export function resolveDnd5eFlankingContributor(input: {
  readonly alliedCandidates: readonly Dnd5eFlankingCandidate[]
  readonly attackClassification: 'MELEE' | 'OTHER'
  readonly attacker: Dnd5eFlankingCombatant & {
    readonly canSeeTarget: boolean
    readonly targetRelationship: RelationshipKind
  }
  readonly automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  readonly gameSystemId: string
  readonly grid: SceneGrid
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
  readonly target: {
    readonly actorId: string
    readonly token: Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>
  }
}): Dnd5eFlankingPolicyResult {
  if (
    input.attackClassification !== 'MELEE' ||
    input.grid.kind !== 'SQUARE' ||
    input.alliedCandidates.length > MAX_FLANKING_CANDIDATES ||
    input.attacker.targetRelationship !== 'HOSTILE' ||
    !input.attacker.canSeeTarget ||
    !validActorTokenFact(input.attacker) ||
    !validActorTokenFact(input.target)
  ) {
    return { contributor: null }
  }
  const definition = resolveFlankingDefinition(input)
  const capabilityDefinitionIds = resolveDnd5eFlankingParticipantCapabilityDefinitionIds(input)
  if (
    !definition ||
    definition.document.parameters.kind !== 'FLANKING' ||
    capabilityDefinitionIds.length !== 1
  )
    return { contributor: null }

  const capabilityDefinitionId = capabilityDefinitionIds[0]!
  const attackerCapability = resolveExactCapability({
    expectedDefinitionId: capabilityDefinitionId,
    fact: input.attacker.participantCapability,
    gameSystemId: input.gameSystemId
  })
  if (!attackerCapability) return { contributor: null }

  const actorIds = new Set<string>([input.attacker.actorId, input.target.actorId])
  const tokenIds = new Set<string>([input.attacker.token.id, input.target.token.id])
  if (actorIds.size !== 2 || tokenIds.size !== 2) return { contributor: null }
  for (const candidate of input.alliedCandidates) {
    if (
      !validActorTokenFact(candidate) ||
      actorIds.has(candidate.actorId) ||
      tokenIds.has(candidate.token.id)
    ) {
      return { contributor: null }
    }
    actorIds.add(candidate.actorId)
    tokenIds.add(candidate.token.id)
  }

  const attackerFootprint = enumerateSquareGridFootprint(input.grid, input.attacker.token)
  const targetFootprint = enumerateSquareGridFootprint(input.grid, input.target.token)
  if (!attackerFootprint || !targetFootprint) return { contributor: null }

  const qualifying = input.alliedCandidates
    .map((candidate) => {
      if (
        candidate.attackerRelationship !== 'ALLIED' ||
        candidate.targetRelationship !== 'HOSTILE' ||
        !candidate.canSeeTarget ||
        !validActorTokenFact(candidate)
      ) {
        return null
      }
      const capability = resolveExactCapability({
        expectedDefinitionId: capabilityDefinitionId,
        fact: candidate.participantCapability,
        gameSystemId: input.gameSystemId
      })
      const footprint = enumerateSquareGridFootprint(input.grid, candidate.token)
      if (!capability || !footprint) return null
      const pairs = findSquareGridFlankingPairs({
        allied: footprint,
        attacker: attackerFootprint,
        grid: input.grid,
        target: targetFootprint
      })
      const pair = pairs[0]
      if (!pair) return null
      return { candidate, capability, pair }
    })
    .filter(
      (
        value
      ): value is {
        candidate: Dnd5eFlankingCandidate
        capability: ResolvedRuleCapabilityAvailabilityDto
        pair: SquareGridFlankingPair
      } => value !== null
    )
    .sort(
      (left, right) =>
        left.candidate.actorId.localeCompare(right.candidate.actorId) ||
        left.candidate.token.id.localeCompare(right.candidate.token.id) ||
        left.pair.attackerCell.id.localeCompare(right.pair.attackerCell.id) ||
        left.pair.alliedCell.id.localeCompare(right.pair.alliedCell.id)
    )
  const selected = qualifying[0]
  if (!selected) return { contributor: null }

  return {
    contributor: {
      sourceId: definition.definitionId,
      grantId: null,
      domainKey: DND5E_FLANKING_POLICY_MODULE.key,
      influence: 'ADVANTAGE',
      geometry: {
        flankingDefinitionId: definition.definitionId,
        flankingDefinitionChecksum: definition.definitionChecksum,
        participantCapabilityDefinitionId: capabilityDefinitionId,
        attackerParticipantCapabilityDefinitionChecksum:
          attackerCapability.capability.definitionChecksum,
        participantCapabilityDefinitionChecksum: selected.capability.capability.definitionChecksum,
        attackerCellId: selected.pair.attackerCell.id,
        attackerSector: selected.pair.attackerSector,
        alliedActorId: selected.candidate.actorId,
        alliedTokenId: selected.candidate.token.id,
        alliedCellId: selected.pair.alliedCell.id,
        alliedSector: selected.pair.alliedSector,
        targetActorId: input.target.actorId,
        targetTokenId: input.target.token.id
      }
    }
  }
}
