import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { removeRunActorControllers } from '@artificer-toolkit/encounter-persistence/actorControllers'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { encounterWriteTransaction } from './encounterPorts'
import { isRoomHeldRun } from '../liveSessions/authorityGuard'

/**
 * A departing member stops controlling every actor of the Campaign's open Runs, so rejoining later
 * grants nothing back. Completed Runs are read-only history and keep their lists. While the
 * Campaign's room holds an ACTIVE Run it owns the Run actors and reconciles them itself when it
 * reloads authorization (D74), so Convex writes none.
 */
export async function removeEncounterActorController(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  userId: string
): Promise<void> {
  for (const status of ['PREPARED', 'ACTIVE'] as const)
    for (const run of await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', status)
      )
      .collect())
      if (!(await isRoomHeldRun(ctx, run)))
        await removeRunActorControllers(
          encounterWriteTransaction(ctx),
          readRunState(run),
          (id) => id === userId
        )
}
