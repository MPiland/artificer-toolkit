import type { InitiativePolicyGraphPinDto } from '@artificer-toolkit/schema/shared/initiativePolicy'
import type { EncounterInitiativePolicySnapshotDto } from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { requiredRuleGraphFacts } from '@artificer-toolkit/shared/rules'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import type { InitiativeFactBinding } from './initiativeFactAdapter.js'
import type { EncounterEvidenceMode } from './encounterEvidenceMode.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  resumeInitiativeScoreGraph,
  startInitiativeScoreGraph,
  type InitiativeScoreExecution
} from './encounterInitiativeGraphExecution.js'

type InitiativeGraphSnapshot = EncounterInitiativePolicySnapshotDto['evaluationGraph']
type InitiativeProcedure = 'ACTOR_ROLL' | 'ACTOR_SCORE' | 'SIDE_ROLL' | 'DECLARED_ACTION_ROLL'
type InitiativeScoreBatchPhase = 'PRIMARY' | 'TIE_RESOLUTION'

export type InitiativeScoreBatchEntity = {
  kind: 'ACTOR' | 'SIDE'
  id: string
  binding: InitiativeFactBinding
}

type InitiativeScoreBatchEntityIdentity = Pick<InitiativeScoreBatchEntity, 'kind' | 'id'>

export type InitiativeScoreBatchEntityResult = {
  entity: InitiativeScoreBatchEntityIdentity
  result:
    | { kind: 'FACTS_UNAVAILABLE' }
    | { kind: 'EVIDENCE_NOT_ALLOWED' }
    | { kind: 'GRAPH_COMPLETE'; execution: InitiativeScoreExecution }
}

export type PendingInitiativeScoreBatch = {
  kind: 'PENDING'
  completed: readonly InitiativeScoreBatchEntityResult[]
  current: InitiativeScoreBatchEntity
  remaining: readonly InitiativeScoreBatchEntity[]
  continuation: ServerRuleExecutionContinuationDto
}

export type CompletedInitiativeScoreBatch = {
  kind: 'COMPLETE'
  completed: readonly InitiativeScoreBatchEntityResult[]
}

export type InitiativeScoreBatchResult = PendingInitiativeScoreBatch | CompletedInitiativeScoreBatch

export type TrustedInitiativeIntegerSource = (request: {
  requestId: string
  min: number
  max: number
}) => number

type InitiativeScoreBatchContext = {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeGraphSnapshot
  pin: InitiativePolicyGraphPinDto
  procedure: InitiativeProcedure
  phase: InitiativeScoreBatchPhase
  mode: EncounterEvidenceMode
  integerSource?: TrustedInitiativeIntegerSource
}

function entityIdentity(entity: InitiativeScoreBatchEntity): InitiativeScoreBatchEntityIdentity {
  return { kind: entity.kind, id: entity.id }
}

function expectedEntityKind(procedure: InitiativeProcedure): InitiativeScoreBatchEntity['kind'] {
  return procedure === 'SIDE_ROLL' ? 'SIDE' : 'ACTOR'
}

function requireCanonicalUniqueEntities(input: {
  entities: readonly InitiativeScoreBatchEntityIdentity[]
  procedure: InitiativeProcedure
}): void {
  if (input.entities.length < 1 || input.entities.length > AUTHORED_LIMITS.nestedCollectionItems) {
    throw new Error(
      `Initiative score batches require between 1 and ${AUTHORED_LIMITS.nestedCollectionItems} entities.`
    )
  }
  const requiredKind = expectedEntityKind(input.procedure)
  let priorId = ''
  for (const entity of input.entities) {
    const canonicalId = serverUuidIdentityDtoSchema.parse(entity.id)
    if (canonicalId !== entity.id) {
      throw new Error('Initiative score entities must use canonical lowercase UUID identities.')
    }
    if (entity.kind !== requiredKind) {
      throw new Error('Initiative score entity kind does not match the selected procedure.')
    }
    if (entity.id <= priorId) {
      throw new Error('Initiative score entities must have unique identities in canonical order.')
    }
    priorId = entity.id
  }
}

function unavailable(
  entity: InitiativeScoreBatchEntity,
  kind: 'FACTS_UNAVAILABLE' | 'EVIDENCE_NOT_ALLOWED'
): InitiativeScoreBatchEntityResult {
  return { entity: entityIdentity(entity), result: { kind } }
}

function completed(
  entity: InitiativeScoreBatchEntity,
  execution: InitiativeScoreExecution
): InitiativeScoreBatchEntityResult {
  return { entity: entityIdentity(entity), result: { kind: 'GRAPH_COMPLETE', execution } }
}

function requireAutomaticInteger(
  continuation: ServerRuleExecutionContinuationDto,
  source: TrustedInitiativeIntegerSource | undefined
): number {
  if (continuation.request.kind !== 'INTEGER_RANGE' || !source) {
    throw new Error('Automatic initiative execution requires a trusted integer source.')
  }
  const value = source({
    requestId: continuation.request.requestId,
    min: continuation.request.min,
    max: continuation.request.max
  })
  if (
    !Number.isInteger(value) ||
    value < continuation.request.min ||
    value > continuation.request.max
  ) {
    throw new Error('Trusted initiative integer evidence is outside the issued range.')
  }
  return value
}

async function completeAutomaticGraph(input: {
  context: InitiativeScoreBatchContext
  continuation: ServerRuleExecutionContinuationDto
}): Promise<InitiativeScoreExecution> {
  let continuation = input.continuation
  const maximumRequests = input.context.graph.document.nodes.length
  for (let requestCount = 0; requestCount < maximumRequests; requestCount += 1) {
    const value = requireAutomaticInteger(continuation, input.context.integerSource)
    const resumed = await resumeInitiativeScoreGraph({
      runtime: input.context.runtime,
      continuation,
      requestId: continuation.request.requestId,
      value,
      pin: input.context.pin
    })
    if (resumed.kind === 'COMPLETE') return resumed.result
    continuation = resumed.continuation
  }
  throw new Error('Initiative graph exceeded its bounded evidence-request count.')
}

async function executeEntity(input: {
  context: InitiativeScoreBatchContext
  entity: InitiativeScoreBatchEntity
}): Promise<
  | { kind: 'COMPLETE'; result: InitiativeScoreBatchEntityResult }
  | { kind: 'PENDING'; continuation: ServerRuleExecutionContinuationDto }
> {
  const binding = input.entity.binding
  // An actor whose facts lack one the graph reads (a tie rule's Dexterity score for a creature
  // without one) cannot be scored by it, so it falls to the policy's manual path.
  if (
    !binding.automatic ||
    [...requiredRuleGraphFacts(input.context.graph.document)].some(
      (key) => binding.facts[key] === undefined
    )
  ) {
    return { kind: 'COMPLETE', result: unavailable(input.entity, 'FACTS_UNAVAILABLE') }
  }
  const started = await startInitiativeScoreGraph({
    runtime: input.context.runtime,
    occurrenceId: input.context.occurrenceId,
    gameSystemId: input.context.gameSystemId,
    graph: input.context.graph,
    pin: input.context.pin,
    facts: binding.facts
  })
  if (started.kind === 'COMPLETE') {
    return { kind: 'COMPLETE', result: completed(input.entity, started.result) }
  }
  if (
    input.context.mode === 'MANUAL' ||
    (input.context.phase === 'PRIMARY' && input.context.procedure === 'ACTOR_SCORE')
  ) {
    return { kind: 'COMPLETE', result: unavailable(input.entity, 'EVIDENCE_NOT_ALLOWED') }
  }
  if (input.context.mode === 'PROMPT') {
    return { kind: 'PENDING', continuation: started.continuation }
  }
  return {
    kind: 'COMPLETE',
    result: completed(
      input.entity,
      await completeAutomaticGraph({ context: input.context, continuation: started.continuation })
    )
  }
}

async function executeRemaining(input: {
  context: InitiativeScoreBatchContext
  completed: InitiativeScoreBatchEntityResult[]
  entities: readonly InitiativeScoreBatchEntity[]
}): Promise<InitiativeScoreBatchResult> {
  for (const [index, entity] of input.entities.entries()) {
    const execution = await executeEntity({ context: input.context, entity })
    if (execution.kind === 'PENDING') {
      return {
        kind: 'PENDING',
        completed: input.completed,
        current: entity,
        remaining: input.entities.slice(index + 1),
        continuation: execution.continuation
      }
    }
    input.completed.push(execution.result)
  }
  return { kind: 'COMPLETE', completed: input.completed }
}

export async function startInitiativeScoreBatch(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  graph: InitiativeGraphSnapshot
  pin: InitiativePolicyGraphPinDto
  procedure: InitiativeProcedure
  phase: InitiativeScoreBatchPhase
  mode: EncounterEvidenceMode
  entities: readonly InitiativeScoreBatchEntity[]
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<InitiativeScoreBatchResult> {
  requireCanonicalUniqueEntities({ entities: input.entities, procedure: input.procedure })
  return executeRemaining({
    context: input,
    completed: [],
    entities: input.entities
  })
}

export async function resumeInitiativeScoreBatch(input: {
  runtime: RulesRuntimeService
  graph: InitiativeGraphSnapshot
  pin: InitiativePolicyGraphPinDto
  procedure: InitiativeProcedure
  phase: InitiativeScoreBatchPhase
  mode: EncounterEvidenceMode
  batch: PendingInitiativeScoreBatch
  requestId: string
  value: number
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<InitiativeScoreBatchResult> {
  if (input.mode === 'MANUAL') {
    throw new Error('Manual initiative cannot resume rule-generated evidence.')
  }
  requireCanonicalUniqueEntities({
    entities: [
      ...input.batch.completed.map((entry) => entry.entity),
      input.batch.current,
      ...input.batch.remaining
    ],
    procedure: input.procedure
  })
  if (input.requestId !== input.batch.continuation.request.requestId) {
    throw new Error('Initiative score evidence does not match the issued request.')
  }
  if (
    input.batch.continuation.request.kind !== 'INTEGER_RANGE' ||
    !Number.isInteger(input.value) ||
    input.value < input.batch.continuation.request.min ||
    input.value > input.batch.continuation.request.max
  ) {
    throw new Error('Initiative score evidence is outside the issued range.')
  }
  const context: InitiativeScoreBatchContext = {
    runtime: input.runtime,
    occurrenceId: input.batch.continuation.occurrenceId,
    gameSystemId: input.graph.document.gameSystemId,
    graph: input.graph,
    pin: input.pin,
    procedure: input.procedure,
    phase: input.phase,
    mode: input.mode,
    integerSource: input.integerSource
  }
  const resumed = await resumeInitiativeScoreGraph({
    runtime: context.runtime,
    continuation: input.batch.continuation,
    requestId: input.requestId,
    value: input.value,
    pin: input.pin
  })
  if (resumed.kind === 'PENDING') {
    if (
      context.mode === 'MANUAL' ||
      (context.phase === 'PRIMARY' && context.procedure === 'ACTOR_SCORE')
    ) {
      return executeRemaining({
        context,
        completed: [
          ...input.batch.completed,
          unavailable(input.batch.current, 'EVIDENCE_NOT_ALLOWED')
        ],
        entities: input.batch.remaining
      })
    }
    if (context.mode === 'PROMPT') {
      return {
        kind: 'PENDING',
        completed: input.batch.completed,
        current: input.batch.current,
        remaining: input.batch.remaining,
        continuation: resumed.continuation
      }
    }
    return executeRemaining({
      context,
      completed: [
        ...input.batch.completed,
        completed(
          input.batch.current,
          await completeAutomaticGraph({ context, continuation: resumed.continuation })
        )
      ],
      entities: input.batch.remaining
    })
  }
  return executeRemaining({
    context,
    completed: [...input.batch.completed, completed(input.batch.current, resumed.result)],
    entities: input.batch.remaining
  })
}
