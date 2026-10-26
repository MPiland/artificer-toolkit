import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { damageSaveRollTrigger } from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { damageSaveContextBoundApplication } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import type { EncounterDocument } from './store.js'

/** `snapshot` is the occurrence's `readPendingSnapshot`. */
export function readNativeConcentrationPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  if (occurrence.state !== 'PENDING' || snapshot === null)
    throw new Error('The concentration occurrence is unavailable.')
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_DAMAGE_SAVE_CHECK' ||
    snapshot.occurrenceId !== occurrence.id ||
    occurrence.id !==
      concentrationOccurrenceId(
        snapshot.applicationContext.parentOccurrenceId,
        damageSaveContextBoundApplication(snapshot.applicationContext)
      ) ||
    occurrence.rootCommandId !== concentrationCommandId(occurrence.id) ||
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
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
) {
  const { snapshot, context } = readNativeConcentrationPending(occurrence, pendingSnapshot)
  // The save the roller makes: the holder's derived one, or the effect's frozen policy.
  const save =
    context.source !== 'EFFECT_REPEAT_SAVE'
      ? context.save
      : {
          rollMode: context.d20Policy.rollMode,
          keep: context.d20Policy.keep,
          contributors: context.d20Policy.contributors,
          addedDice: context.d20Policy.addedDice
        }
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    // The damaged holder makes the save; its controllers and the GM answer it.
    rollerActorId: context.application.targetActorId,
    trigger: damageSaveRollTrigger(context),
    request: {
      requestId: snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: save.rollMode,
      keep: save.keep,
      rollModes: rollModeCapabilityRegistry.offeredRollModes(snapshot.graph.source.gameSystemId),
      derivedRollModeReasons: reasons({
        rollMode: save.rollMode,
        contributors: save.contributors
      }),
      ...(save.addedDice ? { addedDice: save.addedDice } : {})
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}
