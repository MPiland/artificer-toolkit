import type {
  ServerContestCheckPendingApplicationContextDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { contestCheckCapabilityRegistry } from './platformEncounterPolicy.js'
import {
  contestDefenderPolicy,
  executeEncounterOptionalContestAction,
  type OptionalContestResolution
} from './encounterOptionalContestActionExecution.js'
import { EncounterConflictError } from './encounterErrors.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'

/**
 * Runs only the sealed movement passage contest evidence stage. The caller owns the
 * aggregate occurrence transition and applies its already-prepared economy
 * exactly once at terminal settlement.
 */
export async function executeEncounterMovementPassageContest(input: {
  readonly autoRoll: EncounterAutoRollByActorId
  readonly continuation?: ServerRuleExecutionContinuationDto
  readonly gameSystemId: string
  readonly pending: ServerContestCheckPendingApplicationContextDto
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
    input.pending.origin.kind !== 'OPTIONAL_COMBAT' ||
    !('successMovement' in input.pending.origin.selection) ||
    input.pending.origin.movementContinuation === null ||
    input.pending.origin.movementContinuation === undefined
  ) {
    throw new EncounterConflictError('Movement passage contest is unavailable.')
  }
  const graph = contestCheckCapabilityRegistry
    .require(input.gameSystemId)
    .optionalCombatContestGraph({
      definitionId: input.pending.origin.pin.definitionId,
      definitionVersion: input.pending.origin.pin.definitionVersion,
      definitionChecksum: input.pending.origin.pin.definitionChecksum,
      moduleKey: input.pending.origin.pin.moduleKey,
      moduleContractVersion: input.pending.origin.pin.moduleContractVersion
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
    autoRoll: input.autoRoll,
    ...(input.continuation ? { continuation: input.continuation } : {}),
    published: graph.published,
    initiator: { ...input.pending.initiator, requestNodeId: 'initiator_d20' },
    defender: {
      ...contestDefenderPolicy(input.pending.defender, null),
      requestNodeId: 'target_d20'
    },
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
                : input.resolution.kind === 'SYSTEM_ROLL'
                  ? [...input.resolution.faces]
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
