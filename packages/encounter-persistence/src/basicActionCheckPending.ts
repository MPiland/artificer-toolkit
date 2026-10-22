import { encounterBasicActionCheckTrigger } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { encounterConcealmentCheckTrigger } from '@artificer-toolkit/rules-runtime/encounterConcealmentCheck'
import {
  encounterD20WindowRollerActorId,
  encounterD20WindowTrigger
} from '@artificer-toolkit/rules-runtime/encounterD20Window'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterDocument } from './store.js'

/** A kernel snapshot split into the paused graph and the application context it waits under. */
function splitKernelSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  if (snapshot === null || snapshot.snapshotKind !== 'KERNEL_EVIDENCE') return null
  const {
    snapshotKind: _kind,
    applicationContext: context,
    optionalCombatSnapshotChecksum: _optional,
    phaseReceipts: _phases,
    deferredCleaving: _cleaving,
    ...continuation
  } = snapshot
  return { snapshot, context, continuation }
}

/** The paused d20 graph of a kernel snapshot, split from its application context. */
function readKernelCheckSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = splitKernelSnapshot(snapshot)
  return pending?.snapshot.request.kind === 'INTEGER_RANGE' &&
    pending.snapshot.request.min === 1 &&
    pending.snapshot.request.max === 20
    ? pending
    : null
}

/**
 * The frozen check and the paused graph a pending basic action check waits on: a stabilizing
 * check (First Aid) or a concealment check (Hide, Search).
 */
export function readBasicActionCheckSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readKernelCheckSnapshot(snapshot)
  if (
    pending?.context.kind !== 'ENCOUNTER_BASIC_ACTION_CHECK' &&
    pending?.context.kind !== 'ENCOUNTER_CONCEALMENT_CHECK'
  )
    throw new Error('The basic action check occurrence is unavailable.')
  return {
    snapshot: pending.snapshot,
    continuation: pending.continuation,
    context: pending.context
  }
}

/** The frozen check and the paused graph a pending Escape check waits on. */
export function readEscapeCheckSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = readKernelCheckSnapshot(snapshot)
  if (pending?.context.kind !== 'ENCOUNTER_ESCAPE_CHECK')
    throw new Error('The escape check occurrence is unavailable.')
  return {
    snapshot: pending.snapshot,
    continuation: pending.continuation,
    context: pending.context
  }
}

function requirePendingRoot(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pending: { snapshot: { occurrenceId: string }; context: { commandId: string } }
) {
  if (
    occurrence.state !== 'PENDING' ||
    pending.snapshot.occurrenceId !== occurrence.id ||
    occurrence.rootCommandId !== pending.context.commandId
  )
    throw new Error('The check occurrence is unavailable.')
}

/** `snapshot` is the occurrence's `readPendingSnapshot`. */
export function readNativeBasicActionCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readBasicActionCheckSnapshot(snapshot)
  requirePendingRoot(occurrence, pending)
  return pending
}

/** `snapshot` is the occurrence's `readPendingSnapshot`. */
export function readNativeEscapeCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readEscapeCheckSnapshot(snapshot)
  requirePendingRoot(occurrence, pending)
  return pending
}

/** The roller rolls the check (the helper, or the escaping holder); its controllers and the GM answer it. */
export function projectNativeBasicActionCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
) {
  const { snapshot, context } =
    pendingSnapshot.applicationContext.kind === 'ENCOUNTER_ESCAPE_CHECK'
      ? readNativeEscapeCheckPending(occurrence, pendingSnapshot)
      : readNativeBasicActionCheckPending(occurrence, pendingSnapshot)
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId:
      context.kind === 'ENCOUNTER_BASIC_ACTION_CHECK' ? context.helperActorId : context.actorId,
    trigger:
      context.kind === 'ENCOUNTER_CONCEALMENT_CHECK'
        ? encounterConcealmentCheckTrigger(context)
        : encounterBasicActionCheckTrigger(context),
    request: {
      requestId: snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: context.d20.rollMode,
      keep: context.d20.keep,
      rollModes: rollModeCapabilityRegistry.offeredRollModes(snapshot.graph.source.gameSystemId),
      derivedRollModeReasons: reasons({
        rollMode: context.d20.rollMode,
        contributors: context.d20.contributors
      }),
      ...(context.d20.addedDice ? { addedDice: context.d20.addedDice } : {})
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}

/** The window and the paused choice a rolled check waits on while its roller decides on a held die. */
export function readNativeD20WindowPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const window = readD20WindowSnapshot(snapshot)
  if (!window) throw new Error('The d20 window occurrence is unavailable.')
  requirePendingRoot(occurrence, window)
  return window
}

/** The paused window graph and its context, or null when the snapshot is not a d20 window. */
export function readD20WindowSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = splitKernelSnapshot(snapshot)
  return pending?.context.kind === 'ENCOUNTER_D20_WINDOW'
    ? { snapshot: pending.snapshot, continuation: pending.continuation, context: pending.context }
    : null
}

/** The roller sees the d20 and the dice it may add; its controllers and the GM answer. */
export function projectNativeD20WindowPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto
) {
  const { snapshot, context } = readNativeD20WindowPending(occurrence, pendingSnapshot)
  const { rolled, offer } = context.pause.payload
  const { selectedNatural, total } = rolled.d20
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_WINDOW',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: encounterD20WindowRollerActorId(context),
    trigger: encounterD20WindowTrigger(context),
    requestId: snapshot.request.requestId,
    d20: { selectedNatural, total },
    options: offer.options.map(({ optionId, label, count, faces, sign }) => ({
      optionId,
      label,
      count,
      faces,
      sign
    })),
    allowedResponses: ['D20_WINDOW_DECLINE', 'D20_WINDOW_USE']
  })
}
