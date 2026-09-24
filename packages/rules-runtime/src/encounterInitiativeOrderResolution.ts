import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import type { InitiativePolicyOrderChoiceGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  resumeInitiativeOrderChoice,
  startInitiativeOrderChoice
} from './encounterInitiativeOrderChoiceExecution.js'
import type {
  InitiativeScoreBatchEntity,
  InitiativeScoreBatchEntityResult
} from './encounterInitiativeScoreBatch.js'
import type { InitiativeTieResolutionSegment } from './encounterInitiativeTieResolution.js'

type InitiativeIdentity = Pick<InitiativeScoreBatchEntity, 'kind' | 'id'>
type InitiativeOrderChoiceGraphSnapshot = EncounterInitiativePolicySnapshotDto['orderChoiceGraph']

export type InitiativeOrderChoiceEvidence = {
  selectedEntity: InitiativeIdentity
  execution: ServerCompletedRuleExecutionDto
}

export type PendingInitiativeOrderResolution = {
  kind: 'PENDING'
  completedEntities: readonly InitiativeIdentity[]
  completedTieResults: readonly InitiativeScoreBatchEntityResult[]
  completedChoices: readonly InitiativeOrderChoiceEvidence[]
  currentSegment: InitiativeTieResolutionSegment & { kind: 'ORDER_CHOICE_REQUIRED' }
  selectedFromCurrent: readonly InitiativeIdentity[]
  remainingCurrent: readonly InitiativeIdentity[]
  continuation: ServerRuleExecutionContinuationDto
  laterSegments: readonly InitiativeTieResolutionSegment[]
}

export type InitiativeOrderResolutionResult =
  | PendingInitiativeOrderResolution
  | {
      kind: 'COMPLETE'
      orderedEntities: readonly InitiativeIdentity[]
      tieResults: readonly InitiativeScoreBatchEntityResult[]
      choices: readonly InitiativeOrderChoiceEvidence[]
    }

type OrderResolutionContext = {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeOrderChoiceGraphSnapshot
  pin: InitiativePolicyOrderChoiceGraphPinDto
  entitiesByKey: ReadonlyMap<string, InitiativeIdentity>
}

function identityKey(identity: InitiativeIdentity): string {
  return `${identity.kind}:${identity.id}`
}

function requireCanonicalEntities(
  entities: readonly InitiativeIdentity[]
): ReadonlyMap<string, InitiativeIdentity> {
  if (entities.length < 1 || entities.length > AUTHORED_LIMITS.nestedCollectionItems) {
    throw new Error(
      `Initiative order resolution requires between 1 and ${AUTHORED_LIMITS.nestedCollectionItems} entities.`
    )
  }
  const expectedKind = entities[0]!.kind
  let priorId = ''
  const entitiesByKey = new Map<string, InitiativeIdentity>()
  for (const entity of entities) {
    const canonicalId = serverUuidIdentityDtoSchema.parse(entity.id)
    if (canonicalId !== entity.id || entity.id <= priorId || entity.kind !== expectedKind) {
      throw new Error('Initiative order entities must be one kind in canonical UUID order.')
    }
    entitiesByKey.set(identityKey(entity), entity)
    priorId = entity.id
  }
  return entitiesByKey
}

function requireCanonicalSegment(
  segment: InitiativeTieResolutionSegment,
  entitiesByKey: ReadonlyMap<string, InitiativeIdentity>
): void {
  if (
    segment.members.length < 1 ||
    segment.members.length > AUTHORED_LIMITS.nestedCollectionItems
  ) {
    throw new Error('Initiative order segment has an invalid member count.')
  }
  let priorId = ''
  for (const member of segment.members) {
    const canonicalId = serverUuidIdentityDtoSchema.parse(member.id)
    if (
      canonicalId !== member.id ||
      member.id <= priorId ||
      !entitiesByKey.has(identityKey(member))
    ) {
      throw new Error('Initiative order segment contains an invalid cohort identity.')
    }
    priorId = member.id
  }
  if (segment.tieResults) {
    if (
      segment.tieResults.length !== segment.members.length ||
      segment.tieResults.some(
        (result, index) => identityKey(result.entity) !== identityKey(segment.members[index]!)
      )
    ) {
      throw new Error('Initiative order segment tie results do not match its exact members.')
    }
  }
}

function requireExactSegments(input: {
  segments: readonly InitiativeTieResolutionSegment[]
  entitiesByKey: ReadonlyMap<string, InitiativeIdentity>
}): void {
  if (input.segments.length < 1 || input.segments.length > AUTHORED_LIMITS.nestedCollectionItems) {
    throw new Error('Initiative order resolution requires bounded segments.')
  }
  const keys: string[] = []
  for (const segment of input.segments) {
    requireCanonicalSegment(segment, input.entitiesByKey)
    keys.push(...segment.members.map(identityKey))
  }
  if (keys.length !== input.entitiesByKey.size || new Set(keys).size !== input.entitiesByKey.size) {
    throw new Error('Initiative order segments must cover the exact entity cohort once.')
  }
}

function appendSegmentTieResults(
  target: InitiativeScoreBatchEntityResult[],
  segment: InitiativeTieResolutionSegment
): void {
  if (segment.tieResults) target.push(...segment.tieResults)
}

async function resolveSegments(input: {
  context: OrderResolutionContext
  completedEntities: InitiativeIdentity[]
  completedTieResults: InitiativeScoreBatchEntityResult[]
  completedChoices: InitiativeOrderChoiceEvidence[]
  segments: readonly InitiativeTieResolutionSegment[]
}): Promise<InitiativeOrderResolutionResult> {
  for (const [index, segment] of input.segments.entries()) {
    if (segment.kind === 'SETTLED' || segment.members.length === 1) {
      input.completedEntities.push(...segment.members)
      appendSegmentTieResults(input.completedTieResults, segment)
      continue
    }
    return resolveCurrentSegment({
      context: input.context,
      completedEntities: input.completedEntities,
      completedTieResults: input.completedTieResults,
      completedChoices: input.completedChoices,
      currentSegment: segment,
      selectedFromCurrent: [],
      remainingCurrent: [...segment.members],
      laterSegments: input.segments.slice(index + 1)
    })
  }
  return {
    kind: 'COMPLETE',
    orderedEntities: input.completedEntities,
    tieResults: input.completedTieResults,
    choices: input.completedChoices
  }
}

async function resolveCurrentSegment(input: {
  context: OrderResolutionContext
  completedEntities: InitiativeIdentity[]
  completedTieResults: InitiativeScoreBatchEntityResult[]
  completedChoices: InitiativeOrderChoiceEvidence[]
  currentSegment: InitiativeTieResolutionSegment & { kind: 'ORDER_CHOICE_REQUIRED' }
  selectedFromCurrent: InitiativeIdentity[]
  remainingCurrent: InitiativeIdentity[]
  laterSegments: readonly InitiativeTieResolutionSegment[]
}): Promise<InitiativeOrderResolutionResult> {
  if (input.remainingCurrent.length === 1) {
    input.completedEntities.push(...input.selectedFromCurrent, input.remainingCurrent[0]!)
    appendSegmentTieResults(input.completedTieResults, input.currentSegment)
    return resolveSegments({
      context: input.context,
      completedEntities: input.completedEntities,
      completedTieResults: input.completedTieResults,
      completedChoices: input.completedChoices,
      segments: input.laterSegments
    })
  }
  const choice = await startInitiativeOrderChoice({
    runtime: input.context.runtime,
    occurrenceId: input.context.occurrenceId,
    gameSystemId: input.context.gameSystemId,
    graph: input.context.graph,
    pin: input.context.pin,
    minimumIndex: 0,
    maximumIndex: input.remainingCurrent.length - 1
  })
  if (choice.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      completedEntities: input.completedEntities,
      completedTieResults: input.completedTieResults,
      completedChoices: input.completedChoices,
      currentSegment: input.currentSegment,
      selectedFromCurrent: input.selectedFromCurrent,
      remainingCurrent: input.remainingCurrent,
      continuation: choice.continuation,
      laterSegments: input.laterSegments
    }
  }
  const selected = input.remainingCurrent[choice.selection]!
  return resolveCurrentSegment({
    ...input,
    completedChoices: [
      ...input.completedChoices,
      { selectedEntity: selected, execution: choice.execution }
    ],
    selectedFromCurrent: [...input.selectedFromCurrent, selected],
    remainingCurrent: input.remainingCurrent.filter((_, index) => index !== choice.selection)
  })
}

function contextFromInput(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeOrderChoiceGraphSnapshot
  pin: InitiativePolicyOrderChoiceGraphPinDto
  entities: readonly InitiativeIdentity[]
}): OrderResolutionContext {
  return { ...input, entitiesByKey: requireCanonicalEntities(input.entities) }
}

export async function startInitiativeOrderResolution(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeOrderChoiceGraphSnapshot
  pin: InitiativePolicyOrderChoiceGraphPinDto
  entities: readonly InitiativeIdentity[]
  segments: readonly InitiativeTieResolutionSegment[]
}): Promise<InitiativeOrderResolutionResult> {
  const context = contextFromInput(input)
  requireExactSegments({ segments: input.segments, entitiesByKey: context.entitiesByKey })
  return resolveSegments({
    context,
    completedEntities: [],
    completedTieResults: [],
    completedChoices: [],
    segments: input.segments
  })
}

export async function resumeInitiativeOrderResolution(input: {
  runtime: RulesRuntimeService
  gameSystemId: string
  graph: InitiativeOrderChoiceGraphSnapshot
  pin: InitiativePolicyOrderChoiceGraphPinDto
  entities: readonly InitiativeIdentity[]
  pending: PendingInitiativeOrderResolution
  requestId: string
  selectedEntityId: string
}): Promise<InitiativeOrderResolutionResult> {
  const context = contextFromInput({
    ...input,
    occurrenceId: input.pending.continuation.occurrenceId
  })
  requireCanonicalSegment(input.pending.currentSegment, context.entitiesByKey)
  for (const segment of input.pending.laterSegments) {
    requireCanonicalSegment(segment, context.entitiesByKey)
  }
  const retainedKeys = [
    ...input.pending.completedEntities.map(identityKey),
    ...input.pending.currentSegment.members.map(identityKey),
    ...input.pending.laterSegments.flatMap((segment) => segment.members.map(identityKey))
  ]
  if (
    retainedKeys.length !== context.entitiesByKey.size ||
    new Set(retainedKeys).size !== context.entitiesByKey.size ||
    retainedKeys.some((key) => !context.entitiesByKey.has(key))
  ) {
    throw new Error('Initiative order continuation does not retain the exact entity cohort.')
  }
  const completedKeys = new Set(input.pending.completedEntities.map(identityKey))
  const completedTieResultKeys = input.pending.completedTieResults.map((result) =>
    identityKey(result.entity)
  )
  if (
    new Set(completedTieResultKeys).size !== completedTieResultKeys.length ||
    completedTieResultKeys.some((key) => !completedKeys.has(key))
  ) {
    throw new Error('Initiative order continuation tie results do not match completed entities.')
  }
  const choiceKeys = input.pending.completedChoices.map((choice) =>
    identityKey(choice.selectedEntity)
  )
  const chosenKeys = new Set([
    ...completedKeys,
    ...input.pending.selectedFromCurrent.map(identityKey)
  ])
  if (
    new Set(choiceKeys).size !== choiceKeys.length ||
    choiceKeys.some((key) => !chosenKeys.has(key))
  ) {
    throw new Error('Initiative order continuation choices do not match completed entities.')
  }
  const currentKeys = new Set(input.pending.currentSegment.members.map(identityKey))
  const selectedAndRemaining = [
    ...input.pending.selectedFromCurrent,
    ...input.pending.remainingCurrent
  ]
  if (
    selectedAndRemaining.length !== currentKeys.size ||
    new Set(selectedAndRemaining.map(identityKey)).size !== currentKeys.size ||
    selectedAndRemaining.some((identity) => !currentKeys.has(identityKey(identity)))
  ) {
    throw new Error('Initiative order continuation does not retain its exact current segment.')
  }
  const selection = input.pending.remainingCurrent.findIndex(
    (identity) => identity.id === input.selectedEntityId
  )
  if (selection < 0) {
    throw new Error('Initiative order selection is not one of the exact remaining entities.')
  }
  const resumed = await resumeInitiativeOrderChoice({
    runtime: input.runtime,
    continuation: input.pending.continuation,
    requestId: input.requestId,
    value: selection,
    pin: input.pin,
    minimumIndex: 0,
    maximumIndex: input.pending.remainingCurrent.length - 1
  })
  if (resumed.kind === 'PENDING') {
    throw new Error('Initiative order choice returned an unsupported additional pause.')
  }
  if (resumed.selection !== selection) {
    throw new Error('Initiative order choice did not confirm the authorized entity selection.')
  }
  const selected = input.pending.remainingCurrent[selection]!
  return resolveCurrentSegment({
    context,
    completedEntities: [...input.pending.completedEntities],
    completedTieResults: [...input.pending.completedTieResults],
    completedChoices: [
      ...input.pending.completedChoices,
      { selectedEntity: selected, execution: resumed.execution }
    ],
    currentSegment: input.pending.currentSegment,
    selectedFromCurrent: [...input.pending.selectedFromCurrent, selected],
    remainingCurrent: input.pending.remainingCurrent.filter((_, index) => index !== selection),
    laterSegments: input.pending.laterSegments
  })
}
