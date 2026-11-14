import { damageSaveRollPolicy, damageSaveRollTrigger } from './encounterConcentration.js'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import { movementPendingDamageSave } from '@artificer-toolkit/schema/shared/ruleExecutionSpatialPendingContexts'
import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

import { EncounterConflictError } from './encounterErrors.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import { contestCheckMovementContinuation } from './encounterMovementPendingContext.js'
import { spatialPendingRollerActorId } from './encounterSpatialPendingRoller.js'
import { contestDefenderPolicy } from './encounterOptionalContestActionExecution.js'
import {
  encounterAutoFailRequest,
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from './encounterRollModeReasons.js'

/**
 * Projects one pending movement occurrence without exposing another controller's choice: each
 * decision or roll goes to the controllers of the actor it belongs to (the GM controls every actor).
 */
export function projectEncounterSpatialOccurrenceSummary(
  occurrence: {
    id: string
    version: number
    /**
     * The stored state; only an action is ever `SUSPENDED`, which holds its snapshot as `PENDING`
     * does, and only a reaction offer is ever `QUEUED`, which is no movement occurrence.
     */
    state: 'PENDING' | 'SUSPENDED' | 'QUEUED' | 'COMPLETED' | 'VOIDED'
    pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
  },
  encounterVersion: number,
  /** The Run actors the viewer may act for (every actor for the GM); the GM sees the true roll mode. */
  viewer: { controlledActorIds: ReadonlySet<string>; isOwner: boolean },
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): EncounterRuleOccurrenceSummaryDto {
  const controls = (actorId: string) => viewer.controlledActorIds.has(actorId)
  if (occurrence.state === 'COMPLETED' || occurrence.state === 'VOIDED') {
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: occurrence.state === 'VOIDED' ? 'VOIDED' : 'COMPLETE',
      pending: null
    }
  }
  const pendingSnapshot = occurrence.pendingSnapshot
  if (
    pendingSnapshot &&
    isServerAggregateChoicePendingSnapshot(pendingSnapshot) &&
    pendingSnapshot.applicationContext.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
  ) {
    const context = pendingSnapshot.applicationContext
    const canView = controls(context.sourceActorId)
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: canView
        ? {
            kind: 'MOVEMENT_PASSAGE_CHOICE',
            occurrenceId: occurrence.id,
            occurrenceVersion: occurrence.version,
            encounterVersion,
            sourceActorId: context.sourceActorId,
            options: context.options.map(
              ({ economy, initiatorCheckLabel, optionId, ruleKind }) => ({
                economy,
                initiatorCheckLabel,
                optionId,
                ruleKind
              })
            ),
            allowedResponses: ['DECLINE', 'OPTION']
          }
        : null
    }
  }
  if (!pendingSnapshot || !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot)) {
    throw new EncounterConflictError('The spatial occurrence has no resolvable evidence request.')
  }
  const context = pendingSnapshot.applicationContext
  const rollModes = rollModeCapabilityRegistry.offeredRollModes(
    pendingSnapshot.graph.source.gameSystemId
  )
  const damageSave =
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION'
      ? (movementPendingDamageSave(context.phase)?.context ?? null)
      : null
  if (damageSave !== null) {
    const save = damageSaveRollPolicy(damageSave)
    const canView = controls(damageSave.application.targetActorId)
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: canView
        ? {
            kind: 'D20_EVIDENCE',
            occurrenceId: occurrence.id,
            occurrenceVersion: occurrence.version,
            encounterVersion,
            rollerActorId: damageSave.application.targetActorId,
            trigger: damageSaveRollTrigger(damageSave),
            request: {
              requestId: pendingSnapshot.request.requestId,
              min: 1,
              max: 20,
              rollMode: save.rollMode,
              keep: save.keep,
              rollModes,
              derivedRollModeReasons: reasons({
                rollMode: save.rollMode,
                contributors: save.contributors
              }),
              ...(save.addedDice?.length ? { addedDice: save.addedDice } : {})
            },
            allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
          }
        : null
    }
  }
  if (context.kind === 'ENCOUNTER_CONTEST_CHECK' && contestCheckMovementContinuation(context)) {
    const initiator = pendingSnapshot.request.nodeId === context.initiator.requestNodeId
    const defender = pendingSnapshot.request.nodeId === context.defender.requestNodeId
    if (!initiator && !defender)
      throw new EncounterConflictError(
        'The optional-combat contest has an invalid evidence request.'
      )
    const canView = controls(initiator ? context.sourceActorId : context.targetActorId)
    const policy = initiator ? context.initiator : contestDefenderPolicy(context.defender, null)
    if (!canView) {
      return {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        pending: null
      }
    }
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: {
        kind: 'D20_EVIDENCE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion,
        rollerActorId: initiator ? context.sourceActorId : context.targetActorId,
        request: {
          requestId: pendingSnapshot.request.requestId,
          min: 1,
          max: 20,
          rollMode: policy.rollMode,
          keep: policy.keep,
          rollModes,
          derivedRollModeReasons: reasons({
            rollMode: policy.rollMode,
            contributors: policy.contributors
          })
        },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    }
  }
  const spatialCandidate =
    context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? context.currentCandidate
      : context.kind === 'ENCOUNTER_MOVEMENT_REACTION' && context.phase.kind === 'SPATIAL_EVIDENCE'
        ? context.phase.currentCandidate
        : null
  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION' && context.phase.kind !== 'SPATIAL_EVIDENCE') {
    const currentEntry = context.reactionTimeline[0] ?? null
    // A choice that records a reaction child is answered (D219): the move waits for the room's
    // resume, so nobody is asked again and no timeout declines it.
    const choice =
      context.phase.kind === 'CHOICE' && !context.phase.reactionChildren?.length
        ? (currentEntry?.group ?? null)
        : null
    const visibleOptions =
      choice?.options.filter((option) => controls(option.candidate.reactorActorId)) ?? []
    if (!choice || visibleOptions.length === 0) {
      return {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        pending: null
      }
    }
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: {
        kind: 'REACTION_CHOICE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion,
        targetActorId: choice.reactorActorId,
        reactorTokenId: choice.reactorTokenId,
        options: visibleOptions.map((option) => ({
          optionId: option.optionId,
          actionId: option.actionId
        })),
        allowedResponses: ['DECLINE', 'OPTION']
      }
    }
  }
  if (!spatialCandidate) {
    throw new EncounterConflictError('The spatial occurrence has no resolvable evidence request.')
  }
  const rollerActorId = spatialPendingRollerActorId(spatialCandidate)
  if (!controls(rollerActorId)) {
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: null
    }
  }
  // The damage dice of a resolved save's failure, or of an outcome with no save (D154).
  if (!spatialCandidate.d20Policy || spatialCandidate.diceStage) {
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: {
        kind: 'ACTION_OUTCOME_EVIDENCE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion,
        rollerActorId,
        request: {
          requestId: pendingSnapshot.request.requestId,
          min: pendingSnapshot.request.min,
          max: pendingSnapshot.request.max
        },
        allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
      }
    }
  }
  return {
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    status: 'PENDING',
    pending: {
      kind: 'D20_EVIDENCE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion,
      rollerActorId: spatialCandidate.candidate.targetActorId,
      request: {
        requestId: pendingSnapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: spatialCandidate.d20Policy.rollMode,
        keep: spatialCandidate.d20Policy.keep,
        rollModes,
        derivedRollModeReasons: reasons({
          rollMode: spatialCandidate.d20Policy.rollMode,
          contributors: spatialCandidate.d20Policy.contributors
        }),
        ...encounterAutoFailRequest(
          reasons,
          spatialCandidate.d20Policy,
          spatialCandidate.candidate.targetActorId
        ),
        ...(spatialCandidate.d20Policy.addedDice?.length
          ? { addedDice: spatialCandidate.d20Policy.addedDice }
          : {})
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
  }
}
