import { randomInt } from 'node:crypto'

import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  type ServerCompletedRuleExecutionDto,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionNestedD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  CharacterRuleActionApplication,
  CharacterRuleActionSystemAdapter
} from '../rules/characterRuleActionSystemAdapter.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

export type MovementReactionActionResolution =
  | {
      kind: 'ENTER_DICE'
      requestId: string
      rawFaces: readonly number[]
    }
  | { kind: 'SYSTEM_ROLL'; requestId: string }

export interface PreparedEncounterMovementReactionAction {
  adapter: CharacterRuleActionSystemAdapter
  published: ServerPublishedRuleDefinitionDto
  actionMechanic: Readonly<Record<string, unknown>>
  movementInterruption?: null | { kind: 'STOP'; whenResultPath: string }
  sourceDerivedFacts: Readonly<Record<string, unknown>>
  target: {
    actorId: string
    currentHitPoints: number
    temporaryHitPoints: number
    maximumHitPoints: number
    scalarValues: Readonly<Record<string, number>>
    conditionIds: readonly string[]
    derivedFacts: Readonly<Record<string, unknown>>
    defenses: readonly {
      kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
      damageTypeId: string
    }[]
    conditionImmunityIds: readonly string[]
  }
}

function bindMovementInterruption(input: {
  execution: ServerCompletedRuleExecutionDto
  binding: PreparedEncounterMovementReactionAction['movementInterruption']
}): ServerCompletedRuleExecutionDto {
  if (input.binding === null || input.binding === undefined)
    return { ...input.execution, movementInterruption: null }
  if (typeof input.execution.outputs.movementInterruption !== 'boolean') {
    throw new EncounterValidationError('The movement interruption output is invalid.')
  }
  return {
    ...input.execution,
    movementInterruption: input.execution.outputs.movementInterruption ? { kind: 'STOP' } : null
  }
}

export type EncounterMovementReactionActionExecution =
  | {
      kind: 'PENDING'
      continuation: ServerRuleExecutionContinuationDto
      d20Policy: ServerRuleExecutionD20PolicyDto
    }
  | {
      kind: 'COMPLETE'
      execution: ServerCompletedRuleExecutionDto
      applications: readonly CharacterRuleActionApplication[]
      d20: ServerRuleExecutionD20EvidenceDto | null
    }

function requireD20Request(continuation: ServerRuleExecutionContinuationDto): void {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  ) {
    throw new EncounterValidationError(
      'The selected reaction action requested unsupported evidence.'
    )
  }
}

/** Shared single-stage d20 policy derivation for an exact prepared Encounter action. */
export function deriveEncounterActionD20Policy(input: {
  continuation: ServerRuleExecutionContinuationDto
  bound: ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>
}): ServerRuleExecutionD20PolicyDto {
  requireD20Request(input.continuation)
  if (!input.bound.d20RollMode || !input.bound.d20Audit) {
    throw new EncounterValidationError('The selected reaction action has no exact d20 policy.')
  }
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: input.continuation.request.nodeId,
    rollMode: input.bound.d20RollMode,
    contributors: input.bound.d20Audit.contributors,
    contributorChecksum: input.bound.d20Audit.contributorChecksum,
    modifier: input.bound.d20Audit.modifier,
    dc: input.bound.d20Audit.defenseOrDc
  })
}

/** Validates entered or server-generated faces for one exact d20 request. */
export function resolveEncounterActionD20Faces(input: {
  policy: ServerRuleExecutionD20PolicyDto
  resolution: MovementReactionActionResolution
  rollD20?: () => number
}): number[] {
  const count = input.policy.rollMode === 'NORMAL' ? 1 : 2
  const faces =
    input.resolution.kind === 'ENTER_DICE'
      ? [...input.resolution.rawFaces]
      : Array.from({ length: count }, () => (input.rollD20 ?? (() => randomInt(1, 21)))())
  if (
    faces.length !== count ||
    faces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > 20)
  ) {
    throw new EncounterValidationError('The selected reaction action d20 evidence is invalid.')
  }
  return faces
}

export function selectEncounterActionD20Natural(
  mode: ServerRuleExecutionD20PolicyDto['rollMode'],
  faces: readonly number[]
): number {
  return mode === 'ADVANTAGE'
    ? Math.max(...faces)
    : mode === 'DISADVANTAGE'
      ? Math.min(...faces)
      : faces[0]!
}

function requireMatchingContinuation(input: {
  continuation: ServerRuleExecutionContinuationDto
  occurrenceId: string
  published: ServerPublishedRuleDefinitionDto
  facts: Readonly<Record<string, unknown>>
}): void {
  if (
    input.continuation.occurrenceId !== input.occurrenceId ||
    input.continuation.graph.source.definitionId !== input.published.id ||
    input.continuation.graph.source.checksum !== input.published.checksum ||
    checksumRuleDocument(input.continuation.facts) !== checksumRuleDocument(input.facts)
  ) {
    throw new EncounterConflictError('The selected reaction action continuation is stale.')
  }
}

/** Binds raw d20 faces to the completed kernel trace without exposing client arithmetic. */
export function buildEncounterActionD20Evidence(input: {
  execution: ServerCompletedRuleExecutionDto
  policy: ServerRuleExecutionD20PolicyDto
  requestId: string
  faces: readonly number[]
}): ServerRuleExecutionD20EvidenceDto {
  const natural = selectEncounterActionD20Natural(input.policy.rollMode, input.faces)
  const trace = input.execution.evidence.trace.find(
    (entry) => entry.evidence?.requestId === input.requestId && entry.evidence.value === natural
  )
  const resultPath = input.execution.outputs.resultPath
  if (!trace || typeof resultPath !== 'string') {
    throw new EncounterValidationError('The selected reaction action d20 trace is invalid.')
  }
  return serverRuleExecutionD20EvidenceDtoSchema.parse({
    requestId: input.requestId,
    rollMode: input.policy.rollMode,
    rawFaces: input.faces,
    selectedNatural: natural,
    contributors: input.policy.contributors,
    contributorChecksum: input.policy.contributorChecksum,
    modifier: input.policy.modifier,
    total: natural + input.policy.modifier,
    defenseOrDc: input.policy.dc,
    resultPath
  })
}

/** Seals one nested saving-throw roll before later OUTCOME evidence is collected. */
export function buildEncounterSaveD20Evidence(input: {
  policy: ServerRuleExecutionD20PolicyDto
  requestId: string
  faces: readonly number[]
}): ServerRuleExecutionNestedD20EvidenceDto {
  const natural = selectEncounterActionD20Natural(input.policy.rollMode, input.faces)
  const total = natural + input.policy.modifier
  return serverRuleExecutionNestedD20EvidenceDtoSchema.parse({
    requestNodeId: input.policy.requestNodeId,
    requestId: input.requestId,
    rollMode: input.policy.rollMode,
    rawFaces: input.faces,
    selectedNatural: natural,
    contributors: input.policy.contributors,
    contributorChecksum: input.policy.contributorChecksum,
    modifier: input.policy.modifier,
    total,
    defenseOrDc: input.policy.dc,
    resultPath: total >= input.policy.dc ? 'ON_SAVE_SUCCESS' : 'ON_SAVE_FAIL'
  })
}

/** Rejects terminal receipts whose nested save evidence is detached from the OUTCOME trace. */
export function requireEncounterSaveD20EvidenceTrace(input: {
  execution: ServerCompletedRuleExecutionDto
  policy: ServerRuleExecutionD20PolicyDto
  evidence: ServerRuleExecutionNestedD20EvidenceDto
}): void {
  if (
    input.evidence.requestNodeId !== input.policy.requestNodeId ||
    input.evidence.rollMode !== input.policy.rollMode ||
    input.evidence.contributorChecksum !== input.policy.contributorChecksum ||
    checksumRuleDocument(input.evidence.contributors) !== input.policy.contributorChecksum ||
    input.evidence.modifier !== input.policy.modifier ||
    input.evidence.defenseOrDc !== input.policy.dc
  )
    throw new EncounterValidationError('The nested save d20 policy is invalid.')
  const rollTrace = input.execution.evidence.trace.find(
    (entry) =>
      entry.nodeId === input.evidence.requestNodeId &&
      entry.evidence?.requestId === input.evidence.requestId &&
      entry.evidence.value === input.evidence.selectedNatural
  )
  const saveTrace = input.execution.evidence.trace.find(
    (entry) =>
      entry.inputs.naturalD20 === input.evidence.selectedNatural &&
      entry.inputs.modifier === input.evidence.modifier &&
      entry.inputs.threshold === input.evidence.defenseOrDc &&
      entry.outputs.resultPath === input.evidence.resultPath
  )
  if (!rollTrace || !saveTrace)
    throw new EncounterValidationError('The nested save d20 trace is invalid.')
}

/**
 * Executes only the selected action graph. The Encounter coordinator owns
 * source re-discovery, occurrence persistence, mechanics application, and
 * resource consumption. A paused d20 stage therefore has no side effects.
 */
export async function executeEncounterMovementReactionAction(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  prepared: PreparedEncounterMovementReactionAction
  continuation?: ServerRuleExecutionContinuationDto
  expectedD20Policy?: ServerRuleExecutionD20PolicyDto
  resolution?: MovementReactionActionResolution
  rollD20?: () => number
}): Promise<EncounterMovementReactionActionExecution> {
  const target = input.prepared.target
  const bound = input.prepared.adapter.bindFacts({
    actionMechanic: input.prepared.actionMechanic,
    published: input.prepared.published,
    sourceDerivedFacts: input.prepared.sourceDerivedFacts,
    targetActorId: target.actorId,
    targetDerivedFacts: target.derivedFacts,
    targetConditionIds: target.conditionIds,
    currentHitPoints: target.currentHitPoints,
    temporaryHitPoints: target.temporaryHitPoints,
    maximumHitPoints: target.maximumHitPoints,
    targetScalarValues: target.scalarValues,
    defenses: target.defenses,
    conditionImmunityIds: target.conditionImmunityIds
  })

  let execution
  let completedD20: ServerRuleExecutionD20EvidenceDto | null = null
  if (input.continuation) {
    if (!input.resolution) {
      throw new EncounterValidationError('The selected reaction action evidence is required.')
    }
    requireMatchingContinuation({
      continuation: input.continuation,
      occurrenceId: input.occurrenceId,
      published: input.prepared.published,
      facts: bound.facts
    })
    const policy = deriveEncounterActionD20Policy({ continuation: input.continuation, bound })
    if (
      !input.expectedD20Policy ||
      checksumRuleDocument(input.expectedD20Policy) !== checksumRuleDocument(policy)
    ) {
      throw new EncounterConflictError('The selected reaction action d20 policy is stale.')
    }
    if (input.resolution.requestId !== input.continuation.request.requestId) {
      throw new EncounterConflictError('The selected reaction action evidence request is stale.')
    }
    const faces = resolveEncounterActionD20Faces({
      policy,
      resolution: input.resolution,
      ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
    })
    execution = await input.runtime.resume({
      continuation: input.continuation,
      response: {
        requestId: input.resolution.requestId,
        value: selectEncounterActionD20Natural(policy.rollMode, faces)
      }
    })
    if (execution.status === 'PAUSED') {
      throw new EncounterValidationError(
        'The selected reaction action requested more than one evidence stage.'
      )
    }
    completedD20 = buildEncounterActionD20Evidence({
      execution,
      policy,
      requestId: input.resolution.requestId,
      faces
    })
  } else {
    if (input.expectedD20Policy) {
      throw new EncounterConflictError('The selected reaction action has no pending d20 policy.')
    }
    if (input.resolution) {
      throw new EncounterConflictError(
        'The selected reaction action has no pending evidence request.'
      )
    }
    execution = await input.runtime.executeResolved({
      command: {
        definitionId: input.prepared.published.id,
        occurrenceId: input.occurrenceId,
        facts: bound.facts
      },
      published: input.prepared.published
    })
    if (execution.status === 'PAUSED') {
      const policy = deriveEncounterActionD20Policy({ continuation: execution.continuation, bound })
      if (input.automationMode === 'ASSISTED') {
        return {
          kind: 'PENDING',
          continuation: execution.continuation,
          d20Policy: policy
        }
      }
      const resolution = {
        kind: 'SYSTEM_ROLL' as const,
        requestId: execution.continuation.request.requestId
      }
      const faces = resolveEncounterActionD20Faces({
        policy,
        resolution,
        ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
      })
      execution = await input.runtime.resume({
        continuation: execution.continuation,
        response: {
          requestId: resolution.requestId,
          value: selectEncounterActionD20Natural(policy.rollMode, faces)
        }
      })
      if (execution.status === 'PAUSED') {
        throw new EncounterValidationError(
          'The selected reaction action requested more than one evidence stage.'
        )
      }
      completedD20 = buildEncounterActionD20Evidence({
        execution,
        policy,
        requestId: resolution.requestId,
        faces
      })
    }
  }

  if (execution.status !== 'COMPLETE') {
    throw new EncounterValidationError('The selected reaction action did not settle.')
  }
  return {
    kind: 'COMPLETE',
    execution: bindMovementInterruption({
      execution,
      binding: input.prepared.movementInterruption
    }),
    applications: input.prepared.adapter.interpret({
      execution,
      occurrenceId: input.occurrenceId,
      published: input.prepared.published,
      targetActorId: target.actorId,
      currentHitPoints: target.currentHitPoints,
      temporaryHitPoints: target.temporaryHitPoints,
      maximumHitPoints: target.maximumHitPoints,
      defenses: target.defenses,
      conditionImmunityIds: target.conditionImmunityIds
    }),
    d20: completedD20
  }
}
