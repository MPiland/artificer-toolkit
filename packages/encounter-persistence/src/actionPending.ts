import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterActorControl } from './actorController.js'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { readRunActor, readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/** Reads the sealed action root without exposing executable facts to recipients. */
export async function readNativeActionPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  const snapshot =
    occurrence.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  if (!snapshot) throw new Error('Stored Encounter action is not pending.')
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    snapshot.occurrenceId !== occurrence.id
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
  ctx: EncounterReadTransaction,
  input: {
    run: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
    occurrence: EncounterDocument<'encounterRuleOccurrences'>
  }
): Promise<boolean> {
  if (input.membership.role === 'OWNER') return true
  const { context } = await readNativeActionPending(ctx, input.occurrence)
  const actor = await readRunActor(ctx, readRunState(input.run), context.rollerActorId)
  return (await readEncounterActorControl(ctx, { ...input, actor })) !== null
}

export type NativeActionPending = Awaited<ReturnType<typeof readNativeActionPending>>

export function projectNativeActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  { snapshot, context }: Pick<NativeActionPending, 'snapshot' | 'context'>,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto {
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

export async function nativeActionPendingResult(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  if (
    run.id !== occurrence.encounterId ||
    run.campaignId !== occurrence.campaignId ||
    run.version !== occurrence.expectedEncounterVersion
  )
    throw new Error('Pending Encounter action scope is stale.')
  return encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, readRunState(run)),
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: projectNativeActionPending(
        occurrence,
        await readNativeActionPending(ctx, occurrence)
      )
    }
  })
}
