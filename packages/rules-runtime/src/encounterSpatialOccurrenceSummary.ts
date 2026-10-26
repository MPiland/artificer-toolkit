import { damageSaveRollTrigger } from './encounterConcentration.js'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
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
    state: 'PENDING' | 'COMPLETED' | 'VOIDED'
    pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
  },
  encounterVersion: number,
  /** The Run actors the viewer may act for (every actor for the GM); the GM sees the true roll mode. */
  viewer: { controlledActorIds: ReadonlySet<string>; isOwner: boolean },
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): EncounterRuleOccurrenceSummaryDto {
  const controls = (actorId: string) => viewer.controlledActorIds.has(actorId)
  if (occurrence.state !== 'PENDING') {
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
  if (
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    context.phase.kind === 'CONCENTRATION_EVIDENCE'
  ) {
    const canView = controls(context.phase.concentration.application.targetActorId)
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
            rollerActorId: context.phase.concentration.application.targetActorId,
            trigger: damageSaveRollTrigger(context.phase.concentration),
            request: {
              requestId: pendingSnapshot.request.requestId,
              min: 1,
              max: 20,
              rollMode: context.phase.concentration.save.rollMode,
              keep: context.phase.concentration.save.keep,
              rollModes,
              derivedRollModeReasons: reasons({
                rollMode: context.phase.concentration.save.rollMode,
                contributors: context.phase.concentration.save.contributors
              }),
              ...(context.phase.concentration.save.addedDice?.length
                ? { addedDice: context.phase.concentration.save.addedDice }
                : {})
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
    if (context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
      if (!controls(context.phase.resistance.targetActorId)) {
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
          kind: 'LEGENDARY_RESISTANCE_CHOICE',
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          encounterVersion,
          targetActorId: context.phase.resistance.targetActorId,
          options: [{ optionId: context.phase.resistance.useOptionId }],
          allowedResponses: ['DECLINE', 'OPTION']
        }
      }
    }
    const currentEntry = context.reactionTimeline[0] ?? null
    const choice = context.phase.kind === 'CHOICE' ? (currentEntry?.group ?? null) : null
    const actionEvidenceOptionId =
      context.phase.kind === 'ACTION_EVIDENCE' ? context.phase.selectedOptionId : null
    const actionEvidenceOption = actionEvidenceOptionId
      ? (currentEntry?.group.options.find((option) => option.optionId === actionEvidenceOptionId) ??
        null)
      : null
    if (context.phase.kind === 'ACTION_EVIDENCE') {
      const { d20Policy, d20Belief, heldD20 } = context.phase
      // A roller that does not own the Encounter sees the sight it believes, never the true one.
      const shown = !viewer.isOwner && d20Belief ? d20Belief : d20Policy
      if (!actionEvidenceOption || !controls(context.phase.rollerActorId)) {
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
        pending:
          shown === null
            ? {
                kind: 'ACTION_OUTCOME_EVIDENCE',
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                encounterVersion,
                rollerActorId: context.phase.rollerActorId,
                request: {
                  requestId: pendingSnapshot.request.requestId,
                  min: pendingSnapshot.request.min,
                  max: pendingSnapshot.request.max
                },
                allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
              }
            : {
                kind: 'D20_EVIDENCE',
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                encounterVersion,
                rollerActorId: context.phase.rollerActorId,
                request: {
                  requestId: pendingSnapshot.request.requestId,
                  min: 1,
                  max: 20,
                  rollModes,
                  // The roller rolls the test's added dice with the d20 that settles it (D156).
                  ...(d20Policy?.addedDice?.length ? { addedDice: d20Policy.addedDice } : {}),
                  ...(heldD20
                    ? {
                        rollMode: 'NORMAL' as const,
                        keep: rollModeCapabilityRegistry.rollModeKeep({
                          gameSystemId: pendingSnapshot.graph.source.gameSystemId,
                          rollMode: 'NORMAL'
                        }),
                        derivedRollModeReasons: [],
                        heldD20: {
                          faces: heldD20.faces,
                          caption: viewer.isOwner ? heldD20.gmReason : heldD20.playerCaption
                        }
                      }
                    : {
                        rollMode: shown.rollMode,
                        keep: shown.keep,
                        derivedRollModeReasons: reasons({
                          rollMode: shown.rollMode,
                          contributors: shown.contributors
                        })
                      })
                },
                allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
              }
      }
    }
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
        kind: 'MOVEMENT_REACTION',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion,
        choice: {
          pathDistance: choice.pathDistance,
          reactorActorId: choice.reactorActorId,
          reactorTokenId: choice.reactorTokenId,
          options: visibleOptions.map((option) => ({
            optionId: option.optionId,
            actionId: option.actionId,
            actionSourceKind: option.actionSourceKind
          }))
        },
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
        ...(spatialCandidate.d20Policy.addedDice?.length
          ? { addedDice: spatialCandidate.d20Policy.addedDice }
          : {})
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
  }
}
