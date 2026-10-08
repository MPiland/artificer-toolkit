import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { EncounterEvidenceMode } from './encounterEvidenceMode.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { findEncounterFeatureResource } from './encounterActorRuleOutput.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

type EncounterRechargeActor = Pick<EncounterRunActorState, 'id' | 'kind'> & {
  snapshot: unknown
}

export type EncounterRechargeCandidate = {
  actorId: string
  featureId: string
  featureVersionChecksum: string
  policy: {
    gameSystemId: string
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    graphDefinitionId: string
    graphDefinitionVersion: number
    graphDefinitionChecksum: string
    rechargedOutput: string
  }
  beforeUsed: number
  maximum: number
}

type EncounterRechargeExecution =
  | {
      kind: 'COMPLETE'
      candidate: EncounterRechargeCandidate
      execution: ServerCompletedRuleExecutionDto
      recharged: boolean
      afterUsed: number
      rawDie: number | null
    }
  | {
      kind: 'PENDING'
      candidate: EncounterRechargeCandidate
      continuation: ServerRuleExecutionContinuationDto
    }

function snapshotCreature(actor: EncounterRechargeActor): {
  systemId: string
  features: readonly FeatureDto[]
} | null {
  if (actor.kind !== 'CREATURE' || !actor.snapshot || typeof actor.snapshot !== 'object')
    return null
  const snapshot = actor.snapshot as Record<string, unknown>
  const systemId = serverUuidIdentityDtoSchema.safeParse(snapshot.systemId)
  if (!systemId.success) return null
  const payload = snapshot.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const features = (payload as Record<string, unknown>).features
  if (!Array.isArray(features)) return null
  return {
    systemId: systemId.data,
    features: features.flatMap((feature) => {
      const parsed = featureDtoSchema.safeParse(feature)
      return parsed.success ? [parsed.data] : []
    })
  }
}

function requireCurrentIntegrity(current: ReusableDefinitionCurrentDto): void {
  if (checksumRuleDocument(current.document) !== current.checksum)
    throw new EncounterConflictError('Encounter lifecycle definition checksum is invalid.')
}

async function resolveCandidatePolicy(input: {
  definitions: CurrentReusableDefinitionSource
  actor: EncounterRechargeActor
  snapshotSystemId: string
  feature: FeatureDto
  resource: NonNullable<ReturnType<typeof findEncounterFeatureResource>>
}): Promise<EncounterRechargeCandidate | null> {
  if (!input.feature.ruleDefinitionIds?.length) return null
  const matching: EncounterRechargeCandidate['policy'][] = []
  for (const definitionId of input.feature.ruleDefinitionIds) {
    const current = await input.definitions.requireCurrent(definitionId)
    requireCurrentIntegrity(current)
    if (current.id !== definitionId || current.gameSystemId !== input.snapshotSystemId) {
      throw new EncounterConflictError('Encounter lifecycle definition System identity is stale.')
    }
    const parsed = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
      current.document
    )
    if (!parsed.success || parsed.data.kind !== 'RECHARGE') continue
    const document = parsed.data
    const graph = await input.definitions.requireCurrent(document.rechargeGraph.definitionId)
    requireCurrentIntegrity(graph)
    if (
      graph.id !== document.rechargeGraph.definitionId ||
      graph.gameSystemId !== input.snapshotSystemId ||
      graph.version !== document.rechargeGraph.definitionVersion ||
      graph.checksum !== document.rechargeGraph.definitionChecksum
    ) {
      throw new EncounterConflictError('Recharge graph pin is stale.')
    }
    const graphDocument = ruleGraphDefinitionDtoSchema.safeParse(graph.document)
    if (!graphDocument.success) {
      throw new EncounterConflictError('Recharge graph definition is unavailable.')
    }
    matching.push({
      definitionId: current.id,
      gameSystemId: current.gameSystemId,
      definitionVersion: current.version,
      definitionChecksum: current.checksum,
      graphDefinitionId: graph.id,
      graphDefinitionVersion: graph.version,
      graphDefinitionChecksum: graph.checksum,
      rechargedOutput: document.rechargeGraph.rechargedOutput
    })
  }
  if (matching.length === 0) return null
  if (matching.length !== 1)
    throw new EncounterValidationError('Feature has ambiguous recharge lifecycle bindings.')
  if (
    input.resource.maximum === null ||
    input.resource.remaining === null ||
    input.resource.used < 1 ||
    input.resource.used > input.resource.maximum
  ) {
    return null
  }
  return {
    actorId: input.actor.id,
    featureId: input.feature.id,
    featureVersionChecksum: checksumRuleDocument(input.feature),
    policy: matching[0]!,
    beforeUsed: input.resource.used,
    maximum: input.resource.maximum
  }
}

/** Selects only exact Feature-bound recharge policies. */
export async function discoverEncounterRechargeCandidates(input: {
  /** Recharge is evaluated only for the actor entering START_OF_TURN. */
  actorId: string
  encounterActors: readonly EncounterRechargeActor[]
  actorRules: EncounterActorRuleOutput
  definitions: CurrentReusableDefinitionSource
}): Promise<readonly EncounterRechargeCandidate[]> {
  const candidates: EncounterRechargeCandidate[] = []
  for (const actor of [...input.encounterActors].sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (actor.id !== input.actorId) continue
    if (actor.kind !== 'CREATURE') continue
    const snapshot = snapshotCreature(actor)
    if (!snapshot) continue
    for (const feature of [...snapshot.features].sort((left, right) =>
      left.id.localeCompare(right.id)
    )) {
      const resource = findEncounterFeatureResource(input.actorRules, actor.id, feature.id)
      if (!resource) continue
      const candidate = await resolveCandidatePolicy({
        definitions: input.definitions,
        actor,
        snapshotSystemId: snapshot.systemId,
        feature,
        resource
      })
      if (candidate) candidates.push(candidate)
    }
  }
  return candidates
}

function publishedGraph(input: {
  current: ReusableDefinitionCurrentDto
  candidate: EncounterRechargeCandidate
}) {
  const graph = ruleGraphDefinitionDtoSchema.safeParse(input.current.document)
  if (!graph.success || input.current.id !== input.candidate.policy.graphDefinitionId) {
    throw new EncounterConflictError('Recharge graph is unavailable.')
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: input.current.id,
    gameSystemId: input.current.gameSystemId,
    definitionFamilyKey: input.current.definitionFamilyKey,
    checksum: input.current.checksum,
    definition: graph.data
  })
}

function requireRechargeResult(input: {
  candidate: EncounterRechargeCandidate
  execution: ServerCompletedRuleExecutionDto
}) {
  const value = input.execution.outputs[input.candidate.policy.rechargedOutput]
  if (typeof value !== 'boolean')
    throw new EncounterValidationError('Recharge graph did not produce its pinned BOOLEAN output.')
  return value
}

function requireD6Request(continuation: ServerRuleExecutionContinuationDto) {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 6
  ) {
    throw new EncounterValidationError('Recharge policy requested unsupported evidence.')
  }
}

/** Executes one pinned recharge graph. The Encounter turn coordinator owns persistence and CAS. */
export async function executeEncounterRechargeCandidate(input: {
  candidate: EncounterRechargeCandidate
  occurrenceId: string
  definitions: CurrentReusableDefinitionSource
  runtime: RulesRuntimeService
  mode: EncounterEvidenceMode
  continuation?: ServerRuleExecutionContinuationDto
  rawDie?: number
  rollD6?: () => number
}): Promise<EncounterRechargeExecution | null> {
  if (input.mode === 'MANUAL') return null
  const lifecycle = await input.definitions.requireCurrent(input.candidate.policy.definitionId)
  requireCurrentIntegrity(lifecycle)
  const lifecycleDocument = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.safeParse(
    lifecycle.document
  )
  if (
    !lifecycleDocument.success ||
    lifecycleDocument.data.kind !== 'RECHARGE' ||
    lifecycle.id !== input.candidate.policy.definitionId ||
    lifecycle.gameSystemId !== input.candidate.policy.gameSystemId ||
    lifecycle.version !== input.candidate.policy.definitionVersion ||
    lifecycle.checksum !== input.candidate.policy.definitionChecksum ||
    lifecycleDocument.data.boundary !== 'START_OF_TURN' ||
    lifecycleDocument.data.recovery !== 'FULL' ||
    lifecycleDocument.data.rechargeGraph.definitionId !==
      input.candidate.policy.graphDefinitionId ||
    lifecycleDocument.data.rechargeGraph.definitionVersion !==
      input.candidate.policy.graphDefinitionVersion ||
    lifecycleDocument.data.rechargeGraph.definitionChecksum !==
      input.candidate.policy.graphDefinitionChecksum ||
    lifecycleDocument.data.rechargeGraph.rechargedOutput !== input.candidate.policy.rechargedOutput
  ) {
    throw new EncounterConflictError('Recharge lifecycle policy changed before execution.')
  }
  const current = await input.definitions.requireCurrent(input.candidate.policy.graphDefinitionId)
  requireCurrentIntegrity(current)
  if (
    current.id !== input.candidate.policy.graphDefinitionId ||
    current.gameSystemId !== input.candidate.policy.gameSystemId ||
    current.version !== input.candidate.policy.graphDefinitionVersion ||
    current.checksum !== input.candidate.policy.graphDefinitionChecksum
  ) {
    throw new EncounterConflictError('Recharge graph changed before execution.')
  }
  const published = publishedGraph({ current, candidate: input.candidate })
  const settle = async (continuation: ServerRuleExecutionContinuationDto, rawDie: number) => {
    requireD6Request(continuation)
    if (!Number.isInteger(rawDie) || rawDie < 1 || rawDie > 6)
      throw new EncounterValidationError('Recharge die must be an integer from 1 to 6.')
    if (
      continuation.occurrenceId !== input.occurrenceId ||
      continuation.graph.source.definitionId !== input.candidate.policy.graphDefinitionId ||
      continuation.graph.source.checksum !== input.candidate.policy.graphDefinitionChecksum
    ) {
      throw new EncounterConflictError('Recharge continuation is stale.')
    }
    const execution = await input.runtime.resume({
      continuation,
      response: { requestId: continuation.request.requestId, value: rawDie }
    })
    if (execution.status !== 'COMPLETE')
      throw new EncounterValidationError('Recharge policy requested more than one evidence stage.')
    const recharged = requireRechargeResult({ candidate: input.candidate, execution })
    return {
      kind: 'COMPLETE' as const,
      candidate: input.candidate,
      execution,
      recharged,
      afterUsed: recharged ? 0 : input.candidate.beforeUsed,
      rawDie
    }
  }
  if (input.continuation) {
    if (input.rawDie === undefined)
      throw new EncounterValidationError('Assisted recharge evidence is required.')
    return settle(input.continuation, input.rawDie)
  }
  if (input.rawDie !== undefined)
    throw new EncounterConflictError('Recharge has no pending evidence request.')
  const started = await input.runtime.executeResolved({
    command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: {} },
    published
  })
  if (started.status === 'COMPLETE') {
    const recharged = requireRechargeResult({ candidate: input.candidate, execution: started })
    return {
      kind: 'COMPLETE',
      candidate: input.candidate,
      execution: started,
      recharged,
      afterUsed: recharged ? 0 : input.candidate.beforeUsed,
      rawDie: null
    }
  }
  requireD6Request(started.continuation)
  if (input.mode === 'PROMPT')
    return { kind: 'PENDING', candidate: input.candidate, continuation: started.continuation }
  if (!input.rollD6) throw new EncounterValidationError('Automatic recharge evidence is required.')
  return settle(started.continuation, input.rollD6())
}
