import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type { CharacterActionRuleEntryPoint } from '@artificer-toolkit/schema/api/characterActionRules'

import { characterActionCapabilityRegistry } from './platformPolicyModules.js'

/**
 * Server-only executable Effect capability. Aggregate-specific descriptors
 * extend this boundary without creating a second Effect compiler.
 */
export interface EffectActionCapabilityDescriptor {
  kind:
    | 'CHARACTER_ACTION'
    | 'CHARACTER_SPELL_CAST'
    | 'ENCOUNTER_FEATURE'
    | 'BASIC_ACTION'
    | 'REPEAT_PATH'
    | 'RULE'
  gameSystemId: string
  authoredRootKind: 'effect'
  entryPointDefinitionId: string
  effectId: string
  actionId: string
  sourceId: string
  /** Exact normalized mechanics from the matching aggregate-owned Effect action. */
  mechanicFacts: CharacterActionCandidate['mechanicFacts']
  /** Exact UUID-backed condition definitions from the source's pinned System vocabulary. */
  conditionDefinitionIds?: readonly string[]
  /** Exact pinned System ability identity for an authored saving throw, if any. */
  savingThrowAbilityDefinitionId?: string | null
  /** Exact server-only compiled Effect retained from the authorized source boundary. */
  compiledEffect: CharacterActionRuleEntryPoint['compiledEffect']
  /** The level a spell cast is made at, which selects the scaling row the compiler rolls. */
  spellCastLevel?: number
  /** The Character's level, which selects a cap scaled by it (Eldritch Blast's beams). */
  characterLevel?: number
  /**
   * Set when the action's test is the save made over the zone it places as it appears (D154): its
   * area is the zone's, so it may be a wall.
   */
  zoneAppearSave?: true
  /** Set for an at-will grant's cast whose targets are each locked out of the grant (D156). */
  perTargetLockout?: { grantId: string }
}

export interface CharacterActionCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'CHARACTER_ACTION'
  source: CharacterActionCandidate['source']
  mechanicsOwner: CharacterActionCandidate['mechanicsOwner']
  activationSourceKind: CharacterActionCandidate['activationSourceKind']
}

export interface CharacterActionCapabilityAdapter {
  gameSystemId: string
  discover(input: {
    candidates: readonly CharacterActionCandidate[]
    conditionDefinitionIds?: readonly string[]
    abilityDefinitions?: readonly { id: string; code: string }[]
    entryPoints: readonly CharacterActionRuleEntryPoint[]
  }): readonly CharacterActionCapabilityDescriptor[]
}

function requireCanonicalUuid(value: string, label: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success || parsed.data !== value) {
    throw new Error(`${label} must be a canonical PostgreSQL UUID.`)
  }
  return parsed.data
}

function assertExactCandidateMapping(input: {
  gameSystemId: string
  candidates: readonly CharacterActionCandidate[]
  conditionDefinitionIds?: readonly string[]
  abilityDefinitions?: readonly { id: string; code: string }[]
  entryPoints: readonly CharacterActionRuleEntryPoint[]
  descriptors: readonly CharacterActionCapabilityDescriptor[]
}): void {
  if (
    input.descriptors.length !== input.candidates.length ||
    input.entryPoints.length !== input.candidates.length
  ) {
    throw new Error(
      'Character action capability discovery must return every input candidate exactly once.'
    )
  }
  const actionIds = new Set<string>()
  const sourceEffectKeys = new Set<string>()
  for (const [index, candidate] of input.candidates.entries()) {
    const entryPointDefinitionId = requireCanonicalUuid(
      candidate.effectId,
      `Character action capability entry point at index ${index}`
    )
    const descriptor = input.descriptors[index]
    const entryPoint = input.entryPoints[index]
    if (
      descriptor === undefined ||
      descriptor.kind !== 'CHARACTER_ACTION' ||
      descriptor.gameSystemId !== input.gameSystemId ||
      descriptor.authoredRootKind !== 'effect' ||
      descriptor.entryPointDefinitionId !== entryPointDefinitionId ||
      descriptor.effectId !== entryPointDefinitionId ||
      descriptor.actionId !== candidate.actionId ||
      descriptor.sourceId !== candidate.sourceId ||
      descriptor.activationSourceKind !== candidate.activationSourceKind ||
      JSON.stringify(descriptor.mechanicFacts) !== JSON.stringify(candidate.mechanicFacts) ||
      JSON.stringify(descriptor.conditionDefinitionIds ?? []) !==
        JSON.stringify(input.conditionDefinitionIds ?? []) ||
      entryPoint === undefined ||
      entryPoint.actionId !== candidate.actionId ||
      entryPoint.effectId !== entryPointDefinitionId ||
      entryPoint.sourceId !== candidate.sourceId ||
      JSON.stringify(entryPoint.source) !== JSON.stringify(candidate.source) ||
      JSON.stringify(entryPoint.mechanicsOwner) !== JSON.stringify(candidate.mechanicsOwner) ||
      entryPoint.activationSourceKind !== candidate.activationSourceKind ||
      entryPoint.compiledEffect.id !== entryPointDefinitionId ||
      descriptor.compiledEffect !== entryPoint.compiledEffect ||
      descriptor.spellCastLevel !== entryPoint.spellCastLevel ||
      descriptor.characterLevel !== entryPoint.characterLevel ||
      descriptor.perTargetLockout?.grantId !== entryPoint.perTargetLockout?.grantId ||
      JSON.stringify(descriptor.source) !== JSON.stringify(candidate.source) ||
      JSON.stringify(descriptor.mechanicsOwner) !== JSON.stringify(candidate.mechanicsOwner)
    ) {
      throw new Error(
        `Character action capability discovery produced an invalid descriptor at index ${index}.`
      )
    }
    if (actionIds.has(descriptor.actionId)) {
      throw new Error('Character action capability discovery produced a duplicate action identity.')
    }
    // A Feature attack made with the wielded weapons is one action per weapon attack (D156), each
    // its own action identity.
    const sourceEffectKey =
      candidate.activationSourceKind === 'ACTIVE_SOURCE_AND_EQUIPMENT'
        ? descriptor.actionId
        : `${descriptor.sourceId}\u0000${descriptor.effectId}`
    if (sourceEffectKeys.has(sourceEffectKey)) {
      throw new Error(
        'Character action capability discovery produced a duplicate source/Effect identity.'
      )
    }
    actionIds.add(descriptor.actionId)
    sourceEffectKeys.add(sourceEffectKey)
  }
}

export function discoverCharacterActionCapabilities(input: {
  gameSystemId: string
  candidates: readonly CharacterActionCandidate[]
  conditionDefinitionIds?: readonly string[]
  abilityDefinitions?: readonly { id: string; code: string }[]
  entryPoints: readonly CharacterActionRuleEntryPoint[]
}): readonly CharacterActionCapabilityDescriptor[] {
  requireCanonicalUuid(input.gameSystemId, 'Character action capability System identity')
  const adapter = characterActionCapabilityRegistry.require(input.gameSystemId)
  const descriptors = adapter.discover({
    candidates: input.candidates,
    conditionDefinitionIds: input.conditionDefinitionIds ?? [],
    abilityDefinitions: input.abilityDefinitions ?? [],
    entryPoints: input.entryPoints
  })
  assertExactCandidateMapping({ ...input, descriptors })
  return descriptors
}
