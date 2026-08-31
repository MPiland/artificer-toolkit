import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type { CharacterActionRuleEntryPoint } from '../character/characterActionRuleFacts.js'

/**
 * Server-only executable Effect capability. Aggregate-specific descriptors
 * extend this boundary without creating a second Effect compiler.
 */
export interface EffectActionCapabilityDescriptor {
  kind: 'CHARACTER_ACTION' | 'ENCOUNTER_FEATURE'
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
}

export interface CharacterActionCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'CHARACTER_ACTION'
  source: CharacterActionCandidate['source']
  mechanicsOwner: CharacterActionCandidate['mechanicsOwner']
  activationSourceKind: CharacterActionCandidate['activationSourceKind']
}

export interface CharacterActionCapabilityAdapter {
  gameSystemId: string
  authoredRootKind: 'effect'
  discover(input: {
    candidates: readonly CharacterActionCandidate[]
    conditionDefinitionIds?: readonly string[]
    abilityDefinitions?: readonly { id: string; code: string }[]
    entryPoints: readonly CharacterActionRuleEntryPoint[]
  }): readonly CharacterActionCapabilityDescriptor[]
}

function keyOf(
  adapter: Pick<CharacterActionCapabilityAdapter, 'gameSystemId' | 'authoredRootKind'>
) {
  return `${adapter.gameSystemId}\u0000${adapter.authoredRootKind}`
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
    const sourceEffectKey = `${descriptor.sourceId}\u0000${descriptor.effectId}`
    if (sourceEffectKeys.has(sourceEffectKey)) {
      throw new Error(
        'Character action capability discovery produced a duplicate source/Effect identity.'
      )
    }
    actionIds.add(descriptor.actionId)
    sourceEffectKeys.add(sourceEffectKey)
  }
}

export function createCharacterActionCapabilityDiscoveryRegistry(
  adapters: readonly CharacterActionCapabilityAdapter[]
) {
  const adaptersByKey = new Map<string, CharacterActionCapabilityAdapter>()
  for (const adapter of adapters) {
    requireCanonicalUuid(
      adapter.gameSystemId,
      'Character action capability adapter System identity'
    )
    const key = keyOf(adapter)
    if (adaptersByKey.has(key)) {
      throw new Error(`Duplicate Character action capability adapter: ${adapter.gameSystemId}.`)
    }
    adaptersByKey.set(key, adapter)
  }

  return {
    discover(input: {
      gameSystemId: string
      candidates: readonly CharacterActionCandidate[]
      conditionDefinitionIds?: readonly string[]
      abilityDefinitions?: readonly { id: string; code: string }[]
      entryPoints: readonly CharacterActionRuleEntryPoint[]
    }): readonly CharacterActionCapabilityDescriptor[] {
      requireCanonicalUuid(input.gameSystemId, 'Character action capability System identity')
      const adapter = adaptersByKey.get(keyOf({ ...input, authoredRootKind: 'effect' }))
      if (!adapter) return []
      const descriptors = adapter.discover({
        candidates: input.candidates,
        conditionDefinitionIds: input.conditionDefinitionIds ?? [],
        abilityDefinitions: input.abilityDefinitions ?? [],
        entryPoints: input.entryPoints
      })
      assertExactCandidateMapping({ ...input, descriptors })
      return descriptors
    }
  }
}
