import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import {
  DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY,
  DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY,
  type Dnd5eOptionalCombatContestGraph
} from './systems/dnd5e/optionalCombatContestGraph.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'

export type OptionalContestD20Policy = {
  actorId: string
  requestNodeId: 'initiator_d20' | 'target_d20'
  rollMode: 'ADVANTAGE' | 'DISADVANTAGE' | 'NORMAL'
  contributors: readonly {
    sourceId: string
    grantId: string | null
    domainKey: string | null
    influence: 'ADVANTAGE' | 'DISADVANTAGE'
  }[]
  contributorChecksum: string
  modifier: number
}

export type OptionalContestResolution =
  | { kind: 'ENTER_DICE'; requestId: string; rawFaces: readonly number[] }
  | { kind: 'SYSTEM_ROLL'; requestId: string }

export type EncounterOptionalContestActionExecution =
  | {
      kind: 'PENDING'
      continuation: ServerRuleExecutionContinuationDto
      participant: 'INITIATOR' | 'DEFENDER'
    }
  | {
      kind: 'COMPLETE'
      execution: ServerCompletedRuleExecutionDto
      initiator: OptionalContestD20Policy & {
        rawFaces: readonly number[]
        selectedNatural: number
        total: number
      }
      defender: OptionalContestD20Policy & {
        rawFaces: readonly number[]
        selectedNatural: number
        total: number
      }
    }

function requireRequest(
  continuation: ServerRuleExecutionContinuationDto
): 'INITIATOR' | 'DEFENDER' {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  ) {
    throw new EncounterValidationError('Optional combat contest requested unsupported evidence.')
  }
  if (continuation.request.nodeId === 'initiator_d20') return 'INITIATOR'
  if (continuation.request.nodeId === 'target_d20') return 'DEFENDER'
  throw new EncounterValidationError('Optional combat contest requested an unknown participant.')
}

function selectNatural(
  mode: OptionalContestD20Policy['rollMode'],
  faces: readonly number[]
): number {
  return mode === 'ADVANTAGE'
    ? Math.max(...faces)
    : mode === 'DISADVANTAGE'
      ? Math.min(...faces)
      : faces[0]!
}

function resolveFaces(input: {
  policy: OptionalContestD20Policy
  resolution: OptionalContestResolution
  requestId: string
  rollD20: () => number
}): readonly number[] {
  if (input.resolution.requestId !== input.requestId)
    throw new EncounterConflictError('Optional combat contest evidence request is stale.')
  const count = input.policy.rollMode === 'NORMAL' ? 1 : 2
  const faces =
    input.resolution.kind === 'ENTER_DICE'
      ? input.resolution.rawFaces
      : Array.from({ length: count }, input.rollD20)
  if (
    faces.length !== count ||
    faces.some((face) => !Number.isInteger(face) || face < 1 || face > 20)
  ) {
    throw new EncounterValidationError('Optional combat contest d20 evidence is invalid.')
  }
  return [...faces]
}

export function completeEncounterOptionalContestActionExecution(input: {
  execution: ServerCompletedRuleExecutionDto
  initiator: OptionalContestD20Policy
  defender: OptionalContestD20Policy
  rolls: ReadonlyMap<'INITIATOR' | 'DEFENDER', readonly number[]>
}): Extract<EncounterOptionalContestActionExecution, { kind: 'COMPLETE' }> {
  const initiatorFaces = input.rolls.get('INITIATOR')
  const defenderFaces = input.rolls.get('DEFENDER')
  if (!initiatorFaces || !defenderFaces) {
    throw new EncounterValidationError('Optional combat contest evidence is incomplete.')
  }
  const initiatorNatural = selectNatural(input.initiator.rollMode, initiatorFaces)
  const defenderNatural = selectNatural(input.defender.rollMode, defenderFaces)
  if (
    input.execution.outputs.initiatorNaturalD20 !== initiatorNatural ||
    input.execution.outputs.targetNaturalD20 !== defenderNatural ||
    input.execution.outputs.initiatorTotal !== initiatorNatural + input.initiator.modifier ||
    input.execution.outputs.targetTotal !== defenderNatural + input.defender.modifier
  ) {
    throw new EncounterConflictError('Optional combat contest result does not match its evidence.')
  }
  return {
    kind: 'COMPLETE',
    execution: input.execution,
    initiator: {
      ...input.initiator,
      rawFaces: initiatorFaces,
      selectedNatural: initiatorNatural,
      total: initiatorNatural + input.initiator.modifier
    },
    defender: {
      ...input.defender,
      rawFaces: defenderFaces,
      selectedNatural: defenderNatural,
      total: defenderNatural + input.defender.modifier
    }
  }
}

/** Executes the bounded two-d20 contest graph. Persistence and application stay with the Encounter coordinator. */
export async function executeEncounterOptionalContestAction(input: {
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  continuation?: ServerRuleExecutionContinuationDto
  graph: Dnd5eOptionalCombatContestGraph
  initiator: OptionalContestD20Policy
  defender: OptionalContestD20Policy
  occurrenceId: string
  resolution?: OptionalContestResolution
  rollD20: () => number
  runtime: RulesRuntimeService
  priorRolls?: ReadonlyMap<'INITIATOR' | 'DEFENDER', readonly number[]>
}): Promise<EncounterOptionalContestActionExecution> {
  const rolls = new Map(input.priorRolls)
  let execution = input.continuation
    ? await input.runtime.resume({
        continuation: input.continuation,
        response: (() => {
          if (!input.resolution)
            throw new EncounterValidationError('Optional combat contest evidence is required.')
          const participant = requireRequest(input.continuation)
          const policy = participant === 'INITIATOR' ? input.initiator : input.defender
          const faces = resolveFaces({
            policy,
            resolution: input.resolution,
            requestId: input.continuation.request.requestId,
            rollD20: input.rollD20
          })
          rolls.set(participant, faces)
          return {
            requestId: input.continuation.request.requestId,
            value: selectNatural(policy.rollMode, faces)
          }
        })()
      })
    : await input.runtime.executeResolved({
        command: {
          definitionId: input.graph.published.id,
          occurrenceId: input.occurrenceId,
          facts: {
            [DND5E_OPTIONAL_COMBAT_CONTEST_INITIATOR_MODIFIER_FACT_KEY]: input.initiator.modifier,
            [DND5E_OPTIONAL_COMBAT_CONTEST_TARGET_MODIFIER_FACT_KEY]: input.defender.modifier
          }
        },
        published: input.graph.published
      })
  while (execution.status === 'PAUSED' && input.automationMode === 'AUTOMATIC') {
    const participant = requireRequest(execution.continuation)
    const policy = participant === 'INITIATOR' ? input.initiator : input.defender
    const faces = resolveFaces({
      policy,
      resolution: { kind: 'SYSTEM_ROLL', requestId: execution.continuation.request.requestId },
      requestId: execution.continuation.request.requestId,
      rollD20: input.rollD20
    })
    rolls.set(participant, faces)
    execution = await input.runtime.resume({
      continuation: execution.continuation,
      response: {
        requestId: execution.continuation.request.requestId,
        value: selectNatural(policy.rollMode, faces)
      }
    })
  }
  if (execution.status === 'PAUSED') {
    return {
      kind: 'PENDING',
      continuation: execution.continuation,
      participant: requireRequest(execution.continuation)
    }
  }
  return completeEncounterOptionalContestActionExecution({
    execution,
    initiator: input.initiator,
    defender: input.defender,
    rolls
  })
}
