import { encounterBasicActionCheckTrigger } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterDocument } from './store.js'

/** The frozen check and the paused graph a pending basic action check waits on. */
export function readBasicActionCheckSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  if (
    snapshot === null ||
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_BASIC_ACTION_CHECK' ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    snapshot.request.min !== 1 ||
    snapshot.request.max !== 20
  )
    throw new Error('The basic action check occurrence is unavailable.')
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

/** `snapshot` is the occurrence's `readPendingSnapshot`. */
export function readNativeBasicActionCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  const pending = readBasicActionCheckSnapshot(snapshot)
  if (
    occurrence.state !== 'PENDING' ||
    pending.snapshot.occurrenceId !== occurrence.id ||
    occurrence.rootCommandId !== pending.context.commandId
  )
    throw new Error('The basic action check occurrence is unavailable.')
  return pending
}

/** The helper rolls the check; its controllers and the GM answer it. */
export function projectNativeBasicActionCheckPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
) {
  const { snapshot, context } = readNativeBasicActionCheckPending(occurrence, pendingSnapshot)
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: context.helperActorId,
    trigger: encounterBasicActionCheckTrigger(context),
    request: {
      requestId: snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: context.d20.rollMode,
      derivedRollModeReasons: reasons({
        rollMode: context.d20.rollMode,
        contributors: context.d20.contributors
      })
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}
