import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { characterFormCreatureView } from './encounterActorForm.js'
import { StaleCharacterActionError, UnavailableCreatureActionError } from './encounterErrors.js'
import { discoverEncounterFeatureActions } from './encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { snapshotFeatureDefinitions } from './encounterActorState.js'
import type { EncounterFeatureActionCapabilityDescriptor } from './encounterFeatureActionCapabilityDiscovery.js'
import {
  discoverEncounterBasicActions,
  isEncounterBasicActionId,
  type EncounterBasicActionCapabilityDescriptor,
  type EncounterBasicActionEntry
} from './encounterBasicActionCapabilityDiscovery.js'

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
  /** The System's current authored basic actions, read for a basic action's identity. */
  basicActions?: readonly EncounterBasicActionEntry[]
}

/** What a caller names; the loader adds the System and the basic action the id names. */
export type EncounterActionSourceRequest = Omit<
  EncounterActionSourceInput,
  'system' | 'basicActions'
>

export type NativeEncounterActionSource =
  | {
      kind: 'CREATURE'
      actor: EncounterRunActorState
      capability: EncounterFeatureActionCapabilityDescriptor
    }
  | {
      kind: 'BASIC_ACTION'
      actor: EncounterRunActorState
      capability: EncounterBasicActionCapabilityDescriptor
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

/** The ability definitions a System authors, as Creature discovery reads them. */
export function systemAbilityDefinitions(system: SystemAuthoredDto) {
  return 'abilities' in system && Array.isArray(system.abilities)
    ? system.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
    : []
}

/** Resolves an action from current authoritative sources, never caller mechanics. */
export function resolveEncounterActionSource(
  input: EncounterActionSourceInput
): NativeEncounterActionSource {
  const { actor } = input
  if (actor.systemId !== input.gameSystemId)
    throw new Error('Encounter action source does not match the Encounter Game System.')
  if (isEncounterBasicActionId(actor.id, input.actionId)) {
    const { system } = input
    if (!system || system.id !== input.gameSystemId)
      throw new Error('The selected basic action source is stale.')
    const capability = discoverEncounterBasicActions({
      actorId: actor.id,
      gameSystemId: input.gameSystemId,
      entries: input.basicActions ?? [],
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: systemAbilityDefinitions(system)
    }).available.find((value) => value.actionId === input.actionId)
    if (!capability) throw new Error('The selected basic action source is stale.')
    return { kind: 'BASIC_ACTION', actor, capability }
  }
  // A Character in a creature form acts from the form's stat block, not its Sheet (SPELLS-28.T4d).
  const creature = actor.kind === 'CHARACTER' ? characterFormCreatureView(actor) : actor
  if (actor.kind === 'CHARACTER' && creature === null) {
    const character = input.characterSource
    if (
      !character ||
      actor.sourceId !== character.id ||
      actor.systemId !== input.gameSystemId ||
      character.entry.actionId !== input.actionId ||
      character.entry.effectId !== character.candidate.effectId
    )
      throw new StaleCharacterActionError('The selected Character action source is stale.')
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
  if (creature?.kind !== 'CREATURE')
    throw new Error('Native action execution requires an action source.')
  const system = input.system
  if (!system || system.id !== input.gameSystemId)
    throw new Error('The selected Creature action source is stale.')
  const actions = discoverEncounterFeatureActions({
    actor: creature,
    conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: systemAbilityDefinitions(system)
  })
  const capability = actions.available.find((value) => value.actionId === input.actionId)
  if (!capability) {
    const unavailable = actions.unavailable.find((value) => value.actionId === input.actionId)
    if (unavailable) throw new UnavailableCreatureActionError(unavailable.label, unavailable.reason)
    throw new Error('The selected Creature action source is stale.')
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
  return source.kind === 'CHARACTER_ACTION'
    ? (source.candidate.label ?? null)
    : source.capability.label
}
