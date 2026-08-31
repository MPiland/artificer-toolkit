import {
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  serverRuleExecutionContinuationDtoSchema,
  serverAggregateChoicePendingSnapshotDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionPendingApplicationContextDto,
  type ServerAggregateChoicePendingSnapshotDto,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type {
  EncounterInitiativeExecutionEvidence,
  PendingEncounterInitiativeLifecycle
} from './encounterInitiativeLifecycle.js'
import type {
  InitiativeScoreBatchEntity,
  InitiativeScoreBatchEntityResult,
  PendingInitiativeScoreBatch
} from './encounterInitiativeScoreBatch.js'
import type { InitiativeScoreOrderGroup } from './encounterInitiativeOrdering.js'
import type { PendingInitiativeOrderResolution } from './encounterInitiativeOrderResolution.js'
import type {
  InitiativeTieEvaluationAttempt,
  InitiativeTieResolutionSegment,
  PendingInitiativeTieResolution
} from './encounterInitiativeTieResolution.js'

type InitiativeApplicationContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_INITIATIVE' }
>
export type EncounterInitiativeOccurrenceRoot = InitiativeApplicationContext['root']
type InitiativeIdentity = { kind: 'ACTOR' | 'SIDE'; id: string }

function identity(entity: InitiativeScoreBatchEntity | InitiativeIdentity): InitiativeIdentity {
  return { kind: entity.kind, id: entity.id }
}

function identityKey(value: InitiativeIdentity): string {
  return `${value.kind}:${value.id}`
}

function scoreBatchContext(batch: PendingInitiativeScoreBatch) {
  return {
    completed: [...batch.completed],
    current: identity(batch.current),
    remaining: batch.remaining.map(identity)
  }
}

function orderSegmentContext(segment: InitiativeTieResolutionSegment) {
  return { kind: segment.kind, score: segment.score, members: segment.members.map(identity) }
}

function scoreGroupContext(group: InitiativeScoreOrderGroup) {
  return { ...group, members: group.members.map(identity) }
}

function tiedScoreGroupContext(group: InitiativeScoreOrderGroup) {
  if (group.classification !== 'TIED')
    throw new Error('Initiative tie continuation must retain a tied score group.')
  return { ...scoreGroupContext(group), classification: 'TIED' as const }
}

function orderContext(order: PendingInitiativeOrderResolution) {
  return {
    completedEntities: order.completedEntities.map(identity),
    completedChoices: order.completedChoices.map((choice) => ({
      selectedEntity: identity(choice.selectedEntity),
      execution: choice.execution
    })),
    currentSegment: {
      ...orderSegmentContext(order.currentSegment),
      kind: 'ORDER_CHOICE_REQUIRED' as const
    },
    selectedFromCurrent: order.selectedFromCurrent.map(identity),
    remainingCurrent: order.remainingCurrent.map(identity),
    laterSegments: order.laterSegments.map(orderSegmentContext)
  }
}

function pendingContinuation(
  pending: PendingEncounterInitiativeLifecycle
): ServerRuleExecutionContinuationDto {
  if (pending.phase === 'PRIMARY_SCORE') return pending.scoreBatch.continuation
  if (pending.phase === 'TIE_RESOLUTION')
    return pending.tieResolution.pendingScoreBatch.continuation
  return pending.orderResolution.continuation
}

function evidenceContext(evidence: EncounterInitiativeExecutionEvidence) {
  return {
    primaryResults: [...evidence.primaryResults],
    tieAttempts: evidence.tieAttempts.map((attempt) => ({
      ...attempt,
      results: [...attempt.results]
    })),
    orderChoices: evidence.orderChoices.map((choice) => ({
      selectedEntity: identity(choice.selectedEntity),
      execution: choice.execution
    }))
  }
}

function applicationContext(input: {
  root: EncounterInitiativeOccurrenceRoot
  pending: PendingEncounterInitiativeLifecycle
}): InitiativeApplicationContext {
  const { pending } = input
  if (pending.phase === 'PRIMARY_SCORE')
    return {
      kind: 'ENCOUNTER_INITIATIVE',
      schemaVersion: 1,
      root: input.root,
      phase: { kind: 'PRIMARY_SCORE', scoreBatch: scoreBatchContext(pending.scoreBatch) }
    }
  if (pending.phase === 'TIE_RESOLUTION')
    return {
      kind: 'ENCOUNTER_INITIATIVE',
      schemaVersion: 1,
      root: input.root,
      phase: {
        kind: 'TIE_RESOLUTION',
        primaryResults: [...pending.primaryResults],
        completedAttempts: evidenceContext({
          primaryResults: pending.primaryResults,
          tieAttempts: pending.tieResolution.completedAttempts,
          orderChoices: []
        }).tieAttempts,
        completedSegments: pending.tieResolution.completedSegments.map(orderSegmentContext),
        currentOriginalGroup: tiedScoreGroupContext(pending.tieResolution.currentOriginalGroup),
        attemptOrdinal: pending.tieResolution.attemptOrdinal,
        scoreBatch: scoreBatchContext(pending.tieResolution.pendingScoreBatch),
        laterOriginalGroups: pending.tieResolution.laterOriginalGroups.map(scoreGroupContext)
      }
    }
  if (pending.phase === 'ENTITY_ORDER')
    return {
      kind: 'ENCOUNTER_INITIATIVE',
      schemaVersion: 1,
      root: input.root,
      phase: {
        kind: 'ENTITY_ORDER',
        evidence: evidenceContext(pending.evidence),
        entityKind: pending.entityKind,
        order: orderContext(pending.orderResolution)
      }
    }
  return {
    kind: 'ENCOUNTER_INITIATIVE',
    schemaVersion: 1,
    root: input.root,
    phase: {
      kind: 'SIDE_ACTOR_ORDER',
      evidence: evidenceContext(pending.evidence),
      orderedSideIds: [...pending.orderedSideIds],
      order: orderContext(pending.orderResolution)
    }
  }
}

/** Seals only the current kernel continuation plus bounded aggregate-owned initiative state. */
export function createEncounterInitiativePendingSnapshot(input: {
  root: EncounterInitiativeOccurrenceRoot
  pending: PendingEncounterInitiativeLifecycle
}): ServerKernelRuleExecutionPendingSnapshotDto {
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...pendingContinuation(input.pending),
    applicationContext: applicationContext(input)
  })
}

/** Seals the non-kernel intent choice that precedes Speed Factor scoring. */
export function createEncounterInitiativeDeclarationPendingSnapshot(input: {
  occurrenceId: string
  root: EncounterInitiativeOccurrenceRoot
  request: Extract<
    ServerAggregateChoicePendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_INITIATIVE_DECLARATION' }
  >['request']
}): ServerAggregateChoicePendingSnapshotDto {
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    applicationContext: {
      kind: 'ENCOUNTER_INITIATIVE_DECLARATION',
      schemaVersion: 1,
      root: input.root,
      request: input.request
    }
  })
}

function requireExactEntityMap(entities: readonly InitiativeScoreBatchEntity[]) {
  const byKey = new Map<string, InitiativeScoreBatchEntity>()
  for (const entity of entities) {
    const key = identityKey(entity)
    if (byKey.has(key)) throw new Error('Initiative source entities must be unique.')
    byKey.set(key, entity)
  }
  return byKey
}

function requireExactCohort(input: {
  identities: readonly InitiativeIdentity[]
  entitiesByKey: ReadonlyMap<string, InitiativeScoreBatchEntity>
}) {
  const keys = input.identities.map(identityKey)
  if (
    keys.length !== input.entitiesByKey.size ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !input.entitiesByKey.has(key))
  )
    throw new Error('Initiative pending state does not retain the exact locked entity cohort.')
}

function requireEntity(
  value: InitiativeIdentity,
  entitiesByKey: ReadonlyMap<string, InitiativeScoreBatchEntity>
): InitiativeScoreBatchEntity {
  const entity = entitiesByKey.get(identityKey(value))
  if (!entity) throw new Error('Initiative pending state references an unavailable locked entity.')
  return entity
}

function requireExecutionEvidence(input: {
  evidence: EncounterInitiativeExecutionEvidence
  entitiesByKey: ReadonlyMap<string, InitiativeScoreBatchEntity>
}) {
  requireExactCohort({
    identities: input.evidence.primaryResults.map((result) => result.entity),
    entitiesByKey: input.entitiesByKey
  })
  for (const attempt of input.evidence.tieAttempts) {
    const keys = attempt.results.map((result) => identityKey(result.entity))
    if (new Set(keys).size !== keys.length || keys.some((key) => !input.entitiesByKey.has(key)))
      throw new Error('Initiative tie evidence references a stale or duplicated entity.')
  }
  const choiceKeys = input.evidence.orderChoices.map((choice) => identityKey(choice.selectedEntity))
  if (
    new Set(choiceKeys).size !== choiceKeys.length ||
    choiceKeys.some((key) => !input.entitiesByKey.has(key))
  )
    throw new Error('Initiative order evidence references a stale or duplicated entity.')
}

function requireOrderChoices(input: {
  choices: readonly { selectedEntity: InitiativeIdentity }[]
  allowedKeys: ReadonlySet<string>
}) {
  const keys = input.choices.map((choice) => identityKey(choice.selectedEntity))
  if (new Set(keys).size !== keys.length || keys.some((key) => !input.allowedKeys.has(key)))
    throw new Error('Initiative pending order choices reference a stale or duplicated entity.')
}

type PersistedScoreBatch = Extract<
  InitiativeApplicationContext['phase'],
  { kind: 'PRIMARY_SCORE' }
>['scoreBatch']

function restorePersistedScoreBatch(input: {
  batch: PersistedScoreBatch
  continuation: ServerRuleExecutionContinuationDto
  entitiesByKey: ReadonlyMap<string, InitiativeScoreBatchEntity>
}): PendingInitiativeScoreBatch {
  const retained = [
    ...input.batch.completed.map((result) => result.entity),
    input.batch.current,
    ...input.batch.remaining
  ]
  requireExactCohort({ identities: retained, entitiesByKey: input.entitiesByKey })
  return {
    kind: 'PENDING',
    completed: input.batch.completed as InitiativeScoreBatchEntityResult[],
    current: requireEntity(input.batch.current, input.entitiesByKey),
    remaining: input.batch.remaining.map((entity) => requireEntity(entity, input.entitiesByKey)),
    continuation: input.continuation
  }
}

function identitiesFromSegments(segments: readonly { members: readonly InitiativeIdentity[] }[]) {
  return segments.flatMap((segment) => segment.members)
}

function restoreOrder(input: {
  order: Extract<InitiativeApplicationContext['phase'], { kind: 'ENTITY_ORDER' }>['order']
  continuation: ServerRuleExecutionContinuationDto
}): PendingInitiativeOrderResolution {
  return {
    kind: 'PENDING',
    completedEntities: input.order.completedEntities,
    completedTieResults: [],
    completedChoices: input.order.completedChoices,
    currentSegment: input.order.currentSegment,
    selectedFromCurrent: input.order.selectedFromCurrent,
    remainingCurrent: input.order.remainingCurrent,
    continuation: input.continuation,
    laterSegments: input.order.laterSegments
  }
}

/** Rebinds persisted identities to freshly locked System-derived fact bindings. */
export function restoreEncounterInitiativePending(input: {
  pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
  entities: readonly InitiativeScoreBatchEntity[]
  actorIds?: readonly string[]
}): {
  root: EncounterInitiativeOccurrenceRoot
  pending: PendingEncounterInitiativeLifecycle
} {
  const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse(input.pendingSnapshot)
  const context = snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_INITIATIVE')
    throw new Error('Pending occurrence is not an Encounter initiative lifecycle.')
  const {
    applicationContext: _applicationContext,
    snapshotKind: _snapshotKind,
    ...continuationInput
  } = snapshot
  const continuation = serverRuleExecutionContinuationDtoSchema.parse(continuationInput)
  const entitiesByKey = requireExactEntityMap(input.entities)

  if (context.phase.kind === 'PRIMARY_SCORE')
    return {
      root: context.root,
      pending: {
        phase: 'PRIMARY_SCORE',
        scoreBatch: restorePersistedScoreBatch({
          batch: context.phase.scoreBatch,
          continuation,
          entitiesByKey
        })
      }
    }
  if (context.phase.kind === 'TIE_RESOLUTION') {
    const evidence: EncounterInitiativeExecutionEvidence = {
      primaryResults: context.phase.primaryResults,
      tieAttempts: context.phase.completedAttempts as InitiativeTieEvaluationAttempt[],
      orderChoices: []
    }
    requireExecutionEvidence({ evidence, entitiesByKey })
    const retained = [
      ...identitiesFromSegments(context.phase.completedSegments),
      ...context.phase.currentOriginalGroup.members,
      ...context.phase.laterOriginalGroups.flatMap((group) => group.members)
    ]
    requireExactCohort({ identities: retained, entitiesByKey })
    const tieResolution: PendingInitiativeTieResolution = {
      kind: 'PENDING',
      completedAttempts: evidence.tieAttempts,
      completedSegments: context.phase.completedSegments,
      currentOriginalGroup: context.phase.currentOriginalGroup as InitiativeScoreOrderGroup,
      attemptOrdinal: context.phase.attemptOrdinal,
      pendingScoreBatch: restorePersistedScoreBatch({
        batch: context.phase.scoreBatch,
        continuation,
        entitiesByKey: new Map(
          context.phase.currentOriginalGroup.members.map((member) => {
            const entity = requireEntity(member, entitiesByKey)
            return [identityKey(member), entity]
          })
        )
      }),
      laterOriginalGroups: context.phase.laterOriginalGroups
    }
    return {
      root: context.root,
      pending: {
        phase: 'TIE_RESOLUTION',
        primaryResults: evidence.primaryResults,
        tieResolution
      }
    }
  }

  if (context.phase.kind === 'INITIATIVE_DECLARATION')
    throw new Error('Initiative declaration choices do not carry a kernel continuation.')

  const orderIdentities = [
    ...context.phase.order.completedEntities,
    ...context.phase.order.currentSegment.members,
    ...identitiesFromSegments(context.phase.order.laterSegments)
  ]
  if (context.phase.kind === 'ENTITY_ORDER') {
    requireExecutionEvidence({ evidence: context.phase.evidence, entitiesByKey })
    requireExactCohort({ identities: orderIdentities, entitiesByKey })
    requireOrderChoices({
      choices: context.phase.order.completedChoices,
      allowedKeys: new Set(entitiesByKey.keys())
    })
    const entityKind = context.phase.entityKind
    if (orderIdentities.some((entity) => entity.kind !== entityKind))
      throw new Error('Initiative order identities do not match the persisted entity kind.')
    return {
      root: context.root,
      pending: {
        phase: 'ENTITY_ORDER',
        evidence: context.phase.evidence,
        entityKind,
        orderResolution: restoreOrder({ order: context.phase.order, continuation })
      }
    }
  }

  const sideKeys = context.phase.orderedSideIds.map((sideId) =>
    identityKey({ kind: 'SIDE', id: sideId })
  )
  if (
    sideKeys.length !== entitiesByKey.size ||
    new Set(sideKeys).size !== sideKeys.length ||
    sideKeys.some((key) => !entitiesByKey.has(key)) ||
    orderIdentities.some((entity) => entity.kind !== 'ACTOR')
  )
    throw new Error('Side initiative pending state does not retain its exact side and actor kinds.')
  const actorKeys = (input.actorIds ?? []).map((actorId) =>
    identityKey({ kind: 'ACTOR', id: actorId })
  )
  const retainedActorKeys = orderIdentities.map(identityKey)
  if (
    actorKeys.length !== retainedActorKeys.length ||
    new Set(actorKeys).size !== actorKeys.length ||
    new Set(retainedActorKeys).size !== retainedActorKeys.length ||
    retainedActorKeys.some((key) => !actorKeys.includes(key))
  )
    throw new Error('Side initiative pending state does not retain the exact locked actor cohort.')
  requireOrderChoices({
    choices: context.phase.order.completedChoices,
    allowedKeys: new Set(actorKeys)
  })
  requireExecutionEvidence({ evidence: context.phase.evidence, entitiesByKey })
  return {
    root: context.root,
    pending: {
      phase: 'SIDE_ACTOR_ORDER',
      evidence: context.phase.evidence,
      orderedSideIds: context.phase.orderedSideIds,
      orderResolution: restoreOrder({ order: context.phase.order, continuation })
    }
  }
}

function requireIntegerRequest(snapshot: ServerKernelRuleExecutionPendingSnapshotDto) {
  if (snapshot.request.kind !== 'INTEGER_RANGE')
    throw new Error('Initiative pending execution requires a bounded integer request.')
  return snapshot.request
}

/** Projects only the current authorized decision, never graph/fact/provenance state. */
export function projectEncounterInitiativePendingSummary(input: {
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto
  occurrenceVersion: number
  encounterVersion: number
}): PendingEncounterRuleOccurrenceSummaryDto {
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(input.pendingSnapshot)
  if (
    snapshot.snapshotKind === 'AGGREGATE_CHOICE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
  ) {
    const request = snapshot.applicationContext.request
    return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
      kind: 'INITIATIVE_DECLARATION',
      occurrenceId: snapshot.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterVersion: input.encounterVersion,
      actorId: request.actorId,
      requestId: request.requestId,
      primaryOptionIds: request.primaryOptions.map((option) => option.optionId),
      bonusOptionIds: request.bonusOptions.map((option) => option.optionId),
      allowedResponses: ['INITIATIVE_DECLARATION']
    })
  }
  if (snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
    throw new Error('Pending occurrence is not an Encounter initiative lifecycle.')
  const context = snapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_INITIATIVE')
    throw new Error('Pending occurrence is not an Encounter initiative lifecycle.')
  if (context.phase.kind === 'INITIATIVE_DECLARATION') {
    return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
      kind: 'INITIATIVE_DECLARATION',
      occurrenceId: snapshot.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterVersion: input.encounterVersion,
      actorId: context.phase.actorId,
      requestId: context.phase.requestId,
      primaryOptionIds: context.phase.allowedPrimaryOptionIds,
      bonusOptionIds: context.phase.allowedBonusOptionIds,
      allowedResponses: ['INITIATIVE_DECLARATION']
    })
  }
  const request = requireIntegerRequest(snapshot)
  if (context.phase.kind === 'PRIMARY_SCORE' || context.phase.kind === 'TIE_RESOLUTION')
    return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
      kind: 'INITIATIVE_EVIDENCE',
      occurrenceId: snapshot.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterVersion: input.encounterVersion,
      request: { requestId: request.requestId, min: request.min, max: request.max },
      allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
    })

  const remaining = context.phase.order.remainingCurrent
  const entityKind = context.phase.kind === 'ENTITY_ORDER' ? context.phase.entityKind : 'ACTOR'
  if (
    request.min !== 0 ||
    request.max !== remaining.length - 1 ||
    remaining.some((entity) => entity.kind !== entityKind)
  )
    throw new Error('Initiative order request does not match its exact remaining entity cohort.')
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'INITIATIVE_ORDER',
    occurrenceId: snapshot.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    encounterVersion: input.encounterVersion,
    requestId: request.requestId,
    entityKind,
    optionIds: remaining.map((entity) => entity.id),
    allowedResponses: ['INITIATIVE_ENTITY']
  })
}
