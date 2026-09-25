import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'

export function readNativeCleavingPending(occurrence: Doc<'encounterRuleOccurrences'>) {
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  if (
    occurrence.state !== 'PENDING' ||
    occurrence.pendingSnapshotJson === null ||
    occurrence.pendingSnapshotChecksum === null
  )
    return null
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(occurrence.pendingSnapshotJson)
  )
  if (
    snapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' ||
    snapshot.occurrenceId !== occurrence.id ||
    checksumCanonicalJson(snapshot) !== occurrence.pendingSnapshotChecksum
  )
    throw new Error('Stored Encounter Cleaving pending snapshot mismatch.')
  return { snapshot, context: snapshot.applicationContext }
}

/** Projects the choice only to the source actor's controllers, with targets they can see. */
export function projectNativeCleavingPending(
  occurrence: Doc<'encounterRuleOccurrences'>,
  viewer: {
    isOwner: boolean
    controlledActorIds: ReadonlySet<string>
    visibleActorIds: ReadonlySet<string>
  }
): PendingEncounterRuleOccurrenceSummaryDto | null {
  const pending = readNativeCleavingPending(occurrence)
  if (!pending) return null
  const { context } = pending
  if (!viewer.controlledActorIds.has(context.sourceActorId)) return null
  const options = context.options
    .filter((option) => viewer.isOwner || viewer.visibleActorIds.has(option.targetActorId))
    .map(({ optionId, targetActorId }) => ({ optionId, targetActorId }))
  if (!options.length) return null
  return {
    kind: 'OPTIONAL_COMBAT_CLEAVING',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    sourceActorId: context.sourceActorId,
    options,
    allowedResponses: ['DECLINE', 'OPTION']
  }
}
