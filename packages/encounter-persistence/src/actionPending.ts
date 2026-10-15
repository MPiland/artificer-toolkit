import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterActorControl } from './actorController.js'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { readRunActor, readRunState } from './documents.js'
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
  return canControlEvidenceRoller(ctx, { ...input, rollerActorId: context.rollerActorId })
}

/** Whether the member controls the actor whose roll a pending request waits on. */
export async function canControlEvidenceRoller(
  ctx: EncounterReadTransaction,
  input: {
    run: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
    rollerActorId: string
  }
): Promise<boolean> {
  if (input.membership.role === 'OWNER') return true
  const actor = await readRunActor(ctx, readRunState(input.run), input.rollerActorId)
  return (await readEncounterActorControl(ctx, { ...input, actor })) !== null
}

type NativeActionPending = Awaited<ReturnType<typeof readNativeActionPending>>

/**
 * The pending summary one viewer reads. The campaign owner sees the d20's true mode and reasons;
 * everyone else sees what the roller's own facts imply, and a held die with its player caption
 * (ATTACK-10.1). Nothing a player reads carries a GM reason.
 */
export function projectNativeActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  { snapshot, context }: Pick<NativeActionPending, 'snapshot' | 'context'>,
  isOwner: boolean,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto {
  if (context.legendaryResistance)
    return {
      kind: 'LEGENDARY_RESISTANCE_CHOICE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: occurrence.expectedEncounterVersion,
      targetActorId: context.rollerActorId,
      options: [{ optionId: context.legendaryResistance.resistance.useOptionId }],
      allowedResponses: ['DECLINE', 'OPTION']
    }
  if (context.reactionChoice)
    return {
      kind: 'REACTION_CHOICE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: occurrence.expectedEncounterVersion,
      targetActorId: context.rollerActorId,
      options: [{ optionId: context.reactionChoice.reactions[0].useOptionId }],
      allowedResponses: ['DECLINE', 'OPTION']
    }
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
  if (d20Policy && context.heldD20)
    return {
      ...common,
      kind: 'D20_EVIDENCE',
      request: {
        requestId: snapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: 'NORMAL',
        derivedRollModeReasons: [],
        heldD20: {
          faces: context.heldD20.faces,
          caption: isOwner ? context.heldD20.gmReason : context.heldD20.playerCaption
        }
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
  const shown = d20Policy && !isOwner && context.d20Belief ? context.d20Belief : d20Policy
  return shown
    ? {
        ...common,
        kind: 'D20_EVIDENCE',
        request: {
          requestId: snapshot.request.requestId,
          min: 1,
          max: 20,
          rollMode: shown.rollMode,
          derivedRollModeReasons: reasons({
            rollMode: shown.rollMode,
            contributors: shown.contributors
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
