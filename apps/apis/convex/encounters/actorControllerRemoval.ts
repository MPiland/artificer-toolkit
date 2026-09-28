import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readRunProjection, readRunState } from '@artificer-toolkit/encounter-persistence/documents'

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
    for (const run of runs) {
      const state = readRunState(run)
      const projection = readRunProjection(run)
      if (!projection.actors.some((actor) => actor.controllerUserIds.includes(userId))) continue
      for (const actorId of state.actorIds) {
        const row = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actorId))
          .unique()
        if (!row) throw new Error('Encounter actor was not found.')
        const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
        if (!actor.controllerUserIds.includes(userId)) continue
        const next = encounterRunActorStateSchema.parse({
          ...actor,
          controllerUserIds: actor.controllerUserIds.filter((id) => id !== userId)
        })
        await ctx.db.patch(row._id, {
          stateJson: JSON.stringify(next),
          stateChecksum: checksumCanonicalJson(next)
        })
      }
      const nextProjection = encounterGmProjectionDtoSchema.parse({
        ...projection,
        actors: projection.actors.map((actor) => ({
          ...actor,
          controllerUserIds: actor.controllerUserIds.filter((id) => id !== userId)
        }))
      })
      await ctx.db.patch(run._id, {
        projectionJson: JSON.stringify(nextProjection),
        projectionChecksum: checksumCanonicalJson(nextProjection)
      })
    }
  }
}
