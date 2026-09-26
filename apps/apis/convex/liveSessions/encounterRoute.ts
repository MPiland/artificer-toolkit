import { v } from 'convex/values'
import {
  liveSessionEncounterRouteInputSchema,
  liveSessionEncounterRouteResponseSchema,
  type LiveSessionEncounterRouteResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalQuery } from '../_generated/server'
import { rejectDomain } from '../lib/domainRejections'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { readNativeEncounterOccurrenceOwner } from '../encounters/occurrenceOwner'
import { classifyRuleOccurrenceVoid, voidDeclineCommand } from '../encounters/occurrenceVoid'
import { readPendingRunDecision } from '../encounters/pendingReads'
import { requireLiveEncounterRun } from './encounterCommandAdmission'

/** Names the room planner for the current pending occurrence; players see only their own. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const route = internalQuery({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<LiveSessionEncounterRouteResponse> => {
    const { command, ...scope } = liveSessionEncounterRouteInputSchema.parse(args)
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
      (await readPendingRunDecision(ctx, run, campaign, membership))?.occurrenceId !== occurrenceId
    )
      throw new Error('Rule occurrence is unavailable.')
    const owner = await readNativeEncounterOccurrenceOwner(ctx, run, occurrenceId)
    if (command.type === 'VOID_RULE_OCCURRENCE') {
      const voided =
        membership.role === 'OWNER' && occurrence.pendingSnapshotJson !== null
          ? classifyRuleOccurrenceVoid(
              serverRuleExecutionPendingSnapshotDtoSchema.parse(
                JSON.parse(occurrence.pendingSnapshotJson)
              ).applicationContext
            )
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
})
