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
import { canAnswerNativeActionEvidence, projectNativeActionPending } from './actionPending'
import { projectNativeDisarmPendingForMember } from './actionDisarmPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import type { Doc } from '../_generated/dataModel'
import { internalQuery, query, type QueryCtx } from '../_generated/server'
import {
  projectNativeTurnPending,
  projectNativeLegendaryPending,
  turnPendingActorId
} from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { projectNativeCleavingPending } from './cleavingPending'
import { projectNativeConcentrationPending } from './concentrationPending'
import {
  readEncounterActorPrimaryController,
  readEncounterControlledActorIds
} from './actorController'
import { withEncounterRollModeReasons } from './rollModeReasons'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { readRunActor, readRunActors, readRunState, readValidatedRunProjection } from './documents'
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

/**
 * Whom a member waits on when a decision is pending that they can't answer (it survives a reload):
 * the player who controls the actor the decision belongs to, else the GM.
 */
export async function readEncounterWaitingOn(
  ctx: QueryCtx,
  row: Doc<'encounterRuns'>,
  campaign: Doc<'campaigns'>
): Promise<'GM' | 'PLAYER' | null> {
  const ownerMembership = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_userId', (q) =>
      q.eq('campaignId', campaign.id).eq('userId', campaign.ownerUserId)
    )
    .unique()
  if (!ownerMembership) throw new Error('The Campaign owner membership is unavailable.')
  const decision = await readPendingRunDecision(ctx, row, campaign, ownerMembership)
  if (!decision) return null
  const actorId =
    decision.kind === 'D20_EVIDENCE' ||
    decision.kind === 'ACTION_OUTCOME_EVIDENCE' ||
    decision.kind === 'RECHARGE_EVIDENCE'
      ? decision.rollerActorId
      : decision.kind === 'INITIATIVE_DECLARATION'
        ? decision.actorId
        : decision.kind === 'MOVEMENT_REACTION'
          ? decision.choice.reactorActorId
          : decision.kind === 'MOVEMENT_PASSAGE_CHOICE'
            ? decision.sourceActorId
            : decision.kind === 'LEGENDARY_ACTION_CHOICE'
              ? decision.ownerActorId
              : null
  if (!actorId) return 'GM'
  const actor = await readRunActor(ctx, readRunState(row), actorId)
  return (await readEncounterActorPrimaryController(ctx, campaign, actor)) === campaign.ownerUserId
    ? 'GM'
    : 'PLAYER'
}

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
  const actors = await readRunActors(ctx, readRunState(row))
  const controlledActorIds = await readEncounterControlledActorIds(ctx, {
    campaign,
    membership,
    actors
  })
  if (context.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK') {
    const actor = actors.find((entry) => entry.id === context.application.targetActorId)
    return actor && controlledActorIds.has(actor.id)
      ? withEncounterRollModeReasons(ctx, row.gameSystemId, (reasons) =>
          projectNativeConcentrationPending(occurrence, reasons)
        )
      : null
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
    // A Creature's controllers pick and roll its Legendary Action.
    const actorId = turnPendingActorId(pendingSnapshot)
    if (actorId === null || !controlledActorIds.has(actorId)) return null
    return withEncounterRollModeReasons(ctx, row.gameSystemId, (reasons) =>
      projectNativeLegendaryPending({
        snapshot: pendingSnapshot,
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: row.version,
        reasons
      })
    )
  }
  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
    return projectNativeCleavingPending(occurrence, {
      isOwner: membership.role === 'OWNER',
      controlledActorIds,
      visibleActorIds: new Set(actors.filter((actor) => actor.public).map((actor) => actor.id))
    })
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
    return withEncounterRollModeReasons(
      ctx,
      row.gameSystemId,
      (reasons) =>
        projectEncounterSpatialOccurrenceSummary(
          {
            id: occurrence.id,
            version: occurrence.version,
            state: occurrence.state,
            pendingSnapshot
          },
          row.version,
          { controlledActorIds },
          reasons
        ).pending
    )
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
    return controlledActorIds.has(pending.actorId) ? pending : null
  }
  if (context.kind === 'ENCOUNTER_ACTION')
    return (await canAnswerNativeActionEvidence(ctx, {
      run: row,
      campaign,
      membership,
      occurrence
    }))
      ? withEncounterRollModeReasons(ctx, row.gameSystemId, (reasons) =>
          projectNativeActionPending(occurrence, reasons)
        )
      : null
  if (
    context.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
  ) {
    // Turn-effect saves and Recharge dice go to their actor's controllers.
    const actorId = turnPendingActorId(pendingSnapshot)
    if (actorId === null || !controlledActorIds.has(actorId)) return null
    if (
      context.root.rootCommandId !== occurrence.rootCommandId ||
      context.root.expectedEncounterVersion !== row.version ||
      context.root.initiatorUserId !== campaign.ownerUserId
    )
      throw new Error('Stored Encounter turn root is invalid.')
    return withEncounterRollModeReasons(ctx, row.gameSystemId, (reasons) =>
      projectNativeTurnPending({
        snapshot: pendingSnapshot,
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: row.version,
        reasons
      })
    )
  }
  // Initiative scoring and order belong to the GM.
  if (membership.role !== 'OWNER') return null
  return projectEncounterInitiativePendingSummary({
    pendingSnapshot,
    occurrenceVersion: occurrence.version,
    encounterVersion: row.version
  })
}
