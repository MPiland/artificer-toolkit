import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  readRunActors,
  readRunState,
  replaceRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { encounterReadTransaction, encounterWriteTransaction } from './encounterPorts'

/**
 * A departing member stops controlling every actor of the Campaign's open Runs, so rejoining later
 * grants nothing back. Completed Runs are read-only history and keep their lists. The Run version is
 * unchanged: the edit replaces no receipt, and the PLAY revision these writes advance fences any
 * Session-room plan prepared before it.
 */
export async function removeEncounterActorController(
  ctx: MutationCtx,
  campaign: Doc<'campaigns'>,
  userId: string
): Promise<void> {
  for (const status of ['PREPARED', 'ACTIVE'] as const) {
    const runs = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', status)
      )
      .collect()
    for (const run of runs)
      for (const actor of await readRunActors(encounterReadTransaction(ctx), readRunState(run)))
        if (actor.controllerUserIds.includes(userId))
          await replaceRunActor(
            encounterWriteTransaction(ctx),
            actor,
            encounterRunActorStateSchema.parse({
              ...actor,
              controllerUserIds: actor.controllerUserIds.filter((id) => id !== userId)
            })
          )
  }
}
