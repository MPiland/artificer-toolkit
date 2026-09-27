import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { discoverEncounterFeatureActions } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { snapshotFeatureDefinitions } from './encounterActorState.js'
import type { EncounterFeatureActionCapabilityDescriptor } from './encounterFeatureActionCapabilityDiscovery.js'

type CompiledCharacterAction = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
>

export type EncounterActionSourceInput = {
  actor: EncounterRunActorState
  actionId: string
  gameSystemId: string
  characterSource?: {
    id: string
    streamVersion: number
    candidate: CharacterActionCandidate
    entry: CompiledCharacterAction
    effectivePolicyOutput: CharacterRulePolicyOutput
  }
  system?: SystemAuthoredDto
}

export type NativeEncounterActionSource =
  | {
      kind: 'CREATURE'
      actor: EncounterRunActorState
      capability: EncounterFeatureActionCapabilityDescriptor
    }
  | {
      kind: 'CHARACTER_ACTION'
      actor: EncounterRunActorState
      characterId: string
      characterStreamVersion: number
      candidate: CharacterActionCandidate
      entry: CompiledCharacterAction
      effectivePolicyOutput: CharacterRulePolicyOutput
    }

/** Resolves an action from current authoritative sources, never caller mechanics. */
export function resolveEncounterActionSource(
  input: EncounterActionSourceInput
): NativeEncounterActionSource {
  const { actor } = input
  if (actor.systemId !== input.gameSystemId)
    throw new Error('Encounter action source does not match the Encounter Game System.')
  if (actor.kind === 'CHARACTER') {
    const character = input.characterSource
    if (
      !character ||
      actor.sourceId !== character.id ||
      actor.systemId !== input.gameSystemId ||
      character.entry.actionId !== input.actionId ||
      character.entry.effectId !== character.candidate.effectId
    )
      throw new Error('The selected Character action source is stale.')
    return {
      kind: 'CHARACTER_ACTION',
      actor,
      characterId: character.id,
      characterStreamVersion: character.streamVersion,
      candidate: character.candidate,
      entry: character.entry,
      effectivePolicyOutput: character.effectivePolicyOutput
    }
  }
  if (actor.kind !== 'CREATURE')
    throw new Error('Native action execution requires an action source.')
  const system = input.system
  if (!system || system.id !== input.gameSystemId)
    throw new Error('The selected Creature action source is stale.')
  const abilities =
    'abilities' in system && Array.isArray(system.abilities)
      ? system.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
      : []
  const actions = discoverEncounterFeatureActions({
    actor,
    conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: abilities
  })
  const capability = actions.available.find((value) => value.actionId === input.actionId)
  if (!capability) {
    const unavailable = actions.unavailable.find((value) => value.actionId === input.actionId)
    throw new Error(
      unavailable
        ? `${unavailable.label} is unavailable: ${unavailable.reason}`
        : 'The selected Creature action source is stale.'
    )
  }
  return { kind: 'CREATURE', actor, capability }
}

/**
 * The Creature's Legendary Action Features. Their options run only in a Legendary window at the end
 * of another creature's turn, never as the Creature's own turn action (D63).
 */
export function encounterLegendaryActionFeatureIds(
  actor: EncounterRunActorState
): ReadonlySet<string> {
  return new Set(
    snapshotFeatureDefinitions(actor)
      .filter((feature) => feature.section === 'LEGENDARY_ACTION')
      .map((feature) => feature.id)
  )
}

/** The action's display name for logs and prompts; a Character action may have none. */
export function encounterActionSourceLabel(source: NativeEncounterActionSource): string | null {
  return source.kind === 'CREATURE' ? source.capability.label : (source.candidate.label ?? null)
}
