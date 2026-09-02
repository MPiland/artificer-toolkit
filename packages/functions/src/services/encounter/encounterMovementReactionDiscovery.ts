import type { EncounterRecord } from '@artificer-toolkit/db'
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

import type { EncounterFeatureActionCapabilityDescriptor } from '../rules/encounterFeatureActionCapabilityDiscovery.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import type { CurrentReusableDefinitionSource } from '../rules/ruleCapabilityStateService.js'
import type {
  LockedEncounterActiveEffectCharacter,
  LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import {
  collectEncounterMovementReactionContacts,
  type EncounterMovementReactionContact
} from './encounterMovementReactionContacts.js'
import {
  organizeEncounterMovementReactionDecisions,
  movementReactionActionSourceCurrentnessChecksum,
  sealEncounterMovementReactionTimeline
} from './encounterMovementReactionDecision.js'
import { evaluateEncounterMovementReactionContacts } from './encounterMovementReactionEvaluation.js'
import { resolveEncounterMovementReactionRuleStates } from './encounterMovementReactionRuleState.js'
import {
  discoverEncounterMovementReactionSources,
  type EncounterMovementReactionActionSource,
  type EncounterMovementReactionSource
} from './encounterMovementReactionSources.js'

export interface EncounterMovementReactionDiscoveryResult {
  reactionTimeline: MovementReactionTimelineDto
  firstBoundaryDistance: number | null
}

/**
 * Discovers one fresh movement command's reaction choices from exact locked
 * actor/source facts. Persistence, Scene commits, and continuation ownership
 * remain with the Encounter command coordinator.
 */
export async function discoverEncounterMovementReactionChoices(input: {
  encounter: EncounterRecord
  automationMode: Exclude<EncounterRecord['automationMode'], 'MANUAL'>
  grid: SceneGrid
  movementKind: SpatialMovementKind
  movingTokenId: string
  occurrenceId: string
  path: readonly ScenePoint[]
  actorIdByTokenId: ReadonlyMap<string, string>
  tokens: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  activeEffectsByActorId: LockedEncounterActiveEffectTargets['activeEffectsByActorId']
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
  if (contacts.length === 0) {
    return { reactionTimeline: [], firstBoundaryDistance: null }
  }
  if (!input.runtime) {
    throw new EncounterValidationError('Movement reaction eligibility requires the rules runtime.')
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
    contacts,
    actorRuleStates,
    lockRelationship: input.lockRelationship,
    resolvePerception: input.resolvePerception
  })
  const organized = organizeEncounterMovementReactionDecisions(evaluated, input.automationMode)
  const reactionTimeline = sealEncounterMovementReactionTimeline(organized)
  const first = reactionTimeline[0]
  return {
    reactionTimeline,
    firstBoundaryDistance:
      first?.kind === 'AUTOMATIC_ACTION'
        ? first.option.candidate.pathDistance
        : (first?.group.pathDistance ?? null)
  }
}

/**
 * Re-resolves one issued choice from current locked source, capability, usage,
 * relationship, and perception facts. The frozen contact remains the
 * authoritative already-committed movement fact and is never rediscovered.
 */
export async function revalidateEncounterMovementReactionOption(input: {
  encounter: EncounterRecord
  automationMode: Exclude<EncounterRecord['automationMode'], 'MANUAL'>
  movementKind: SpatialMovementKind
  occurrenceId: string
  option: MovementReactionChoiceOptionDto
  actorIdByTokenId: ReadonlyMap<string, string>
  tokens: readonly Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>[]
  lockedCharacters: ReadonlyMap<string, LockedEncounterActiveEffectCharacter>
  activeEffectsByActorId: LockedEncounterActiveEffectTargets['activeEffectsByActorId']
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
  if (matching.length !== 1) {
    throw new EncounterConflictError('The selected movement reaction source is stale.')
  }
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
    actorRuleStates,
    lockRelationship: input.lockRelationship,
    resolvePerception: input.resolvePerception
  })
  const sealed = sealEncounterMovementReactionTimeline(
    organizeEncounterMovementReactionDecisions(evaluated, input.automationMode)
  )
    .flatMap((entry) => (entry.kind === 'AUTOMATIC_ACTION' ? [entry.option] : entry.group.options))
    .find((option) => option.optionId === input.option.optionId)
  if (!sealed || checksumRuleDocument(sealed) !== checksumRuleDocument(input.option)) {
    throw new EncounterConflictError('The selected movement reaction is no longer eligible.')
  }
  return { action: source.action }
}
