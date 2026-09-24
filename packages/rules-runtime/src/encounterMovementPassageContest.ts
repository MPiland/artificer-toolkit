import type {
  ServerOptionalCombatContestPendingApplicationContextDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { createDnd5eOptionalCombatContestGraph } from './systems/dnd5e/optionalCombatContestGraph.js'
import {
  executeEncounterOptionalContestAction,
  type OptionalContestResolution
} from './encounterOptionalContestActionExecution.js'
import { EncounterConflictError } from './encounterErrors.js'

/**
 * Runs only the sealed Overrun/Tumble evidence stage. The caller owns the
 * aggregate occurrence transition and applies its already-prepared economy
 * exactly once at terminal settlement.
 */
export async function executeEncounterMovementPassageContest(input: {
  readonly automationMode: 'AUTOMATIC' | 'ASSISTED'
  readonly continuation?: ServerRuleExecutionContinuationDto
  readonly pending: ServerOptionalCombatContestPendingApplicationContextDto
  readonly occurrenceId: string
  readonly resolution?: OptionalContestResolution
  readonly rollD20: () => number
  readonly runtime: RulesRuntimeService
}): Promise<
  | {
      readonly kind: 'PENDING'
      readonly continuation: ServerRuleExecutionContinuationDto
      readonly submittedEvidence: {
        readonly participant: 'INITIATOR' | 'DEFENDER'
        readonly requestId: string
        readonly rawFaces: readonly number[]
      } | null
    }
  | {
      readonly kind: 'COMPLETE'
      readonly outcome: 'SUCCESS' | 'TIE_OR_FAILURE'
      readonly evidence: {
        readonly initiatorRawFaces: readonly number[]
        readonly defenderRawFaces: readonly number[]
        readonly initiatorTotal: number
        readonly defenderTotal: number
      }
    }
> {
  if (
    (input.pending.actionKind !== 'OVERRUN' && input.pending.actionKind !== 'TUMBLE') ||
    input.pending.movementContinuation === null ||
    input.pending.movementContinuation === undefined
  ) {
    throw new EncounterConflictError('Movement passage contest is unavailable.')
  }
  const graph = createDnd5eOptionalCombatContestGraph({
    definitionId: input.pending.optionalCombat.definitionId,
    definitionVersion: input.pending.optionalCombat.definitionVersion,
    definitionChecksum: input.pending.optionalCombat.definitionChecksum,
    moduleKey: input.pending.optionalCombat.moduleKey,
    moduleContractVersion: input.pending.optionalCombat.moduleContractVersion
  })
  if (
    graph.published.id !== input.pending.contestGraph.definitionId ||
    graph.published.checksum !== input.pending.contestGraph.checksum ||
    graph.identityChecksum !== input.pending.contestGraph.identityChecksum
  ) {
    throw new EncounterConflictError('Movement passage contest graph is stale.')
  }
  const priorRolls = new Map<'INITIATOR' | 'DEFENDER', readonly number[]>()
  if (input.pending.rollEvidence.initiator) {
    priorRolls.set('INITIATOR', input.pending.rollEvidence.initiator.rawFaces)
  }
  if (input.pending.rollEvidence.defender) {
    priorRolls.set('DEFENDER', input.pending.rollEvidence.defender.rawFaces)
  }
  const generatedFaces: number[] = []
  const rollD20 = () => {
    const face = input.rollD20()
    generatedFaces.push(face)
    return face
  }
  const submittedParticipant: 'INITIATOR' | 'DEFENDER' | null = input.continuation
    ? input.continuation.request.nodeId === 'initiator_d20'
      ? 'INITIATOR'
      : input.continuation.request.nodeId === 'target_d20'
        ? 'DEFENDER'
        : null
    : null
  const result = await executeEncounterOptionalContestAction({
    automationMode: input.automationMode,
    ...(input.continuation ? { continuation: input.continuation } : {}),
    graph,
    initiator: { ...input.pending.initiator, requestNodeId: 'initiator_d20' },
    defender: { ...input.pending.defender, requestNodeId: 'target_d20' },
    occurrenceId: input.occurrenceId,
    ...(input.resolution ? { resolution: input.resolution } : {}),
    rollD20,
    runtime: input.runtime,
    priorRolls
  })
  if (result.kind === 'PENDING') {
    const submittedEvidence =
      submittedParticipant && input.resolution
        ? {
            participant: submittedParticipant,
            requestId: input.resolution.requestId,
            rawFaces:
              input.resolution.kind === 'ENTER_DICE'
                ? [...input.resolution.rawFaces]
                : [...generatedFaces]
          }
        : null
    return { kind: 'PENDING', continuation: result.continuation, submittedEvidence }
  }
  return {
    kind: 'COMPLETE',
    outcome: result.initiator.total > result.defender.total ? 'SUCCESS' : 'TIE_OR_FAILURE',
    evidence: {
      initiatorRawFaces: result.initiator.rawFaces,
      defenderRawFaces: result.defender.rawFaces,
      initiatorTotal: result.initiator.total,
      defenderTotal: result.defender.total
    }
  }
}
