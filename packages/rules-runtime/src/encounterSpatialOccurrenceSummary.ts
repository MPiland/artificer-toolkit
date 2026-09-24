import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

import { EncounterConflictError } from './encounterErrors.js'

/** Projects one pending movement occurrence without exposing another controller's choice. */
export function projectEncounterSpatialOccurrenceSummary(
  occurrence: {
    id: string
    version: number
    state: 'PENDING' | 'COMPLETED'
    pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
  },
  encounterVersion: number,
  viewer: {
    membershipRole: 'OWNER' | 'PLAYER'
    assignedCharacterId: string | null
    assignedActorId?: string | null
  }
): EncounterRuleOccurrenceSummaryDto {
  if (occurrence.state === 'COMPLETED') {
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'COMPLETE',
      outcome: null,
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
    const canView =
      viewer.membershipRole === 'OWNER' ||
      (context.sourceControllerCharacterId !== null &&
        context.sourceControllerCharacterId === viewer.assignedCharacterId)
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: canView
        ? {
            kind: 'MOVEMENT_PASSAGE_CHOICE',
            occurrenceId: occurrence.id,
            occurrenceVersion: occurrence.version,
            encounterVersion,
            sourceActorId: context.sourceActorId,
            options: context.options.map(({ economy, optionId, ruleKind }) => ({
              economy,
              optionId,
              ruleKind
            })),
            allowedResponses: ['DECLINE', 'OPTION']
          }
        : null
    }
  }
  if (!pendingSnapshot || !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot)) {
    throw new EncounterConflictError('The spatial occurrence has no resolvable evidence request.')
  }
  const context = pendingSnapshot.applicationContext
  if (
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    context.phase.kind === 'CONCENTRATION_EVIDENCE'
  ) {
    const canView =
      viewer.membershipRole === 'OWNER' ||
      viewer.assignedActorId === context.phase.concentration.application.targetActorId
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: canView
        ? {
            kind: 'D20_EVIDENCE',
            occurrenceId: occurrence.id,
            occurrenceVersion: occurrence.version,
            encounterVersion,
            request: {
              requestId: pendingSnapshot.request.requestId,
              min: 1,
              max: 20,
              rollMode: context.phase.concentration.save.rollMode
            },
            allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
          }
        : null
    }
  }
  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' && context.movementContinuation) {
    const initiator = pendingSnapshot.request.nodeId === context.initiator.requestNodeId
    const defender = pendingSnapshot.request.nodeId === context.defender.requestNodeId
    if (!initiator && !defender)
      throw new EncounterConflictError(
        'The optional-combat contest has an invalid evidence request.'
      )
    const canView =
      viewer.membershipRole === 'OWNER' ||
      (initiator
        ? context.initiatorControllerCharacterId !== null &&
          context.initiatorControllerCharacterId === viewer.assignedCharacterId
        : context.targetActorId === viewer.assignedActorId)
    if (!canView) {
      return {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        outcome: null,
        pending: null
      }
    }
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: {
        kind: 'D20_EVIDENCE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion,
        request: {
          requestId: pendingSnapshot.request.requestId,
          min: 1,
          max: 20,
          rollMode: (initiator ? context.initiator : context.defender).rollMode
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
      if (viewer.membershipRole !== 'OWNER') {
        return {
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          status: 'PENDING',
          outcome: null,
          pending: null
        }
      }
      return {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        outcome: null,
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
    const choice =
      context.phase.kind === 'CHOICE' && currentEntry?.kind === 'CONTROLLER_CHOICE'
        ? currentEntry.group
        : null
    const actionEvidenceOptionId =
      context.phase.kind === 'ACTION_EVIDENCE' ? context.phase.selectedOptionId : null
    const actionEvidenceOption = actionEvidenceOptionId
      ? ((currentEntry?.kind === 'AUTOMATIC_ACTION'
          ? [currentEntry.option]
          : (currentEntry?.group.options ?? [])
        ).find((option) => option.optionId === actionEvidenceOptionId) ?? null)
      : null
    if (context.phase.kind === 'ACTION_EVIDENCE') {
      const canViewEvidence =
        viewer.membershipRole === 'OWNER' ||
        (actionEvidenceOption?.authority.kind === 'CHARACTER_CONTROLLER' &&
          actionEvidenceOption.authority.characterId === viewer.assignedCharacterId)
      if (!actionEvidenceOption || !canViewEvidence) {
        return {
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          status: 'PENDING',
          outcome: null,
          pending: null
        }
      }
      return {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        outcome: null,
        pending:
          context.phase.d20Policy === null
            ? {
                kind: 'ACTION_OUTCOME_EVIDENCE',
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                encounterVersion,
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
                request: {
                  requestId: pendingSnapshot.request.requestId,
                  min: 1,
                  max: 20,
                  rollMode: context.phase.d20Policy.rollMode
                },
                allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
              }
      }
    }
    const visibleOptions =
      choice?.options.filter(
        (option) =>
          viewer.membershipRole === 'OWNER' ||
          (option.authority.kind === 'CHARACTER_CONTROLLER' &&
            option.authority.characterId === viewer.assignedCharacterId)
      ) ?? []
    if (!choice || visibleOptions.length === 0) {
      return {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        outcome: null,
        pending: null
      }
    }
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
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
  if (!spatialCandidate || !spatialCandidate.d20Policy) {
    throw new EncounterConflictError('The spatial occurrence has no resolvable evidence request.')
  }
  const canViewPending =
    viewer.membershipRole === 'OWNER' ||
    (spatialCandidate.target.kind === 'CHARACTER' &&
      spatialCandidate.target.characterId === viewer.assignedCharacterId)
  if (!canViewPending) {
    return {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: null
    }
  }
  return {
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    status: 'PENDING',
    outcome: null,
    pending: {
      kind: 'D20_EVIDENCE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion,
      request: {
        requestId: pendingSnapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: spatialCandidate.d20Policy.rollMode
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
  }
}
