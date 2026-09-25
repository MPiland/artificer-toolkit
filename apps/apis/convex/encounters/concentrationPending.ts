import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { concentrationRollTrigger } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import type { Doc } from '../_generated/dataModel'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'

export function readNativeConcentrationPending(occurrence: Doc<'encounterRuleOccurrences'>) {
  if (occurrence.state !== 'PENDING' || occurrence.pendingSnapshotJson === null)
    throw new Error('The concentration occurrence is unavailable.')
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(occurrence.pendingSnapshotJson)
  )
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' ||
    snapshot.occurrenceId !== occurrence.id ||
    occurrence.id !==
      concentrationOccurrenceId(
        snapshot.applicationContext.parentOccurrenceId,
        snapshot.applicationContext.application
      ) ||
    occurrence.rootCommandId !== concentrationCommandId(occurrence.id) ||
    checksumCanonicalJson(snapshot) !== occurrence.pendingSnapshotChecksum ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    snapshot.request.min !== 1 ||
    snapshot.request.max !== 20
  )
    throw new Error('The concentration occurrence is unavailable.')
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

export function projectNativeConcentrationPending(
  occurrence: Doc<'encounterRuleOccurrences'>,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
) {
  const { snapshot, context } = readNativeConcentrationPending(occurrence)
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    // The concentrating actor makes the save; its controllers and the GM answer it.
    rollerActorId: context.application.targetActorId,
    trigger: concentrationRollTrigger(context),
    request: {
      requestId: snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: context.save.rollMode,
      derivedRollModeReasons: reasons({
        rollMode: context.save.rollMode,
        contributors: context.save.contributors
      })
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}
