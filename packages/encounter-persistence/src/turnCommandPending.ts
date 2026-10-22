import {
  encounterCommandResultDtoSchema,
  type EncounterCommandInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { rejectDomain } from './domainRejections.js'
import { readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

export async function readNativeTurnCommandPending(
  ctx: EncounterReadTransaction,
  {
    input,
    row,
    campaign,
    userId,
    commandFingerprint
  }: {
    input: Exclude<EncounterCommandInputDto, { type: 'CREATE' }>
    row: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    /** A retry returns the pending root only to the user who issued it. */
    userId: string
    commandFingerprint: string
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
      rootCommandOccurrence.expectedEncounterVersion !== row.version
    )
      rejectDomain('COMMAND_ID_REUSED')
    const pendingSnapshot = await readPendingSnapshot(ctx, rootCommandOccurrence)
    if (!pendingSnapshot) rejectDomain('COMMAND_ID_REUSED')
    const pendingContext = pendingSnapshot.applicationContext
    if (
      (pendingContext.kind !== 'ENCOUNTER_INITIATIVE' &&
        pendingContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_DEATH_SAVE' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
        pendingContext.kind !== 'ENCOUNTER_TURN_ZONE_EFFECTS' &&
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
      projection: await readEncounterGmProjection(ctx, readRunState(row)),
      roll: null,
      occurrence: {
        occurrenceId: rootCommandOccurrence.id,
        occurrenceVersion: rootCommandOccurrence.version,
        status: 'PENDING',
        pending:
          pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_DEATH_SAVE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
          pendingContext.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
          pendingContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
            ? projectNativeTurnPending({
                gameSystemId: row.gameSystemId,
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
