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
import type { EncounterD20WindowPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20Window'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
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

/** The frozen check and the paused graph a pending concealment check (Hide, Search) waits on. */
function readConcealmentCheckD20(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = readKernelCheckSnapshot(snapshot)
  if (pending?.context.kind !== 'ENCOUNTER_CONCEALMENT_CHECK')
    throw new Error('The basic action check occurrence is unavailable.')
  return {
    snapshot: pending.snapshot,
    continuation: pending.continuation,
    context: pending.context
  }
}

/** The frozen check and the paused graph a pending Escape check waits on. */
function readEscapeCheckD20(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = readKernelCheckSnapshot(snapshot)
  if (pending?.context.kind !== 'ENCOUNTER_ESCAPE_CHECK')
    throw new Error('The escape check occurrence is unavailable.')
  return {
    snapshot: pending.snapshot,
    continuation: pending.continuation,
    context: pending.context
  }
}

type D20WindowCheck = EncounterD20WindowPendingContextDto['source']['context']

/**
 * The check a pending snapshot waits on, with the d20 window its d20 opened when it waits on that
 * instead (D168): the window's frozen check stands in for the check's own pending read. Null when
 * the snapshot waits on neither.
 */
function readCheckOrD20Window<TKind extends D20WindowCheck['kind']>(
  snapshot: ServerRuleExecutionPendingSnapshotDto | null,
  kind: TKind,
  readCheck: (snapshot: ServerRuleExecutionPendingSnapshotDto | null) =>
    | (Omit<NonNullable<ReturnType<typeof splitKernelSnapshot>>, 'context'> & {
        context: Extract<D20WindowCheck, { kind: TKind }>
      })
    | null
) {
  const pending = readD20WindowSnapshot(snapshot)
  if (!pending) {
    const check = readCheck(snapshot)
    return check && { ...check, window: null }
  }
  const check = pending.context.source.context
  const isKind = (context: D20WindowCheck): context is Extract<D20WindowCheck, { kind: TKind }> =>
    context.kind === kind
  return isKind(check)
    ? {
        snapshot: pending.snapshot,
        continuation: pending.continuation,
        context: check,
        window: pending.context
      }
    : null
}

/** The concealment check (Hide, Search) a pending snapshot waits on, or the d20 window its d20 opened. */
export function readBasicActionCheckSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readCheckOrD20Window(
    snapshot,
    'ENCOUNTER_CONCEALMENT_CHECK',
    readConcealmentCheckD20
  )
  if (!pending) throw new Error('The basic action check occurrence is unavailable.')
  return pending
}

/** The Escape check a pending snapshot waits on, or the d20 window its d20 opened. */
export function readEscapeCheckSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = readCheckOrD20Window(snapshot, 'ENCOUNTER_ESCAPE_CHECK', readEscapeCheckD20)
  if (!pending) throw new Error('The escape check occurrence is unavailable.')
  return pending
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
  const pending = readConcealmentCheckD20(snapshot)
  requirePendingRoot(occurrence, pending)
  return pending
}

/** `snapshot` is the occurrence's `readPendingSnapshot`. */
export function readNativeEscapeCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readEscapeCheckD20(snapshot)
  requirePendingRoot(occurrence, pending)
  return pending
}

/**
 * The check action a pending occurrence waits on (D173): its roller's d20, or, once that reached
 * the DC, the outcome's dice on the outcome graph's own request.
 */
export function readNativeCheckActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readCheckActionPhaseSnapshot(snapshot)
  if (!pending) throw new Error('The check action occurrence is unavailable.')
  requirePendingRoot(occurrence, pending)
  return pending
}

function readCheckActionPhaseSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  const pending = splitKernelSnapshot(snapshot)
  return pending?.context.kind === 'ENCOUNTER_CHECK_ACTION' &&
    pending.snapshot.request.kind === 'INTEGER_RANGE' &&
    (pending.context.phase.kind === 'OUTCOME' || readKernelCheckSnapshot(pending.snapshot))
    ? { snapshot: pending.snapshot, continuation: pending.continuation, context: pending.context }
    : null
}

/**
 * The check action a pending snapshot waits on (D173), with the d20 window its d20 opened when it
 * waits on one; null when the snapshot waits on anything else.
 */
export function readCheckActionSnapshot(snapshot: ServerRuleExecutionPendingSnapshotDto | null) {
  return readCheckOrD20Window(snapshot, 'ENCOUNTER_CHECK_ACTION', readCheckActionPhaseSnapshot)
}

/** The check action's roller sees its d20, or the outcome's dice; its controllers and the GM answer. */
function projectNativeCheckActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto,
  reasons: EncounterRollModeReasons
) {
  const { snapshot, context } = readNativeCheckActionPending(occurrence, pendingSnapshot)
  if (context.phase.kind === 'CHECK')
    return projectD20Evidence(occurrence, snapshot, context, reasons)
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'ACTION_OUTCOME_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: context.actorId,
    request: {
      requestId: snapshot.request.requestId,
      min: snapshot.request.min,
      max: snapshot.request.max
    },
    allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
  })
}

/** The roller rolls the check (the helper, the escaping holder or the acting actor); its controllers and the GM answer it. */
export function projectNativeBasicActionCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
) {
  if (pendingSnapshot.applicationContext.kind === 'ENCOUNTER_CHECK_ACTION')
    return projectNativeCheckActionPending(occurrence, pendingSnapshot, reasons)
  const { snapshot, context } =
    pendingSnapshot.applicationContext.kind === 'ENCOUNTER_ESCAPE_CHECK'
      ? readNativeEscapeCheckPending(occurrence, pendingSnapshot)
      : readNativeBasicActionCheckPending(occurrence, pendingSnapshot)
  return projectD20Evidence(occurrence, snapshot, context, reasons)
}

function projectD20Evidence(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto,
  context:
    | ReturnType<typeof readNativeBasicActionCheckPending>['context']
    | ReturnType<typeof readNativeEscapeCheckPending>['context']
    | ReturnType<typeof readNativeCheckActionPending>['context'],
  reasons: EncounterRollModeReasons
) {
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: context.actorId,
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
