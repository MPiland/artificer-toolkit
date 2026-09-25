import {
  encounterCommandResultDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { prepareEncounterTurnResponse } from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { nextRollInt } from '../lib/rollRandom'
import { readRunActors, readRunState, readRunProjection } from './documents'
import { readEncounterControlledActorIds } from './actorController'
import { requireUnusedEvidenceCommandId } from './timelineEntries'
import { resumeNativeTurn } from './turnCompletion'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import {
  resolveEncounterIntegerAnswer,
  withEncounterAppRoll
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { readEncounterSettledAppRoll } from './evidenceRolls'

export async function resolveNativeTurnResponse(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  membership: Doc<'campaignMemberships'>
  encounter: Doc<'encounterRuns'>
  occurrence: Doc<'encounterRuleOccurrences'>
  pending: ServerRuleExecutionPendingSnapshotDto
  command: ResolveRuleOccurrenceInputDto
  userId: string
  updatedAt: string
}) {
  const { ctx, campaign, membership, encounter, occurrence, pending, command, userId } = input
  const prepared = prepareEncounterTurnResponse({
    pending,
    command,
    userId,
    ownerUserId: campaign.ownerUserId,
    responderControlledActorIds: await readEncounterControlledActorIds(ctx, {
      campaign,
      membership,
      actors: await readRunActors(ctx, readRunState(encounter))
    }),
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
  const resolution = withEncounterAppRoll(
    command.resolution,
    await readEncounterSettledAppRoll(ctx, { occurrence, response: command, userId })
  )
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
    resolution,
    ...(pending.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE'
      ? {
          rawDie: resolveEncounterIntegerAnswer({
            min: 1,
            max: 6,
            answer: resolution,
            random: nextRollInt
          })
        }
      : {}),
    updatedAt: input.updatedAt
  })
}
