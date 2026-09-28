import { v } from 'convex/values'
import {
  liveSessionEncounterRouteInputSchema,
  liveSessionEncounterRouteResponseSchema,
  type LiveSessionEncounterRouteInput,
  type LiveSessionEncounterRouteResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readNativeEncounterOccurrenceOwner } from '@artificer-toolkit/encounter-persistence/occurrenceOwner'
import {
  classifyRuleOccurrenceVoid,
  voidDeclineCommand
} from '@artificer-toolkit/encounter-persistence/occurrenceVoid'
import { readPendingRunDecision } from '@artificer-toolkit/encounter-persistence/pendingReads'
import { readStoredPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { requireLiveEncounterRun } from './encounterCommandAdmission'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/**
 * Names the room planner for the current pending occurrence; players see only their own. The
 * movement stage routes a decision the room holds with this same classification (D52).
 */
export async function routeEncounterDecision(
  ctx: QueryCtx,
  { command, ...scope }: LiveSessionEncounterRouteInput
): Promise<LiveSessionEncounterRouteResponse> {
  const { campaign, membership, run } = await requireLiveEncounterRun(ctx, {
    ...scope,
    encounterId: command.encounterId
  })
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .take(2)
  const occurrence = pending[0]
  const occurrenceId = command.occurrenceId.toLowerCase()
  // The client answered an occurrence that is no longer the pending one.
  if (pending.length !== 1 || occurrence?.id !== occurrenceId)
    rejectDomain('VERSION_STALE', 'Rule occurrence is unavailable.')
  if (
    membership.role !== 'OWNER' &&
    (await readPendingRunDecision(encounterReadTransaction(ctx), run, campaign, membership))
      ?.occurrenceId !== occurrenceId
  )
    rejectDomain('NOT_ACTOR_CONTROLLER', "This decision isn't yours to answer.")
  const owner = await readNativeEncounterOccurrenceOwner(ctx, run, occurrenceId)
  if (command.type === 'VOID_RULE_OCCURRENCE') {
    const voided =
      membership.role === 'OWNER' && occurrence.pendingSnapshotJson !== null
        ? classifyRuleOccurrenceVoid(readStoredPendingSnapshot(occurrence)!.applicationContext)
        : null
    // A GM void that declines a decision settles through the room like the GM's decline (D26);
    // Convex records every other void, refusing a player's.
    if (voided?.kind === 'DECLINE' && owner === 'MOVEMENT')
      return liveSessionEncounterRouteResponseSchema.parse({ route: 'MOVEMENT', decline: null })
    if (voided?.kind === 'DECLINE' && (owner === 'TURN' || owner === 'CLEAVING')) {
      if (
        run.version !== command.expectedVersion ||
        occurrence.version !== command.expectedOccurrenceVersion
      )
        rejectDomain('VERSION_STALE')
      return liveSessionEncounterRouteResponseSchema.parse({
        route: owner,
        decline: voidDeclineCommand(command, occurrence, voided.resolution)
      })
    }
    return liveSessionEncounterRouteResponseSchema.parse({ route: 'VOID', decline: null })
  }
  // Every decision the Encounter can pause on has a room planner; anything else is refused.
  if (owner === 'OTHER') throw new Error('Rule occurrence is unavailable.')
  return liveSessionEncounterRouteResponseSchema.parse({ route: owner, decline: null })
}

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const route = internalQuery({
  args: v.any(),
  handler: (ctx, args: unknown): Promise<LiveSessionEncounterRouteResponse> =>
    routeEncounterDecision(ctx, liveSessionEncounterRouteInputSchema.parse(args))
})
