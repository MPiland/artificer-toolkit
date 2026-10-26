import type {
  MovementReactionChoiceOptionDto,
  MovementReactionTimelineDto
} from '@artificer-toolkit/schema/shared/reaction'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  SceneGrid,
  ScenePoint,
  SceneToken,
  SpatialMovementKind
} from '@artificer-toolkit/shared/vtt'

import type { EncounterFeatureActionCapabilityDescriptor } from './encounterFeatureActionCapabilityDiscovery.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { EncounterValidationError, StaleMovementReactionError } from './encounterErrors.js'
import {
  collectEncounterMovementReactionContacts,
  type EncounterMovementReactionContact
} from './encounterMovementReactionContacts.js'
import {
  organizeEncounterMovementReactionDecisions,
  movementReactionActionSourceCurrentnessChecksum,
  sealEncounterMovementReactionChoiceGroups,
  sealEncounterMovementReactionTimeline
} from './encounterMovementReactionDecision.js'
import { evaluateEncounterMovementReactionContacts } from './encounterMovementReactionEvaluation.js'
import { resolveEncounterMovementReactionRuleStates } from './encounterMovementReactionRuleState.js'
import {
  discoverEncounterMovementReactionSources,
  type EncounterMovementReactionActionSource,
  type EncounterMovementReactionCharacterSource,
  type EncounterMovementReactionEncounter,
  type EncounterMovementReactionSource
} from './encounterMovementReactionSources.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

interface EncounterMovementReactionDiscoveryResult {
  reactionTimeline: MovementReactionTimelineDto
  firstBoundaryDistance: number | null
}

export async function discoverEncounterMovementReactionChoices(input: {
  encounter: EncounterMovementReactionEncounter
  grid: SceneGrid
  movementKind: SpatialMovementKind
  movingTokenId: string
  occurrenceId: string
  path: readonly ScenePoint[]
  actorIdByTokenId: ReadonlyMap<string, string>
  tokens: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
  lockedCharacters: ReadonlyMap<string, EncounterMovementReactionCharacterSource>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  encounterFeatureCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  definitions: CurrentReusableDefinitionSource
  runtime?: RulesRuntimeService
  lockRelationship(input: {
    reactorActorId: string
    movingActorId: string
  }): Promise<'ALLIED' | 'NEUTRAL' | 'HOSTILE' | null>
  resolvePerception(
    contact: EncounterMovementReactionContact<EncounterMovementReactionSource>
  ): Promise<boolean>
}): Promise<EncounterMovementReactionDiscoveryResult> {
  const sources = discoverEncounterMovementReactionSources({
    encounter: input.encounter,
    actorIdByTokenId: input.actorIdByTokenId,
    tokens: input.tokens,
    lockedCharacters: input.lockedCharacters,
    encounterFeatureCapabilities: input.encounterFeatureCapabilities
  })
  const contacts = collectEncounterMovementReactionContacts({
    grid: input.grid,
    actorIdByTokenId: input.actorIdByTokenId,
    movementKind: input.movementKind,
    movingTokenId: input.movingTokenId,
    path: input.path,
    tokens: input.tokens,
    sources
  })
  if (contacts.length === 0) return { reactionTimeline: [], firstBoundaryDistance: null }
  if (!input.runtime)
    throw new EncounterValidationError('Movement reaction eligibility requires the rules runtime.')
  const actorRuleStates = await resolveEncounterMovementReactionRuleStates({
    encounter: input.encounter,
    lockedCharacters: input.lockedCharacters,
    activeEffectsByActorId: input.activeEffectsByActorId,
    definitions: input.definitions
  })
  const evaluated = await evaluateEncounterMovementReactionContacts({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    movementKind: input.movementKind,
    contacts,
    encounter: input.encounter,
    activeEffectsByActorId: input.activeEffectsByActorId,
    actorRuleStates,
    lockRelationship: input.lockRelationship,
    resolvePerception: input.resolvePerception
  })
  const reactionTimeline = sealEncounterMovementReactionTimeline(
    organizeEncounterMovementReactionDecisions(evaluated)
  )
  const first = reactionTimeline[0]
  return {
    reactionTimeline,
    firstBoundaryDistance: first?.group.pathDistance ?? null
  }
}

export async function revalidateEncounterMovementReactionOption(input: {
  encounter: EncounterMovementReactionEncounter
  movementKind: SpatialMovementKind
  occurrenceId: string
  option: MovementReactionChoiceOptionDto
  actorIdByTokenId: ReadonlyMap<string, string>
  tokens: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
  lockedCharacters: ReadonlyMap<string, EncounterMovementReactionCharacterSource>
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  encounterFeatureCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  definitions: CurrentReusableDefinitionSource
  runtime: RulesRuntimeService
  lockRelationship(input: {
    reactorActorId: string
    movingActorId: string
  }): Promise<'ALLIED' | 'NEUTRAL' | 'HOSTILE' | null>
  resolvePerception(
    contact: EncounterMovementReactionContact<EncounterMovementReactionSource>
  ): Promise<boolean>
}): Promise<{ action: EncounterMovementReactionActionSource }> {
  const sources = discoverEncounterMovementReactionSources({
    encounter: input.encounter,
    actorIdByTokenId: input.actorIdByTokenId,
    tokens: input.tokens,
    lockedCharacters: input.lockedCharacters,
    encounterFeatureCapabilities: input.encounterFeatureCapabilities
  })
  const matching = sources.filter(
    (source) =>
      source.reactorActorId === input.option.candidate.reactorActorId &&
      source.reactorTokenId === input.option.candidate.reactorTokenId &&
      source.source.capability.actionId === input.option.actionId &&
      source.action.kind === input.option.actionSourceKind &&
      movementReactionActionSourceCurrentnessChecksum(source.action) ===
        input.option.actionSourceCurrentnessChecksum &&
      checksumRuleDocument(source.source.binding) === checksumRuleDocument(input.option.binding)
  )
  if (matching.length !== 1)
    throw new StaleMovementReactionError('The selected movement reaction source is stale.')
  const source = matching[0]!
  const contact: EncounterMovementReactionContact<EncounterMovementReactionSource> = {
    candidate: input.option.candidate,
    contactSourceId: input.option.contactSourceId,
    source
  }
  const actorRuleStates = await resolveEncounterMovementReactionRuleStates({
    encounter: input.encounter,
    lockedCharacters: input.lockedCharacters,
    activeEffectsByActorId: input.activeEffectsByActorId,
    definitions: input.definitions
  })
  const evaluated = await evaluateEncounterMovementReactionContacts({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    movementKind: input.movementKind,
    contacts: [contact],
    encounter: input.encounter,
    activeEffectsByActorId: input.activeEffectsByActorId,
    actorRuleStates,
    lockRelationship: input.lockRelationship,
    resolvePerception: input.resolvePerception
  })
  const sealed = sealEncounterMovementReactionChoiceGroups(
    organizeEncounterMovementReactionDecisions(evaluated)
  )
    .flatMap((group) => group.options)
    .find((option) => option.optionId === input.option.optionId)
  if (!sealed || checksumRuleDocument(sealed) !== checksumRuleDocument(input.option))
    throw new StaleMovementReactionError('The selected movement reaction is no longer eligible.')
  return { action: source.action }
}
