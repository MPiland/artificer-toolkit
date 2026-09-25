import { v } from 'convex/values'
import {
  liveSessionEncounterRouteInputSchema,
  liveSessionEncounterRouteResponseSchema,
  type LiveSessionEncounterRoute
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalQuery } from '../_generated/server'
import { readNativeEncounterOccurrenceOwner } from '../encounters/occurrenceOwner'
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
    if (pending.length !== 1 || pending[0]!.id !== occurrenceId)
      throw new Error('Rule occurrence is unavailable.')
    if (
      membership.role !== 'OWNER' &&
      (await readPendingRunDecision(ctx, run, campaign, membership))?.occurrenceId !== occurrenceId
    )
      throw new Error('Rule occurrence is unavailable.')
    const owner = await readNativeEncounterOccurrenceOwner(ctx, run, occurrenceId)
    return liveSessionEncounterRouteResponseSchema.parse({
      route: owner === 'DISARM' || owner === 'CLEAVING' || owner === 'OTHER' ? 'NATIVE' : owner
    })
  }
})
