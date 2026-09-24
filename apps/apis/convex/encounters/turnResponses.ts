import {
  encounterCommandResultDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { prepareEncounterTurnResponse } from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { nextRollInt } from '../lib/rollRandom'
import { readRunState, readRunProjection } from './documents'
import { requireUnusedEvidenceCommandId } from './timelineEntries'
import { resumeNativeTurn } from './turnCompletion'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'

export { matchesNativeTurnResponse } from '@artificer-toolkit/rules-runtime/encounterTurnResponse'

export async function resolveNativeTurnResponse(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  encounter: Doc<'encounterRuns'>
  occurrence: Doc<'encounterRuleOccurrences'>
  pending: ServerRuleExecutionPendingSnapshotDto
  command: ResolveRuleOccurrenceInputDto
  userId: string
  updatedAt: string
}) {
  const { ctx, campaign, encounter, occurrence, pending, command, userId } = input
  const prepared = prepareEncounterTurnResponse({
    pending,
    command,
    userId,
    ownerUserId: campaign.ownerUserId,
    occurrence: {
      id: occurrence.id,
      rootCommandId: occurrence.rootCommandId,
      version: occurrence.version,
      expectedEncounterVersion: occurrence.expectedEncounterVersion
    },
    encounterVersion: encounter.version
  })
  if (prepared.kind === 'REPLAY') {
    return encounterCommandResultDtoSchema.parse({
      projection: readRunProjection(encounter),
      roll: null,
      resolution: null,
      occurrence: {
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        status: 'PENDING',
        outcome: null,
        pending: projectNativeTurnPending({
          snapshot: pending,
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          encounterVersion: encounter.version
        })
      }
    })
  }
  if (prepared.kind !== 'READY') throw new Error('Encounter turn response is unavailable.')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, command.commandId)
  return resumeNativeTurn({
    ctx,
    encounter,
    campaign,
    occurrence,
    occurrenceVersion: occurrence.version + 1,
    state: readRunState(encounter),
    projection: readRunProjection(encounter),
    root: prepared.root,
    pending: prepared.pending,
    resolution: command.resolution,
    ...(pending.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE'
      ? {
          rawDie:
            command.resolution.kind === 'ENTER_INTEGER'
              ? command.resolution.value
              : nextRollInt(6) + 1
        }
      : {}),
    updatedAt: input.updatedAt
  })
}
