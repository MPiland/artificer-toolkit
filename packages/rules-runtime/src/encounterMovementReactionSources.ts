import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneToken } from '@artificer-toolkit/shared/vtt'

import type { EncounterFeatureActionCapabilityDescriptor } from './encounterFeatureActionCapabilityDiscovery.js'
import type { MovementReactionEligibilitySource } from './movementReactionEligibilityService.js'
import { discoverMovementReactionCapabilities } from './movementReactionCapabilityDiscovery.js'
import type { EncounterMovementReactionContactSource } from './encounterMovementReactionContacts.js'

type CompiledCharacterActionEntry = Extract<
  CompiledActionEntryPoint,
  { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
>
type CompiledCharacterTargetPolicy = NonNullable<CompiledCharacterActionEntry['targetPolicy']>

export type EncounterMovementReactionActor = Pick<
  EncounterRunActorState,
  'id' | 'kind' | 'sourceId' | 'systemId'
> & {
  resources: unknown
} & (
    | { kind: 'CHARACTER' }
    | { kind: 'CREATURE' | 'CUSTOM'; conditions: unknown; defeated: boolean }
  )

export type EncounterMovementReactionEncounter = Pick<
  EncounterRunState,
  'gameSystemId' | 'turnSequence' | 'currentActorId'
> & {
  actors: readonly EncounterMovementReactionActor[]
}

export type EncounterMovementReactionRuleStateCharacterSource = {
  actor: Pick<EncounterMovementReactionActor, 'id'>
  activeConditionDefinitionIds: readonly string[]
}

export type EncounterMovementReactionCharacterSource = {
  id: string
  systemId: string
  streamVersion: number
  actor: EncounterMovementReactionActor
  mechanics: {
    compiledActionEntryPoints: readonly CompiledActionEntryPoint[]
    rulePolicyInput: Pick<CharacterRulePolicyInput, 'actionCandidates'>
  }
  activeConditionDefinitionIds: readonly string[]
}

export type EncounterMovementReactionActionSource =
  | {
      kind: 'CHARACTER_ACTION'
      actorId: string
      characterId: string
      characterStreamVersion: number
      candidate: CharacterActionCandidate
      entry: CompiledCharacterActionEntry
    }
  | {
      kind: 'ENCOUNTER_FEATURE'
      actorId: string
      capability: EncounterFeatureActionCapabilityDescriptor
    }

export interface EncounterMovementReactionSource extends EncounterMovementReactionContactSource {
  action: EncounterMovementReactionActionSource
}

export interface EncounterMovementReactionEvaluationSource extends MovementReactionEligibilitySource {
  action: EncounterMovementReactionActionSource
}

export function encounterMovementReactionEvaluationSource(
  source: EncounterMovementReactionSource
): EncounterMovementReactionEvaluationSource {
  return { ...source.source, action: source.action }
}

function sameRangeFact(
  fact: CharacterActionCandidate['mechanicFacts']['invocation']['range'],
  range: CompiledCharacterTargetPolicy['range']
): boolean {
  if (fact.rangeKind !== range.rangeKind) return false
  if (range.rangeKind !== 'DISTANCE')
    return fact.amount === null && fact.longAmount === null && fact.unit === null
  return (
    fact.amount === range.amount &&
    fact.longAmount === (range.longAmount ?? null) &&
    fact.unit === range.unit
  )
}

function reactorTokens(
  tokens: readonly Pick<SceneToken, 'id'>[],
  actorIdByTokenId: ReadonlyMap<string, string>,
  actorId: string
): readonly Pick<SceneToken, 'id'>[] {
  return tokens
    .filter((token) => actorIdByTokenId.get(token.id) === actorId)
    .sort((left, right) => left.id.localeCompare(right.id))
}

function characterSources(input: {
  actor: EncounterMovementReactionActor
  locked: EncounterMovementReactionCharacterSource
  tokens: readonly Pick<SceneToken, 'id'>[]
  actorIdByTokenId: ReadonlyMap<string, string>
}): EncounterMovementReactionSource[] {
  if (
    input.actor.kind !== 'CHARACTER' ||
    !input.actor.sourceId ||
    input.locked.id !== input.actor.sourceId ||
    input.locked.actor.id !== input.actor.id ||
    input.locked.systemId !== input.actor.systemId
  ) {
    throw new Error('Locked Character reaction source does not match its Encounter actor.')
  }
  const entriesByActionId = new Map(
    input.locked.mechanics.compiledActionEntryPoints.map((entry) => [entry.actionId, entry])
  )
  const actionCandidates: readonly CharacterActionCandidate[] =
    input.locked.mechanics.rulePolicyInput.actionCandidates
  return actionCandidates.flatMap((candidate): EncounterMovementReactionSource[] => {
    const binding = candidate.mechanicFacts.invocation.reactionTrigger
    if (
      binding?.kind !== 'MOVEMENT' ||
      candidate.mechanicFacts.invocation.activation?.code !== 'REACTION'
    )
      return []
    const entry = entriesByActionId.get(candidate.actionId)
    if (
      !entry ||
      entry.effectId !== candidate.effectId ||
      entry.compilation.kind !== 'COMPILED' ||
      !entry.targetPolicy
    ) {
      return []
    }
    if (!sameRangeFact(candidate.mechanicFacts.invocation.range, entry.targetPolicy.range)) {
      throw new Error(
        'Committed Character reaction range does not match its normalized action facts.'
      )
    }
    return reactorTokens(input.tokens, input.actorIdByTokenId, input.actor.id).map((token) => ({
      reactorActorId: input.actor.id,
      reactorTokenId: token.id,
      range: entry.targetPolicy!.range,
      source: {
        binding,
        capability: { actionId: candidate.actionId, gameSystemId: input.locked.systemId }
      },
      action: {
        kind: 'CHARACTER_ACTION',
        actorId: input.actor.id,
        characterId: input.actor.sourceId!,
        characterStreamVersion: input.locked.streamVersion,
        candidate,
        entry: entry as CompiledCharacterActionEntry
      }
    }))
  })
}

function featureSources(input: {
  capabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  encounter: EncounterMovementReactionEncounter
  tokens: readonly Pick<SceneToken, 'id'>[]
  actorIdByTokenId: ReadonlyMap<string, string>
}): EncounterMovementReactionSource[] {
  return discoverMovementReactionCapabilities(input.capabilities).flatMap(
    ({ capability, binding }): EncounterMovementReactionSource[] => {
      if (
        capability.kind !== 'ENCOUNTER_FEATURE' ||
        capability.gameSystemId !== input.encounter.gameSystemId
      ) {
        throw new Error(
          'Encounter feature reaction capability does not match its Encounter System.'
        )
      }
      const actor = input.encounter.actors.find(
        (candidate) => candidate.id === capability.encounterActorId
      )
      if (!actor || actor.kind !== 'CREATURE') {
        throw new Error('Encounter feature reaction capability has no immutable actor source.')
      }
      // A defeated creature takes no reactions or opportunity attacks (D63).
      if (actor.defeated) return []
      return reactorTokens(input.tokens, input.actorIdByTokenId, actor.id).map((token) => ({
        reactorActorId: actor.id,
        reactorTokenId: token.id,
        range: capability.compiledEffect.invocation.range,
        source: {
          binding,
          capability: { actionId: capability.actionId, gameSystemId: capability.gameSystemId }
        },
        action: { kind: 'ENCOUNTER_FEATURE', actorId: actor.id, capability }
      }))
    }
  )
}

export function discoverEncounterMovementReactionSources(input: {
  encounter: EncounterMovementReactionEncounter
  actorIdByTokenId: ReadonlyMap<string, string>
  tokens: readonly Pick<SceneToken, 'id'>[]
  lockedCharacters: ReadonlyMap<string, EncounterMovementReactionCharacterSource>
  encounterFeatureCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
}): readonly EncounterMovementReactionSource[] {
  const sources: EncounterMovementReactionSource[] = []
  for (const actor of [...input.encounter.actors].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (actor.kind !== 'CHARACTER') continue
    if (!actor.sourceId) throw new Error('Encounter Character reaction source is incomplete.')
    const locked = input.lockedCharacters.get(actor.sourceId)
    if (!locked) throw new Error('Encounter Character reaction source was not locked.')
    sources.push(
      ...characterSources({
        actor,
        locked,
        tokens: input.tokens,
        actorIdByTokenId: input.actorIdByTokenId
      })
    )
  }
  sources.push(
    ...featureSources({
      capabilities: input.encounterFeatureCapabilities,
      encounter: input.encounter,
      tokens: input.tokens,
      actorIdByTokenId: input.actorIdByTokenId
    })
  )
  return sources.sort(
    (left, right) =>
      left.reactorActorId.localeCompare(right.reactorActorId) ||
      left.reactorTokenId.localeCompare(right.reactorTokenId) ||
      left.source.capability.actionId.localeCompare(right.source.capability.actionId)
  )
}
