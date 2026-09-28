import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readEncounterActorControl } from './actorController'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import {
  readRunActor,
  readRunProjection,
  readRunState
} from '@artificer-toolkit/encounter-persistence/documents'

/** Reads the sealed action root without exposing executable facts to recipients. */
export function readNativeActionPending(occurrence: Doc<'encounterRuleOccurrences'>) {
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  if (occurrence.state !== 'PENDING' || occurrence.pendingSnapshotJson === null)
    throw new Error('Stored Encounter action is not pending.')
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(occurrence.pendingSnapshotJson)
  )
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    snapshot.occurrenceId !== occurrence.id ||
    checksumCanonicalJson(snapshot) !== occurrence.pendingSnapshotChecksum
  )
    throw new Error('Stored Encounter action pending snapshot mismatch.')
  const context = snapshot.applicationContext
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.commandId !== occurrence.rootCommandId ||
    command.encounterId !== occurrence.encounterId ||
    command.expectedVersion !== occurrence.expectedEncounterVersion ||
    checksumCanonicalJson(command) !== context.commandFingerprint
  )
    throw new Error('Stored Encounter action root mismatch.')
  const {
    snapshotKind: _snapshotKind,
    applicationContext: _applicationContext,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = snapshot
  return { snapshot, context, command, continuation }
}

/**
 * Paused action evidence belongs to the controllers of the actor whose roll it is, and the GM may
 * answer any of it. The initiator therefore answers only rolls of actors they control.
 */
export async function canAnswerNativeActionEvidence(
  ctx: QueryCtx,
  input: {
    run: Doc<'encounterRuns'>
    campaign: Doc<'campaigns'>
    membership: Doc<'campaignMemberships'>
    occurrence: Doc<'encounterRuleOccurrences'>
  }
): Promise<boolean> {
  if (input.membership.role === 'OWNER') return true
  const { context } = readNativeActionPending(input.occurrence)
  const actor = await readRunActor(ctx, readRunState(input.run), context.rollerActorId)
  return (await readEncounterActorControl(ctx, { ...input, actor })) !== null
}

export function projectNativeActionPending(
  occurrence: Doc<'encounterRuleOccurrences'>,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto {
  const { snapshot, context } = readNativeActionPending(occurrence)
  const common = {
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: context.rollerActorId
  }
  const d20Policy = context.contest
    ? snapshot.request.nodeId === 'initiator_d20'
      ? context.contest.initiator
      : snapshot.request.nodeId === 'target_d20'
        ? context.contest.defender
        : null
    : context.d20Policy
  if (context.contest && (!d20Policy || snapshot.request.min !== 1 || snapshot.request.max !== 20))
    throw new Error('Stored Disarm evidence request is invalid.')
  return d20Policy
    ? {
        ...common,
        kind: 'D20_EVIDENCE',
        request: {
          requestId: snapshot.request.requestId,
          min: 1,
          max: 20,
          rollMode: d20Policy.rollMode,
          derivedRollModeReasons: reasons({
            rollMode: d20Policy.rollMode,
            contributors: d20Policy.contributors
          })
        },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    : {
        ...common,
        kind: 'ACTION_OUTCOME_EVIDENCE',
        request: {
          requestId: snapshot.request.requestId,
          min: snapshot.request.min,
          max: snapshot.request.max
        },
        allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
      }
}

export function nativeActionPendingResult(
  run: Doc<'encounterRuns'>,
  occurrence: Doc<'encounterRuleOccurrences'>
) {
  if (
    run.id !== occurrence.encounterId ||
    run.campaignId !== occurrence.campaignId ||
    run.version !== occurrence.expectedEncounterVersion
  )
    throw new Error('Pending Encounter action scope is stale.')
  return encounterCommandResultDtoSchema.parse({
    projection: readRunProjection(run),
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: projectNativeActionPending(occurrence)
    }
  })
}
