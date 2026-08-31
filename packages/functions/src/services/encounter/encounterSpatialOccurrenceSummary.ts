import type { RuleOccurrenceRecord } from '@artificer-toolkit/db'
import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import { isServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'

import { EncounterConflictError } from './encounterErrors.js'

/** Projects one pending movement occurrence without exposing another controller's choice. */
export function projectEncounterSpatialOccurrenceSummary(
  occurrence: RuleOccurrenceRecord,
  encounterVersion: number,
  viewer: {
    membershipRole: 'OWNER' | 'PLAYER'
    assignedCharacterId: string | null
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
  if (!pendingSnapshot || !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot)) {
    throw new EncounterConflictError('The spatial occurrence has no resolvable evidence request.')
  }
  const context = pendingSnapshot.applicationContext
  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION') {
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
        pending: {
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
  if (context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' || !context.currentCandidate.d20Policy) {
    throw new EncounterConflictError('The spatial occurrence has no resolvable evidence request.')
  }
  const canViewPending =
    viewer.membershipRole === 'OWNER' ||
    (context.currentCandidate.target.kind === 'CHARACTER' &&
      context.currentCandidate.target.characterId === viewer.assignedCharacterId)
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
        rollMode: context.currentCandidate.d20Policy.rollMode
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
  }
}
