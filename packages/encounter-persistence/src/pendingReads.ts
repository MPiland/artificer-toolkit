import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { serverRuleExecutionPendingOccurrenceId } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  canAnswerNativeActionEvidence,
  projectNativeActionPending,
  readNativeActionPending
} from './actionPending.js'
import { projectNativeAreaActionPending, readNativeAreaActionPending } from './actionAreaPending.js'
import { projectNativeContestPendingForMember } from './actionContestPending.js'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { projectEncounterSpatialOccurrenceSummary } from '@artificer-toolkit/rules-runtime/encounterSpatialOccurrenceSummary'
import { contestCheckMovementContinuation } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import {
  projectNativeTurnPending,
  projectNativeLegendaryPending,
  turnPendingActorId
} from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { projectNativeCleavingPending } from './cleavingPending.js'
import { encounterD20WindowRollerActorId } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import {
  projectNativeBasicActionCheckPending,
  projectNativeD20WindowPending
} from './basicActionCheckPending.js'
import { projectNativeConcentrationPending } from './concentrationPending.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import {
  readEncounterActorPrimaryController,
  readEncounterControlledActorIds
} from './actorController.js'
import { withEncounterRollModeReasons } from './rollModeReasons.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * Whom a member waits on when a decision is pending that they can't answer (it survives a reload):
 * the player who controls the actor the decision belongs to, else the GM.
 */
export async function readEncounterWaitingOn(
  ctx: EncounterReadTransaction,
  row: EncounterDocument<'encounterRuns'>,
  campaign: EncounterDocument<'campaigns'>
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
  if (decision.kind === 'AREA_SAVES') {
    const controllers = await Promise.all(
      [...decision.saves, ...decision.legendaryResistance].map(async ({ actorId }) =>
        readEncounterActorPrimaryController(
          ctx,
          campaign,
          await readRunActor(ctx, readRunState(row), actorId)
        )
      )
    )
    return controllers.every((controller) => controller === campaign.ownerUserId) ? 'GM' : 'PLAYER'
  }
  const actorId =
    decision.kind === 'D20_EVIDENCE' ||
    decision.kind === 'ACTION_OUTCOME_EVIDENCE' ||
    decision.kind === 'RECHARGE_EVIDENCE'
      ? decision.rollerActorId
      : decision.kind === 'INITIATIVE_DECLARATION'
        ? decision.actorId
        : decision.kind === 'MOVEMENT_REACTION'
          ? decision.choice.reactorActorId
          : decision.kind === 'MOVEMENT_PASSAGE_CHOICE' ||
              decision.kind === 'FORCED_MOVEMENT_DESTINATION'
            ? decision.sourceActorId
            : decision.kind === 'LEGENDARY_ACTION_CHOICE'
              ? decision.ownerActorId
              : decision.kind === 'LEGENDARY_RESISTANCE_CHOICE' ||
                  decision.kind === 'REACTION_CHOICE'
                ? decision.targetActorId
                : decision.kind === 'ON_HIT_CHOICE' || decision.kind === 'ATTACK_RETARGET_CHOICE'
                  ? decision.attackerActorId
                  : null
  if (!actorId) return 'GM'
  const actor = await readRunActor(ctx, readRunState(row), actorId)
  return (await readEncounterActorPrimaryController(ctx, campaign, actor)) === campaign.ownerUserId
    ? 'GM'
    : 'PLAYER'
}

export async function readPendingRunDecision(
  ctx: EncounterReadTransaction,
  row: EncounterDocument<'encounterRuns'>,
  campaign: EncounterDocument<'campaigns'>,
  membership: EncounterDocument<'campaignMemberships'>
): Promise<PendingEncounterRuleOccurrenceSummaryDto | null> {
  const occurrences = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', row.id).eq('state', 'PENDING'))
    .take(2)
  if (occurrences.length > 1) throw new Error('Stored Encounter occurrence state is invalid.')
  const occurrence = occurrences[0]
  if (!occurrence) return null
  if (occurrence.campaignId !== campaign.id || occurrence.expectedEncounterVersion !== row.version)
    throw new Error('Stored Encounter occurrence state is invalid.')
  const pendingSnapshot = await readPendingSnapshot(ctx, occurrence)
  if (!pendingSnapshot || serverRuleExecutionPendingOccurrenceId(pendingSnapshot) !== occurrence.id)
    throw new Error('Stored Encounter occurrence state is invalid.')
  const context = pendingSnapshot.applicationContext
  if (context.kind === 'ENCOUNTER_ACTION' && context.contest)
    return projectNativeContestPendingForMember(ctx, row, campaign, membership, occurrence)
  const actors = await readRunActors(ctx, readRunState(row))
  const controlledActorIds = await readEncounterControlledActorIds(ctx, {
    campaign,
    membership,
    actors
  })
  if (context.kind === 'ENCOUNTER_DAMAGE_SAVE_CHECK') {
    const actor = actors.find((entry) => entry.id === context.application.targetActorId)
    return actor && controlledActorIds.has(actor.id)
      ? withEncounterRollModeReasons(ctx, row, membership, (reasons) =>
          projectNativeConcentrationPending(occurrence, pendingSnapshot, reasons)
        )
      : null
  }
  if (
    context.kind === 'ENCOUNTER_BASIC_ACTION_CHECK' ||
    context.kind === 'ENCOUNTER_CONCEALMENT_CHECK' ||
    context.kind === 'ENCOUNTER_ESCAPE_CHECK' ||
    context.kind === 'ENCOUNTER_CHECK_ACTION'
  )
    return controlledActorIds.has(
      context.kind === 'ENCOUNTER_BASIC_ACTION_CHECK' ? context.helperActorId : context.actorId
    )
      ? withEncounterRollModeReasons(
          ctx,
          row,
          membership,
          (reasons) => projectNativeBasicActionCheckPending(occurrence, pendingSnapshot, reasons),
          context.consumedGrants
        )
      : null
  if (context.kind === 'ENCOUNTER_D20_WINDOW')
    return controlledActorIds.has(encounterD20WindowRollerActorId(context))
      ? projectNativeD20WindowPending(occurrence, pendingSnapshot)
      : null
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
    // A Creature's controllers pick and roll its Legendary Action; its target rolls its saves.
    const actorId = turnPendingActorId(pendingSnapshot)
    if (actorId === null || !controlledActorIds.has(actorId)) return null
    return withEncounterRollModeReasons(ctx, row, membership, (reasons) =>
      projectNativeLegendaryPending({
        gameSystemId: row.gameSystemId,
        snapshot: pendingSnapshot,
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: row.version,
        reasons,
        // A player targets only the actors they can see.
        visibleActorIds:
          membership.role === 'OWNER'
            ? null
            : new Set(actors.filter((actor) => actor.public).map((actor) => actor.id))
      })
    )
  }
  if (context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING')
    return projectNativeCleavingPending(occurrence, pendingSnapshot, {
      isOwner: membership.role === 'OWNER',
      controlledActorIds,
      visibleActorIds: new Set(actors.filter((actor) => actor.public).map((actor) => actor.id))
    })
  if (
    context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' ||
    (context.kind === 'ENCOUNTER_CONTEST_CHECK' && contestCheckMovementContinuation(context))
  ) {
    const root =
      context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
        ? context.movement.root
        : context.kind === 'ENCOUNTER_CONTEST_CHECK'
          ? contestCheckMovementContinuation(context)?.root
          : context.root
    if (!root || root.encounterId !== row.id || root.commandId !== occurrence.rootCommandId)
      throw new Error('Stored Encounter occurrence root is invalid.')
    return withEncounterRollModeReasons(
      ctx,
      row,
      membership,
      (reasons) =>
        projectEncounterSpatialOccurrenceSummary(
          {
            id: occurrence.id,
            version: occurrence.version,
            state: occurrence.state,
            pendingSnapshot
          },
          row.version,
          { controlledActorIds, isOwner: membership.role === 'OWNER' },
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
  if (context.kind === 'ENCOUNTER_AREA_ACTION') {
    const pending = await readNativeAreaActionPending(ctx, occurrence)
    return withEncounterRollModeReasons(ctx, row, membership, (reasons) =>
      projectNativeAreaActionPending(
        occurrence,
        pending,
        {
          isOwner: membership.role === 'OWNER',
          controlledActorIds,
          actors
        },
        reasons
      )
    )
  }
  if (context.kind === 'ENCOUNTER_ACTION') {
    if (!(await canAnswerNativeActionEvidence(ctx, { run: row, campaign, membership, occurrence })))
      return null
    const pending = await readNativeActionPending(ctx, occurrence)
    return withEncounterRollModeReasons(ctx, row, membership, (reasons) =>
      projectNativeActionPending(occurrence, pending, membership.role === 'OWNER', reasons)
    )
  }
  if (
    context.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context.kind === 'ENCOUNTER_TURN_DEATH_SAVE' ||
    context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    context.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS'
  ) {
    // Turn-effect saves, death saves and Recharge dice go to their actor's controllers.
    const actorId = turnPendingActorId(pendingSnapshot)
    if (actorId === null || !controlledActorIds.has(actorId)) return null
    if (
      context.root.rootCommandId !== occurrence.rootCommandId ||
      context.root.expectedEncounterVersion !== row.version ||
      context.root.initiatorUserId !== campaign.ownerUserId
    )
      throw new Error('Stored Encounter turn root is invalid.')
    return withEncounterRollModeReasons(ctx, row, membership, (reasons) =>
      projectNativeTurnPending({
        gameSystemId: row.gameSystemId,
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
