import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import type { EncounterEvidenceMode } from './encounterEvidenceMode.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { createEncounterInitiativeScoreEntities } from './encounterInitiativeEntities.js'
import {
  resumeInitiativeOrderResolution,
  startInitiativeOrderResolution,
  type InitiativeOrderChoiceEvidence,
  type PendingInitiativeOrderResolution
} from './encounterInitiativeOrderResolution.js'
import { prepareInitiativeOrdering } from './encounterInitiativeOrdering.js'
import {
  resumeInitiativeScoreBatch,
  startInitiativeScoreBatch,
  type InitiativeScoreBatchEntity,
  type InitiativeScoreBatchEntityResult,
  type PendingInitiativeScoreBatch,
  type TrustedInitiativeIntegerSource
} from './encounterInitiativeScoreBatch.js'
import {
  recordEncounterInitiativeScoreBatch,
  recordEncounterInitiativeTieResolution
} from './encounterInitiativeStateEvaluation.js'
import { settleEncounterInitiativeRound } from './encounterInitiativeStateSettlement.js'
import {
  resumeInitiativeTieResolution,
  startInitiativeTieResolution,
  type InitiativeTieEvaluationAttempt,
  type InitiativeTieResolutionSegment,
  type PendingInitiativeTieResolution
} from './encounterInitiativeTieResolution.js'

type InitiativeRepository = Parameters<typeof settleEncounterInitiativeRound>[0]['repository']
type InitiativePolicyProcedure = 'ACTOR_ROLL' | 'ACTOR_SCORE' | 'SIDE_ROLL' | 'DECLARED_ACTION_ROLL'

export type EncounterInitiativeExecutionEvidence = {
  primaryResults: readonly InitiativeScoreBatchEntityResult[]
  tieAttempts: readonly InitiativeTieEvaluationAttempt[]
  orderChoices: readonly InitiativeOrderChoiceEvidence[]
}

export type PendingEncounterInitiativeLifecycle =
  | { phase: 'PRIMARY_SCORE'; scoreBatch: PendingInitiativeScoreBatch }
  | {
      phase: 'TIE_RESOLUTION'
      primaryResults: readonly InitiativeScoreBatchEntityResult[]
      tieResolution: PendingInitiativeTieResolution
    }
  | {
      phase: 'ENTITY_ORDER'
      evidence: EncounterInitiativeExecutionEvidence
      entityKind: 'ACTOR' | 'SIDE'
      orderResolution: PendingInitiativeOrderResolution
    }
  | {
      phase: 'SIDE_ACTOR_ORDER'
      evidence: EncounterInitiativeExecutionEvidence
      orderedSideIds: readonly string[]
      orderResolution: PendingInitiativeOrderResolution
    }

export type EncounterInitiativeLifecycleResult =
  | {
      kind: 'PENDING'
      state: EncounterInitiativeRoundStateDto
      pending: PendingEncounterInitiativeLifecycle
    }
  | {
      kind: 'SETTLED'
      state: EncounterInitiativeRoundStateDto
      orderedActorIds: readonly string[]
      orderedSideIds: readonly string[]
      evidence: EncounterInitiativeExecutionEvidence
    }

type InitiativeLifecycleContext = {
  repository: InitiativeRepository
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  snapshot: EncounterInitiativePolicySnapshotDto
  mode: EncounterEvidenceMode
  entities: readonly InitiativeScoreBatchEntity[]
  integerSource?: TrustedInitiativeIntegerSource
}

function requirePolicyContext(input: {
  state: EncounterInitiativeRoundStateDto
  snapshot: EncounterInitiativePolicySnapshotDto
  snapshotChecksum: string
}): InitiativePolicyProcedure {
  const procedure = input.snapshot.policy.document.procedure
  if (
    input.state.round.status !== 'PREPARING' ||
    input.state.round.procedure !== procedure ||
    input.state.round.cadence !== input.snapshot.policy.document.cadence ||
    input.state.round.policySnapshotChecksum !== input.snapshotChecksum ||
    input.snapshot.gameSystemId !== input.snapshot.policy.document.gameSystemId
  ) {
    throw new Error(
      'Normalized initiative round does not match its exact Encounter policy snapshot.'
    )
  }
  return procedure
}

function tiePin(context: InitiativeLifecycleContext) {
  const pin = context.snapshot.policy.document.tieResolvers.find(
    (candidate) => candidate.definitionId === context.snapshot.tieResolver.definitionId
  )
  if (!pin) throw new Error('Encounter initiative tie resolver is outside the pinned policy.')
  return pin
}

function actorIdentities(state: EncounterInitiativeRoundStateDto) {
  return state.participants.map((participant) => ({
    kind: 'ACTOR' as const,
    id: participant.actorId
  }))
}

function sideActorSegments(input: {
  state: EncounterInitiativeRoundStateDto
  orderedSideIds: readonly string[]
}): InitiativeTieResolutionSegment[] {
  return input.orderedSideIds.map((sideId) => {
    const members = input.state.participants
      .filter((participant) => participant.sideId === sideId)
      .map((participant) => ({ kind: 'ACTOR' as const, id: participant.actorId }))
    if (members.length < 1)
      throw new Error('Settled initiative side has no normalized participants.')
    return {
      kind: members.length === 1 ? ('SETTLED' as const) : ('ORDER_CHOICE_REQUIRED' as const),
      score: 0,
      members
    }
  })
}

async function settleEntityOrder(input: {
  context: InitiativeLifecycleContext
  state: EncounterInitiativeRoundStateDto
  evidence: EncounterInitiativeExecutionEvidence
  orderedEntities: readonly { kind: 'ACTOR' | 'SIDE'; id: string }[]
}): Promise<EncounterInitiativeLifecycleResult> {
  if (input.orderedEntities[0]?.kind !== 'SIDE') {
    const orderedActorIds = input.orderedEntities.map((entity) => entity.id)
    return {
      kind: 'SETTLED',
      state: await settleEncounterInitiativeRound({
        repository: input.context.repository,
        state: input.state,
        orderedActorIds
      }),
      orderedActorIds,
      orderedSideIds: [],
      evidence: input.evidence
    }
  }
  const orderedSideIds = input.orderedEntities.map((entity) => entity.id)
  const order = await startInitiativeOrderResolution({
    runtime: input.context.runtime,
    occurrenceId: input.context.occurrenceId,
    gameSystemId: input.context.gameSystemId,
    graph: input.context.snapshot.orderChoiceGraph,
    pin: input.context.snapshot.policy.document.orderChoiceGraph,
    entities: actorIdentities(input.state),
    segments: sideActorSegments({ state: input.state, orderedSideIds })
  })
  if (order.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      state: input.state,
      pending: {
        phase: 'SIDE_ACTOR_ORDER',
        evidence: input.evidence,
        orderedSideIds,
        orderResolution: order
      }
    }
  }
  const evidence = {
    ...input.evidence,
    orderChoices: [...input.evidence.orderChoices, ...order.choices]
  }
  const orderedActorIds = order.orderedEntities.map((entity) => entity.id)
  return {
    kind: 'SETTLED',
    state: await settleEncounterInitiativeRound({
      repository: input.context.repository,
      state: input.state,
      orderedActorIds,
      orderedSideIds
    }),
    orderedActorIds,
    orderedSideIds,
    evidence
  }
}

async function startEntityOrder(input: {
  context: InitiativeLifecycleContext
  state: EncounterInitiativeRoundStateDto
  evidence: EncounterInitiativeExecutionEvidence
  segments: readonly InitiativeTieResolutionSegment[]
}): Promise<EncounterInitiativeLifecycleResult> {
  const order = await startInitiativeOrderResolution({
    runtime: input.context.runtime,
    occurrenceId: input.context.occurrenceId,
    gameSystemId: input.context.gameSystemId,
    graph: input.context.snapshot.orderChoiceGraph,
    pin: input.context.snapshot.policy.document.orderChoiceGraph,
    entities: input.context.entities,
    segments: input.segments
  })
  if (order.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      state: input.state,
      pending: {
        phase: 'ENTITY_ORDER',
        evidence: input.evidence,
        entityKind: input.context.entities[0]!.kind,
        orderResolution: order
      }
    }
  }
  return settleEntityOrder({
    context: input.context,
    state: input.state,
    evidence: {
      ...input.evidence,
      orderChoices: [...input.evidence.orderChoices, ...order.choices]
    },
    orderedEntities: order.orderedEntities
  })
}

async function continueAfterPrimary(input: {
  context: InitiativeLifecycleContext
  state: EncounterInitiativeRoundStateDto
  batch: Exclude<Awaited<ReturnType<typeof startInitiativeScoreBatch>>, { kind: 'PENDING' }>
}): Promise<EncounterInitiativeLifecycleResult> {
  const ordered = prepareInitiativeOrdering({
    results: input.batch.completed,
    sortDirection: input.context.snapshot.policy.document.evaluationGraph.sortDirection
  })
  if (ordered.kind === 'ORDER_CHOICE_REQUIRED') {
    return startEntityOrder({
      context: input.context,
      state: input.state,
      evidence: { primaryResults: input.batch.completed, tieAttempts: [], orderChoices: [] },
      segments: [{ kind: 'ORDER_CHOICE_REQUIRED', score: 0, members: ordered.entities }]
    })
  }
  const resolution = await startInitiativeTieResolution({
    runtime: input.context.runtime,
    occurrenceId: input.context.occurrenceId,
    gameSystemId: input.context.gameSystemId,
    graph: input.context.snapshot.tieResolver,
    pin: tiePin(input.context),
    procedure: input.context.snapshot.policy.document.procedure,
    mode: input.context.mode,
    entities: input.context.entities,
    scoreGroups: ordered.groups,
    integerSource: input.context.integerSource
  })
  const state = await recordEncounterInitiativeTieResolution({
    repository: input.context.repository,
    state: input.state,
    occurrenceId: input.context.occurrenceId,
    resolution
  })
  if (resolution.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      state,
      pending: {
        phase: 'TIE_RESOLUTION',
        primaryResults: input.batch.completed,
        tieResolution: resolution
      }
    }
  }
  return startEntityOrder({
    context: input.context,
    state,
    evidence: {
      primaryResults: input.batch.completed,
      tieAttempts: resolution.completedAttempts,
      orderChoices: []
    },
    segments: resolution.segments
  })
}

export async function startEncounterInitiativeLifecycle(input: {
  repository: InitiativeRepository
  runtime: RulesRuntimeService | null
  occurrenceId: string
  gameSystemId: string
  state: EncounterInitiativeRoundStateDto
  snapshot: EncounterInitiativePolicySnapshotDto | null
  snapshotChecksum: string | null
  sources: InitiativeFactSources
  adapter: InitiativeFactAdapter | null
  mode: EncounterEvidenceMode
  legacyOrderedActorIds: readonly string[]
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<EncounterInitiativeLifecycleResult> {
  if (!input.snapshot) {
    if (
      input.snapshotChecksum !== null ||
      input.state.round.procedure !== 'MANUAL' ||
      input.state.round.policySnapshotChecksum !== null
    ) {
      throw new Error('Manual initiative round cannot retain a policy snapshot.')
    }
    return {
      kind: 'SETTLED',
      state: await settleEncounterInitiativeRound({
        repository: input.repository,
        state: input.state,
        orderedActorIds: input.legacyOrderedActorIds
      }),
      orderedActorIds: input.legacyOrderedActorIds,
      orderedSideIds: [],
      evidence: { primaryResults: [], tieAttempts: [], orderChoices: [] }
    }
  }
  if (!input.snapshotChecksum || !input.adapter || !input.runtime) {
    throw new Error(
      'Policy initiative requires its exact snapshot checksum, System adapter, and rules runtime.'
    )
  }
  const procedure = requirePolicyContext({
    state: input.state,
    snapshot: input.snapshot,
    snapshotChecksum: input.snapshotChecksum
  })
  const entities = createEncounterInitiativeScoreEntities({
    state: input.state,
    policy: input.snapshot.policy.document,
    sources: input.sources,
    adapter: input.adapter
  })
  const context: InitiativeLifecycleContext = {
    repository: input.repository,
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.gameSystemId,
    snapshot: input.snapshot,
    mode: input.mode,
    entities,
    integerSource: input.integerSource
  }
  const batch = await startInitiativeScoreBatch({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.gameSystemId,
    graph: input.snapshot.evaluationGraph,
    pin: input.snapshot.policy.document.evaluationGraph,
    procedure,
    phase: 'PRIMARY',
    mode: input.mode,
    entities,
    integerSource: input.integerSource
  })
  const state = await recordEncounterInitiativeScoreBatch({
    repository: input.repository,
    state: input.state,
    occurrenceId: input.occurrenceId,
    phase: 'PRIMARY',
    batch
  })
  if (batch.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      state,
      pending: { phase: 'PRIMARY_SCORE', scoreBatch: batch }
    }
  }
  return continueAfterPrimary({ context, state, batch })
}

export async function resumeEncounterInitiativeLifecycle(input: {
  repository: InitiativeRepository
  runtime: RulesRuntimeService
  gameSystemId: string
  state: EncounterInitiativeRoundStateDto
  snapshot: EncounterInitiativePolicySnapshotDto
  snapshotChecksum: string
  sources: InitiativeFactSources
  adapter: InitiativeFactAdapter
  mode: EncounterEvidenceMode
  pending: PendingEncounterInitiativeLifecycle
  requestId: string
  value: number | { selectedEntityId: string }
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<EncounterInitiativeLifecycleResult> {
  const procedure = requirePolicyContext(input)
  const entities = createEncounterInitiativeScoreEntities({
    state: input.state,
    policy: input.snapshot.policy.document,
    sources: input.sources,
    adapter: input.adapter
  })
  const occurrenceId =
    input.pending.phase === 'PRIMARY_SCORE'
      ? input.pending.scoreBatch.continuation.occurrenceId
      : input.pending.phase === 'TIE_RESOLUTION'
        ? input.pending.tieResolution.pendingScoreBatch.continuation.occurrenceId
        : input.pending.orderResolution.continuation.occurrenceId
  const context: InitiativeLifecycleContext = {
    repository: input.repository,
    runtime: input.runtime,
    occurrenceId,
    gameSystemId: input.gameSystemId,
    snapshot: input.snapshot,
    mode: input.mode,
    entities,
    integerSource: input.integerSource
  }
  if (input.pending.phase === 'PRIMARY_SCORE') {
    if (typeof input.value !== 'number')
      throw new Error('Initiative score requires integer evidence.')
    const batch = await resumeInitiativeScoreBatch({
      runtime: input.runtime,
      graph: input.snapshot.evaluationGraph,
      pin: input.snapshot.policy.document.evaluationGraph,
      procedure,
      phase: 'PRIMARY',
      mode: input.mode,
      batch: input.pending.scoreBatch,
      requestId: input.requestId,
      value: input.value,
      integerSource: input.integerSource
    })
    const state = await recordEncounterInitiativeScoreBatch({
      repository: input.repository,
      state: input.state,
      occurrenceId,
      phase: 'PRIMARY',
      batch
    })
    if (batch.kind === 'PENDING') {
      return { kind: 'PENDING', state, pending: { phase: 'PRIMARY_SCORE', scoreBatch: batch } }
    }
    return continueAfterPrimary({ context, state, batch })
  }
  if (input.pending.phase === 'TIE_RESOLUTION') {
    if (typeof input.value !== 'number')
      throw new Error('Initiative tie requires integer evidence.')
    const resolution = await resumeInitiativeTieResolution({
      runtime: input.runtime,
      gameSystemId: input.gameSystemId,
      graph: input.snapshot.tieResolver,
      pin: tiePin(context),
      procedure,
      mode: input.mode,
      entities,
      pending: input.pending.tieResolution,
      requestId: input.requestId,
      value: input.value,
      integerSource: input.integerSource
    })
    const state = await recordEncounterInitiativeTieResolution({
      repository: input.repository,
      state: input.state,
      occurrenceId,
      resolution
    })
    if (resolution.kind === 'PENDING') {
      return {
        kind: 'PENDING',
        state,
        pending: {
          phase: 'TIE_RESOLUTION',
          primaryResults: input.pending.primaryResults,
          tieResolution: resolution
        }
      }
    }
    return startEntityOrder({
      context,
      state,
      evidence: {
        primaryResults: input.pending.primaryResults,
        tieAttempts: resolution.completedAttempts,
        orderChoices: []
      },
      segments: resolution.segments
    })
  }
  if (typeof input.value === 'number')
    throw new Error('Initiative order requires an entity selection.')
  const orderEntities =
    input.pending.phase === 'SIDE_ACTOR_ORDER' ? actorIdentities(input.state) : entities
  const order = await resumeInitiativeOrderResolution({
    runtime: input.runtime,
    gameSystemId: input.gameSystemId,
    graph: input.snapshot.orderChoiceGraph,
    pin: input.snapshot.policy.document.orderChoiceGraph,
    entities: orderEntities,
    pending: input.pending.orderResolution,
    requestId: input.requestId,
    selectedEntityId: input.value.selectedEntityId
  })
  if (order.kind === 'PENDING') {
    return {
      kind: 'PENDING',
      state: input.state,
      pending:
        input.pending.phase === 'SIDE_ACTOR_ORDER'
          ? {
              phase: 'SIDE_ACTOR_ORDER',
              evidence: input.pending.evidence,
              orderedSideIds: input.pending.orderedSideIds,
              orderResolution: order
            }
          : {
              phase: 'ENTITY_ORDER',
              evidence: input.pending.evidence,
              entityKind: input.pending.entityKind,
              orderResolution: order
            }
    }
  }
  if (input.pending.phase === 'SIDE_ACTOR_ORDER') {
    const evidence = {
      ...input.pending.evidence,
      orderChoices: [...input.pending.evidence.orderChoices, ...order.choices]
    }
    const orderedActorIds = order.orderedEntities.map((entity) => entity.id)
    return {
      kind: 'SETTLED',
      state: await settleEncounterInitiativeRound({
        repository: input.repository,
        state: input.state,
        orderedActorIds,
        orderedSideIds: input.pending.orderedSideIds
      }),
      orderedActorIds,
      orderedSideIds: input.pending.orderedSideIds,
      evidence
    }
  }
  return settleEntityOrder({
    context,
    state: input.state,
    evidence: {
      ...input.pending.evidence,
      orderChoices: [...input.pending.evidence.orderChoices, ...order.choices]
    },
    orderedEntities: order.orderedEntities
  })
}
