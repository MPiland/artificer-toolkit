import {
  encounterCommandResultDtoSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { rejectDomain } from '../lib/domainRejections'

export async function readNativeTurnCommandPending(
  ctx: QueryCtx,
  {
    input,
    row,
    campaign,
    userId,
    commandFingerprint,
    projection
  }: {
    input: Exclude<EncounterCommandInputDto, { type: 'CREATE' }>
    row: Doc<'encounterRuns'>
    campaign: Doc<'campaigns'>
    /** A retry returns the pending root only to the user who issued it. */
    userId: string
    commandFingerprint: string
    projection: EncounterCommandResultDto['projection']
  }
) {
  const rootCommandOccurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', campaign.id).eq('rootCommandId', input.commandId)
    )
    .unique()
  if (rootCommandOccurrence) {
    if (
      (input.type !== 'START' && input.type !== 'ADVANCE_TURN') ||
      rootCommandOccurrence.encounterId !== row.id ||
      rootCommandOccurrence.state !== 'PENDING' ||
      rootCommandOccurrence.pendingSnapshotJson === null ||
      rootCommandOccurrence.pendingSnapshotChecksum === null ||
      rootCommandOccurrence.expectedEncounterVersion !== row.version
    )
      rejectDomain('COMMAND_ID_REUSED')
    const pendingSnapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
      JSON.parse(rootCommandOccurrence.pendingSnapshotJson)
    )
    const pendingContext = pendingSnapshot.applicationContext
    if (
      checksumCanonicalJson(pendingSnapshot) !== rootCommandOccurrence.pendingSnapshotChecksum ||
      (pendingContext.kind !== 'ENCOUNTER_INITIATIVE' &&
        pendingContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE') ||
      pendingContext.root.rootCommandId !== input.commandId ||
      pendingContext.root.commandFingerprint !== commandFingerprint ||
      pendingContext.root.commandType !== input.type ||
      pendingContext.root.requestedByUserId !== userId ||
      pendingContext.root.expectedEncounterVersion !== row.version ||
      input.expectedVersion !== row.version
    )
      rejectDomain('COMMAND_ID_REUSED')
    const result = encounterCommandResultDtoSchema.parse({
      projection,
      roll: null,
      resolution: null,
      occurrence: {
        occurrenceId: rootCommandOccurrence.id,
        occurrenceVersion: rootCommandOccurrence.version,
        status: 'PENDING',
        outcome: null,
        pending:
          pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
            ? projectNativeTurnPending({
                snapshot: pendingSnapshot,
                occurrenceId: rootCommandOccurrence.id,
                occurrenceVersion: rootCommandOccurrence.version,
                encounterVersion: row.version
              })
            : projectEncounterInitiativePendingSummary({
                pendingSnapshot,
                occurrenceVersion: rootCommandOccurrence.version,
                encounterVersion: row.version
              })
      }
    })
    return { occurrence: rootCommandOccurrence, snapshot: pendingSnapshot, result }
  }
  return null
}
