import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  getPendingEncounterRuleOccurrenceInputDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'
import {
  serverRuleExecutionPendingOccurrenceId,
  serverRuleExecutionPendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { projectNativeActionPending } from './actionPending'
import { projectNativeDisarmPendingForMember } from './actionDisarmPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import type { Doc } from '../_generated/dataModel'
import { internalQuery, query, type QueryCtx } from '../_generated/server'
import {
  projectNativeTurnPending,
  projectNativeLegendaryPending
} from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { projectNativeCleavingPending } from './cleavingPending'
import { projectNativeConcentrationPending } from './concentrationPending'
import { readCampaignAssignedCharacter } from '../campaigns/assignedCharacter'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readRunActors, readRunState, readValidatedRunProjection } from './documents'
const pendingRuleOccurrenceDefinition = {
  args: zodToConvexFields(getPendingEncounterRuleOccurrenceInputDtoSchema.shape),
  get returns(): Validator<PendingEncounterRuleOccurrenceSummaryDto | null, 'required', string> {
    return zodToConvex<z.core.$ZodType<PendingEncounterRuleOccurrenceSummaryDto | null>>(
      zMini.nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
    )
  },
  handler: async (
    ctx: QueryCtx,
    args: z.infer<typeof getPendingEncounterRuleOccurrenceInputDtoSchema>
  ): Promise<PendingEncounterRuleOccurrenceSummaryDto | null> => {
    const input = getPendingEncounterRuleOccurrenceInputDtoSchema.parse({
      encounterId: args.encounterId.toLowerCase()
    })
    const { userId } = await requireIdentity(ctx)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
      .unique()
    if (!row) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
    readValidatedRunProjection(row, campaign)
    return zMini
      .nullable(pendingEncounterRuleOccurrenceSummaryDtoSchema)
      .parse(await readPendingRunDecision(ctx, row, campaign, membership))
  }
}

export const pendingRuleOccurrence = query(pendingRuleOccurrenceDefinition)
export const forPrepared = internalQuery(pendingRuleOccurrenceDefinition)

export async function readPendingRunDecision(
  ctx: QueryCtx,
  row: Doc<'encounterRuns'>,
  campaign: Doc<'campaigns'>,
  membership: Doc<'campaignMemberships'>
): Promise<PendingEncounterRuleOccurrenceSummaryDto | null> {
  const occurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (occurrences.length > 1) throw new Error('Stored Encounter occurrence state is invalid.')
  const occurrence = occurrences[0]
  if (!occurrence) return null
  if (
    occurrence.campaignId !== campaign.id ||
    occurrence.expectedEncounterVersion !== row.version ||
    occurrence.pendingSnapshotJson === null ||
    occurrence.pendingSnapshotChecksum === null
  )
    throw new Error('Stored Encounter occurrence state is invalid.')
  const pendingSnapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(
    JSON.parse(occurrence.pendingSnapshotJson)
  )
  if (
    checksumCanonicalJson(pendingSnapshot) !== occurrence.pendingSnapshotChecksum ||
    serverRuleExecutionPendingOccurrenceId(pendingSnapshot) !== occurrence.id
  )
    throw new Error('Stored Encounter occurrence state is invalid.')
  const context = pendingSnapshot.applicationContext
  if (context.kind === 'ENCOUNTER_ACTION' && context.contest)
    return projectNativeDisarmPendingForMember(ctx, row, campaign, membership, occurrence)
  if (context.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK') {
    const assigned =
      membership.role === 'PLAYER'
        ? await readCampaignAssignedCharacter(ctx, campaign, membership)
        : null
    const actor = (await readRunActors(ctx, readRunState(row))).find(
      (entry) => entry.id === context.application.targetActorId
    )
    if (
      actor?.kind !== 'CHARACTER' ||
      (membership.role !== 'OWNER' && actor.sourceId !== assigned?.id)
    )
      return null
    return projectNativeConcentrationPending(occurrence)
  }
  if (
    context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
    context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
  ) {
    const root = context.root
    if (
      root.rootCommandId !== occurrence.rootCommandId ||
      root.expectedEncounterVersion !== row.version ||
      root.initiatorUserId !== campaign.ownerUserId
    )
      throw new Error('Stored Encounter turn root is invalid.')
    if (membership.role !== 'OWNER') return null
    return projectNativeLegendaryPending({
      snapshot: pendingSnapshot,
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: row.version
    })
  }
  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING') {
    const assigned = await readCampaignAssignedCharacter(ctx, campaign, membership)
    const visibleActorIds = new Set(
      readValidatedRunProjection(row, campaign)
        .actors.filter((actor) => actor.public)
        .map((actor) => actor.id)
    )
    return projectNativeCleavingPending(occurrence, {
      isOwner: membership.role === 'OWNER',
      assignedCharacterId: assigned?.id ?? null,
      visibleActorIds
    })
  }
  if (
    context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
    (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' && context.movementContinuation)
  ) {
    const root =
      context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
        ? context.movement.root
        : context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
          ? context.movementContinuation?.root
          : context.root
    if (!root || root.encounterId !== row.id || root.commandId !== occurrence.rootCommandId)
      throw new Error('Stored Encounter occurrence root is invalid.')
    const assigned =
      membership.role === 'PLAYER'
        ? await readCampaignAssignedCharacter(ctx, campaign, membership)
        : null
    return projectEncounterSpatialOccurrenceSummary(
      {
        id: occurrence.id,
        version: occurrence.version,
        state: occurrence.state,
        pendingSnapshot
      },
      row.version,
      {
        membershipRole: membership.role,
        assignedCharacterId: assigned?.id ?? null,
        assignedActorId: assigned
          ? ((await readRunActors(ctx, readRunState(row))).find(
              (actor) => actor.kind === 'CHARACTER' && actor.sourceId === assigned.id
            )?.id ?? null)
          : null
      }
    ).pending
  }
  if (
    context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' ||
    (context.kind === 'ENCOUNTER_INITIATIVE' && context.phase.kind === 'INITIATIVE_DECLARATION')
  ) {
    if (
      context.root.rootCommandId !== occurrence.rootCommandId ||
      context.root.expectedEncounterVersion !== row.version ||
      context.root.stagedInitiativeRoundState.round.encounterId !== row.id
    )
      throw new Error('Stored initiative declaration root is invalid.')
    const pending = projectEncounterInitiativePendingSummary({
      pendingSnapshot,
      occurrenceVersion: occurrence.version,
      encounterVersion: row.version
    })
    if (pending.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Stored initiative declaration is invalid.')
    if (membership.role === 'OWNER') return pending
    const assigned = await readCampaignAssignedCharacter(ctx, campaign, membership)
    const actor = (await readRunActors(ctx, readRunState(row))).find(
      (candidate) => candidate.id === pending.actorId
    )
    return assigned && actor?.kind === 'CHARACTER' && actor.sourceId === assigned.id
      ? pending
      : null
  }
  // Action evidence and initiative scoring/order belong to the GM.
  if (membership.role !== 'OWNER') return null
  if (context.kind === 'ENCOUNTER_ACTION') return projectNativeActionPending(occurrence)
  if (
    context.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
  ) {
    if (
      context.root.rootCommandId !== occurrence.rootCommandId ||
      context.root.expectedEncounterVersion !== row.version ||
      context.root.initiatorUserId !== campaign.ownerUserId
    )
      throw new Error('Stored Encounter turn root is invalid.')
    return projectNativeTurnPending({
      snapshot: pendingSnapshot,
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: row.version
    })
  }
  return projectEncounterInitiativePendingSummary({
    pendingSnapshot,
    occurrenceVersion: occurrence.version,
    encounterVersion: row.version
  })
}
