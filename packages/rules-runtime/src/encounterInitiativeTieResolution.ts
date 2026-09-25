import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import type { InitiativePolicyTieResolverPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'

import type { EncounterEvidenceMode } from './encounterEvidenceMode.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  prepareInitiativeOrdering,
  type InitiativeScoreOrderGroup
} from './encounterInitiativeOrdering.js'
import {
  resumeInitiativeScoreBatch,
  startInitiativeScoreBatch,
  type InitiativeScoreBatchEntity,
  type InitiativeScoreBatchEntityResult,
  type PendingInitiativeScoreBatch,
  type TrustedInitiativeIntegerSource
} from './encounterInitiativeScoreBatch.js'

type InitiativeTieGraphSnapshot = EncounterInitiativePolicySnapshotDto['tieResolver']
type InitiativeProcedure = 'ACTOR_ROLL' | 'ACTOR_SCORE' | 'SIDE_ROLL' | 'DECLARED_ACTION_ROLL'
type InitiativeScoreBatchEntityIdentity = Pick<InitiativeScoreBatchEntity, 'kind' | 'id'>

export type InitiativeTieResolutionSegment =
  | {
      kind: 'SETTLED'
      score: number
      members: readonly InitiativeScoreBatchEntityIdentity[]
      tieResults?: readonly InitiativeScoreBatchEntityResult[]
    }
  | {
      kind: 'ORDER_CHOICE_REQUIRED'
      score: number
      members: readonly InitiativeScoreBatchEntityIdentity[]
      tieResults?: readonly InitiativeScoreBatchEntityResult[]
    }

export type InitiativeTieEvaluationAttempt = {
  originalScore: number
  attemptOrdinal: number
  results: readonly InitiativeScoreBatchEntityResult[]
}

export type PendingInitiativeTieResolution = {
  kind: 'PENDING'
  completedAttempts: readonly InitiativeTieEvaluationAttempt[]
  completedSegments: readonly InitiativeTieResolutionSegment[]
  currentOriginalGroup: InitiativeScoreOrderGroup
  attemptOrdinal: number
  pendingScoreBatch: PendingInitiativeScoreBatch
  laterOriginalGroups: readonly InitiativeScoreOrderGroup[]
}

export type CompletedInitiativeTieResolution = {
  kind: 'COMPLETE'
  completedAttempts: readonly InitiativeTieEvaluationAttempt[]
  segments: readonly InitiativeTieResolutionSegment[]
}

export type InitiativeTieResolutionResult =
  | PendingInitiativeTieResolution
  | CompletedInitiativeTieResolution

type TieResolutionContext = {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeTieGraphSnapshot
  pin: InitiativePolicyTieResolverPinDto
  procedure: InitiativeProcedure
  mode: EncounterEvidenceMode
  entitiesById: ReadonlyMap<string, InitiativeScoreBatchEntity>
  integerSource?: TrustedInitiativeIntegerSource
}

function expectedEntityKind(procedure: InitiativeProcedure): InitiativeScoreBatchEntity['kind'] {
  return procedure === 'SIDE_ROLL' ? 'SIDE' : 'ACTOR'
}

function identityKey(identity: InitiativeScoreBatchEntityIdentity): string {
  return `${identity.kind}:${identity.id}`
}

function requireCanonicalEntities(input: {
  entities: readonly InitiativeScoreBatchEntity[]
  procedure: InitiativeProcedure
}): ReadonlyMap<string, InitiativeScoreBatchEntity> {
  if (input.entities.length < 1 || input.entities.length > AUTHORED_LIMITS.nestedCollectionItems) {
    throw new Error(
      `Initiative tie resolution requires between 1 and ${AUTHORED_LIMITS.nestedCollectionItems} entities.`
    )
  }
  const expectedKind = expectedEntityKind(input.procedure)
  const entitiesById = new Map<string, InitiativeScoreBatchEntity>()
  let previousId = ''
  for (const entity of input.entities) {
    const canonicalId = serverUuidIdentityDtoSchema.parse(entity.id)
    if (canonicalId !== entity.id || entity.id <= previousId) {
      throw new Error('Initiative tie entities must use canonical ascending UUID identities.')
    }
    if (entity.kind !== expectedKind) {
      throw new Error('Initiative tie entity kind does not match the selected procedure.')
    }
    entitiesById.set(identityKey(entity), entity)
    previousId = entity.id
  }
  return entitiesById
}

function requireExactTieGraph(input: {
  graph: InitiativeTieGraphSnapshot
  pin: InitiativePolicyTieResolverPinDto
  gameSystemId: string
}): void {
  if (
    input.graph.definitionId !== input.pin.definitionId ||
    input.graph.definitionVersion !== input.pin.definitionVersion ||
    input.graph.definitionChecksum !== input.pin.definitionChecksum ||
    input.graph.document.id !== input.graph.definitionId ||
    input.graph.document.gameSystemId !== input.gameSystemId
  ) {
    throw new Error('Initiative tie graph does not match its exact selected policy pin.')
  }
}

function requireCanonicalMembers(input: {
  members: readonly InitiativeScoreBatchEntityIdentity[]
  expectedKind: InitiativeScoreBatchEntity['kind']
  entitiesById: ReadonlyMap<string, InitiativeScoreBatchEntity>
  minimum: number
}): void {
  if (
    input.members.length < input.minimum ||
    input.members.length > AUTHORED_LIMITS.nestedCollectionItems
  ) {
    throw new Error('Initiative tie group has an invalid member count.')
  }
  let previousId = ''
  for (const member of input.members) {
    const canonicalId = serverUuidIdentityDtoSchema.parse(member.id)
    if (
      canonicalId !== member.id ||
      member.id <= previousId ||
      member.kind !== input.expectedKind ||
      !input.entitiesById.has(identityKey(member))
    ) {
      throw new Error('Initiative tie group members must be canonical exact cohort identities.')
    }
    previousId = member.id
  }
}

function requireScoreGroups(input: {
  groups: readonly InitiativeScoreOrderGroup[]
  expectedKind: InitiativeScoreBatchEntity['kind']
  entitiesById: ReadonlyMap<string, InitiativeScoreBatchEntity>
  exactCohort: boolean
}): void {
  if (input.groups.length < 1 || input.groups.length > AUTHORED_LIMITS.nestedCollectionItems) {
    throw new Error('Initiative tie resolution requires bounded score groups.')
  }
  const encountered = new Set<string>()
  for (const group of input.groups) {
    if (!Number.isFinite(group.score))
      throw new Error('Initiative tie group scores must be finite.')
    requireCanonicalMembers({
      members: group.members,
      expectedKind: input.expectedKind,
      entitiesById: input.entitiesById,
      minimum: group.classification === 'TIED' ? 2 : 1
    })
    if (
      (group.classification === 'SETTLED' && group.members.length !== 1) ||
      (group.classification === 'TIED' && group.members.length < 2)
    ) {
      throw new Error('Initiative tie group classification does not match its member count.')
    }
    for (const member of group.members) {
      const key = identityKey(member)
      if (encountered.has(key)) throw new Error('Initiative tie groups must not overlap.')
      encountered.add(key)
    }
  }
  if (input.exactCohort && encountered.size !== input.entitiesById.size) {
    throw new Error('Initiative tie groups must cover the exact canonical cohort.')
  }
}

function tieResultsForMembers(input: {
  members: readonly InitiativeScoreBatchEntityIdentity[]
  resultsById?: ReadonlyMap<string, InitiativeScoreBatchEntityResult>
}): readonly InitiativeScoreBatchEntityResult[] | undefined {
  if (!input.resultsById) return undefined
  return input.members.map((member) => {
    const result = input.resultsById!.get(identityKey(member))
    if (!result) throw new Error('Initiative tie result is missing from its exact attempt batch.')
    return result
  })
}

function settledSegment(
  group: InitiativeScoreOrderGroup,
  resultsById?: ReadonlyMap<string, InitiativeScoreBatchEntityResult>
): InitiativeTieResolutionSegment {
  const tieResults = tieResultsForMembers({ members: group.members, resultsById })
  return {
    kind: 'SETTLED',
    score: group.score,
    members: group.members,
    ...(tieResults ? { tieResults } : {})
  }
}

function orderChoiceSegment(input: {
  score: number
  members: readonly InitiativeScoreBatchEntityIdentity[]
  resultsById?: ReadonlyMap<string, InitiativeScoreBatchEntityResult>
}): InitiativeTieResolutionSegment {
  const tieResults = tieResultsForMembers(input)
  return {
    kind: 'ORDER_CHOICE_REQUIRED',
    score: input.score,
    members: input.members,
    ...(tieResults ? { tieResults } : {})
  }
}

function entitiesForMembers(input: {
  members: readonly InitiativeScoreBatchEntityIdentity[]
  entitiesById: ReadonlyMap<string, InitiativeScoreBatchEntity>
}): readonly InitiativeScoreBatchEntity[] {
  return input.members.map((member) => {
    const entity = input.entitiesById.get(identityKey(member))
    if (!entity) throw new Error('Initiative tie group is outside the canonical entity cohort.')
    return entity
  })
}

function exactBatchFromCanonicalEntities(input: {
  batch: PendingInitiativeScoreBatch
  members: readonly InitiativeScoreBatchEntityIdentity[]
  entitiesById: ReadonlyMap<string, InitiativeScoreBatchEntity>
}): PendingInitiativeScoreBatch {
  const identities = [
    ...input.batch.completed.map((entry) => entry.entity),
    { kind: input.batch.current.kind, id: input.batch.current.id },
    ...input.batch.remaining.map((entity) => ({ kind: entity.kind, id: entity.id }))
  ] as const
  if (identities.length !== input.members.length) {
    throw new Error('Initiative tie pending batch does not match its unresolved subgroup.')
  }
  for (const [index, identity] of identities.entries()) {
    if (identityKey(identity) !== identityKey(input.members[index]!)) {
      throw new Error('Initiative tie pending batch was reordered or tampered.')
    }
  }
  const canonicalCurrent = input.entitiesById.get(identityKey(input.batch.current))
  if (!canonicalCurrent)
    throw new Error('Initiative tie pending batch current entity is unavailable.')
  return {
    ...input.batch,
    current: canonicalCurrent,
    remaining: input.batch.remaining.map((entity) => {
      const canonical = input.entitiesById.get(identityKey(entity))
      if (!canonical) throw new Error('Initiative tie pending batch entity is unavailable.')
      return canonical
    })
  }
}

function requirePendingState(input: {
  pending: PendingInitiativeTieResolution
  entitiesById: ReadonlyMap<string, InitiativeScoreBatchEntity>
  procedure: InitiativeProcedure
  pin: InitiativePolicyTieResolverPinDto
}): PendingInitiativeScoreBatch {
  if (
    !Number.isInteger(input.pending.attemptOrdinal) ||
    input.pending.attemptOrdinal < 1 ||
    input.pending.attemptOrdinal > input.pin.maximumAttempts ||
    (!input.pin.repeatOnTie && input.pending.attemptOrdinal !== 1)
  ) {
    throw new Error('Initiative tie attempt ordinal is outside the selected policy bounds.')
  }
  const expectedKind = expectedEntityKind(input.procedure)
  if (input.pending.currentOriginalGroup.classification !== 'TIED') {
    throw new Error('Initiative tie continuation must retain an original tied score group.')
  }
  requireScoreGroups({
    groups: [input.pending.currentOriginalGroup, ...input.pending.laterOriginalGroups],
    expectedKind,
    entitiesById: input.entitiesById,
    exactCohort: false
  })
  const segmentMembers = input.pending.completedSegments.flatMap((segment) => {
    requireCanonicalMembers({
      members: segment.members,
      expectedKind,
      entitiesById: input.entitiesById,
      minimum: segment.kind === 'SETTLED' ? 1 : 2
    })
    return segment.members
  })
  const retainedIdentities = [
    ...segmentMembers.map(identityKey),
    ...input.pending.currentOriginalGroup.members.map(identityKey),
    ...input.pending.laterOriginalGroups.flatMap((group) => group.members.map(identityKey))
  ]
  if (
    retainedIdentities.length !== input.entitiesById.size ||
    new Set(retainedIdentities).size !== input.entitiesById.size
  ) {
    throw new Error('Initiative tie continuation does not retain the exact canonical cohort.')
  }
  return exactBatchFromCanonicalEntities({
    batch: input.pending.pendingScoreBatch,
    members: input.pending.currentOriginalGroup.members,
    entitiesById: input.entitiesById
  })
}

async function resolveAttemptResult(input: {
  context: TieResolutionContext
  originalGroup: InitiativeScoreOrderGroup
  attemptOrdinal: number
  batch: Awaited<ReturnType<typeof startInitiativeScoreBatch>>
  completedAttempts: InitiativeTieEvaluationAttempt[]
  segments: InitiativeTieResolutionSegment[]
  laterGroups: readonly InitiativeScoreOrderGroup[]
}): Promise<InitiativeTieResolutionResult> {
  if (input.batch.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      completedAttempts: input.completedAttempts,
      completedSegments: input.segments,
      currentOriginalGroup: input.originalGroup,
      attemptOrdinal: input.attemptOrdinal,
      pendingScoreBatch: input.batch,
      laterOriginalGroups: input.laterGroups
    }
  }
  const completedAttempts = [
    ...input.completedAttempts,
    {
      originalScore: input.originalGroup.score,
      attemptOrdinal: input.attemptOrdinal,
      results: input.batch.completed
    }
  ]
  const ordered = prepareInitiativeOrdering({
    results: input.batch.completed,
    sortDirection: input.context.pin.sortDirection
  })
  if (ordered.kind === 'ORDER_CHOICE_REQUIRED') {
    input.segments.push(
      orderChoiceSegment({ score: input.originalGroup.score, members: ordered.entities })
    )
    return resolveOriginalGroups({
      context: input.context,
      groups: input.laterGroups,
      segments: input.segments,
      completedAttempts
    })
  }
  const tieResultsById = new Map(
    input.batch.completed.map((result) => [identityKey(result.entity), result] as const)
  )
  return resolveAttemptGroups({
    context: input.context,
    originalGroup: input.originalGroup,
    attemptOrdinal: input.attemptOrdinal,
    groups: ordered.groups,
    tieResultsById,
    segments: input.segments,
    laterGroups: input.laterGroups,
    completedAttempts
  })
}

async function resolveAttemptGroups(input: {
  context: TieResolutionContext
  originalGroup: InitiativeScoreOrderGroup
  attemptOrdinal: number
  groups: readonly InitiativeScoreOrderGroup[]
  tieResultsById: ReadonlyMap<string, InitiativeScoreBatchEntityResult>
  completedAttempts: InitiativeTieEvaluationAttempt[]
  segments: InitiativeTieResolutionSegment[]
  laterGroups: readonly InitiativeScoreOrderGroup[]
}): Promise<InitiativeTieResolutionResult> {
  for (const [index, group] of input.groups.entries()) {
    if (group.classification === 'SETTLED') {
      input.segments.push(settledSegment(group, input.tieResultsById))
      continue
    }
    const nextAttemptOrdinal = input.attemptOrdinal + 1
    if (!input.context.pin.repeatOnTie || nextAttemptOrdinal > input.context.pin.maximumAttempts) {
      input.segments.push(
        orderChoiceSegment({
          score: group.score,
          members: group.members,
          resultsById: input.tieResultsById
        })
      )
      continue
    }
    const batch = await startInitiativeScoreBatch({
      runtime: input.context.runtime,
      occurrenceId: input.context.occurrenceId,
      gameSystemId: input.context.gameSystemId,
      graph: input.context.graph,
      pin: input.context.pin,
      procedure: input.context.procedure,
      phase: 'TIE_RESOLUTION',
      mode: input.context.mode,
      entities: entitiesForMembers({
        members: group.members,
        entitiesById: input.context.entitiesById
      }),
      integerSource: input.context.integerSource
    })
    const resolved = await resolveAttemptResult({
      context: input.context,
      originalGroup: input.originalGroup,
      attemptOrdinal: nextAttemptOrdinal,
      batch,
      completedAttempts: input.completedAttempts,
      segments: input.segments,
      laterGroups: [...input.groups.slice(index + 1), ...input.laterGroups]
    })
    if (resolved.kind === 'PENDING') return resolved
    return resolved
  }
  return resolveOriginalGroups({
    context: input.context,
    groups: input.laterGroups,
    segments: input.segments,
    completedAttempts: input.completedAttempts
  })
}

async function resolveOriginalGroups(input: {
  context: TieResolutionContext
  groups: readonly InitiativeScoreOrderGroup[]
  segments: InitiativeTieResolutionSegment[]
  completedAttempts: InitiativeTieEvaluationAttempt[]
}): Promise<InitiativeTieResolutionResult> {
  for (const [index, group] of input.groups.entries()) {
    if (group.classification === 'SETTLED') {
      input.segments.push(settledSegment(group))
      continue
    }
    const batch = await startInitiativeScoreBatch({
      runtime: input.context.runtime,
      occurrenceId: input.context.occurrenceId,
      gameSystemId: input.context.gameSystemId,
      graph: input.context.graph,
      pin: input.context.pin,
      procedure: input.context.procedure,
      phase: 'TIE_RESOLUTION',
      mode: input.context.mode,
      entities: entitiesForMembers({
        members: group.members,
        entitiesById: input.context.entitiesById
      }),
      integerSource: input.context.integerSource
    })
    const resolved = await resolveAttemptResult({
      context: input.context,
      originalGroup: group,
      attemptOrdinal: 1,
      batch,
      completedAttempts: input.completedAttempts,
      segments: input.segments,
      laterGroups: input.groups.slice(index + 1)
    })
    if (resolved.kind === 'PENDING') return resolved
    return resolved
  }
  return {
    kind: 'COMPLETE',
    completedAttempts: input.completedAttempts,
    segments: input.segments
  }
}

function contextFromInput(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeTieGraphSnapshot
  pin: InitiativePolicyTieResolverPinDto
  procedure: InitiativeProcedure
  mode: EncounterEvidenceMode
  entities: readonly InitiativeScoreBatchEntity[]
  integerSource?: TrustedInitiativeIntegerSource
}): TieResolutionContext {
  requireExactTieGraph(input)
  return { ...input, entitiesById: requireCanonicalEntities(input) }
}

export async function startInitiativeTieResolution(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeTieGraphSnapshot
  pin: InitiativePolicyTieResolverPinDto
  procedure: InitiativeProcedure
  mode: EncounterEvidenceMode
  entities: readonly InitiativeScoreBatchEntity[]
  scoreGroups: readonly InitiativeScoreOrderGroup[]
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<InitiativeTieResolutionResult> {
  const context = contextFromInput(input)
  requireScoreGroups({
    groups: input.scoreGroups,
    expectedKind: expectedEntityKind(input.procedure),
    entitiesById: context.entitiesById,
    exactCohort: true
  })
  return resolveOriginalGroups({
    context,
    groups: input.scoreGroups,
    segments: [],
    completedAttempts: []
  })
}

export async function resumeInitiativeTieResolution(input: {
  runtime: RulesRuntimeService
  gameSystemId: string
  graph: InitiativeTieGraphSnapshot
  pin: InitiativePolicyTieResolverPinDto
  procedure: InitiativeProcedure
  mode: EncounterEvidenceMode
  entities: readonly InitiativeScoreBatchEntity[]
  pending: PendingInitiativeTieResolution
  requestId: string
  value: number
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<InitiativeTieResolutionResult> {
  const context = contextFromInput({
    ...input,
    occurrenceId: input.pending.pendingScoreBatch.continuation.occurrenceId
  })
  const pendingScoreBatch = requirePendingState({
    pending: input.pending,
    entitiesById: context.entitiesById,
    procedure: input.procedure,
    pin: input.pin
  })
  const batch = await resumeInitiativeScoreBatch({
    runtime: input.runtime,
    graph: input.graph,
    pin: input.pin,
    procedure: input.procedure,
    phase: 'TIE_RESOLUTION',
    mode: input.mode,
    batch: pendingScoreBatch,
    requestId: input.requestId,
    value: input.value,
    integerSource: input.integerSource
  })
  return resolveAttemptResult({
    context,
    originalGroup: input.pending.currentOriginalGroup,
    attemptOrdinal: input.pending.attemptOrdinal,
    batch,
    completedAttempts: [...input.pending.completedAttempts],
    segments: [...input.pending.completedSegments],
    laterGroups: input.pending.laterOriginalGroups
  })
}
