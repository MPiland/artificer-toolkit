import { v } from 'convex/values'
import {
  liveSessionEncounterRouteInputSchema,
  liveSessionEncounterRouteResponseSchema,
  type LiveSessionEncounterRoute
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalQuery } from '../_generated/server'
import { rejectDomain } from '../lib/domainRejections'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { readNativeEncounterOccurrenceOwner } from '../encounters/occurrenceOwner'
import { classifyRuleOccurrenceVoid } from '../encounters/occurrenceVoid'
import { readPendingRunDecision } from '../encounters/pendingReads'
import { requireLiveEncounterRun } from './encounterCommandAdmission'

/** Names the room planner for the current pending occurrence; players see only their own. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const route = internalQuery({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<{ route: LiveSessionEncounterRoute }> => {
    const input = liveSessionEncounterRouteInputSchema.parse(args)
    const { campaign, membership, run } = await requireLiveEncounterRun(ctx, input)
    const pending = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
      .take(2)
    const occurrenceId = input.occurrenceId.toLowerCase()
    // The client answered an occurrence that is no longer the pending one.
    if (pending.length !== 1 || pending[0]!.id !== occurrenceId)
      rejectDomain('VERSION_STALE', 'Rule occurrence is unavailable.')
    if (
      membership.role !== 'OWNER' &&
      (await readPendingRunDecision(ctx, run, campaign, membership))?.occurrenceId !== occurrenceId
    )
      throw new Error('Rule occurrence is unavailable.')
    const owner = await readNativeEncounterOccurrenceOwner(ctx, run, occurrenceId)
    if (input.commandType === 'VOID_RULE_OCCURRENCE') {
      // A GM void that declines a movement decision settles through the room (D26); the native
      // void refuses everything else, including a player's void.
      const snapshot = pending[0]!.pendingSnapshotJson
      const declines =
        owner === 'MOVEMENT' &&
        membership.role === 'OWNER' &&
        snapshot !== null &&
        classifyRuleOccurrenceVoid(
          serverRuleExecutionPendingSnapshotDtoSchema.parse(JSON.parse(snapshot)).applicationContext
        ).kind === 'DECLINE'
      return liveSessionEncounterRouteResponseSchema.parse({
        route: declines ? 'MOVEMENT' : 'NATIVE'
      })
    }
    return liveSessionEncounterRouteResponseSchema.parse({
      route: owner === 'DISARM' || owner === 'CLEAVING' || owner === 'OTHER' ? 'NATIVE' : owner
    })
  }
})
