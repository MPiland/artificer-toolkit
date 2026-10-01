import type { SceneFogCommandResult } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredFogLayerSchema,
  sceneStoredFogSaveSchema
} from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { planSceneFogPublication } from '@artificer-toolkit/encounter-persistence/sceneFogPublication'
import { parseFogLayer } from './fogDocuments'
import { advanceLiveState } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import type { MutationCtx } from '../_generated/server'

export async function publishFogLayer(
  ctx: MutationCtx,
  save: ReturnType<typeof sceneStoredFogSaveSchema.parse>,
  header: SceneLiveStateHeader,
  state: ReturnType<typeof advanceLiveState>
): Promise<{
  patch: SceneFogCommandResult['patch']
  previousLayer: ReturnType<typeof sceneStoredFogLayerSchema.parse> | null
}> {
  const existingRow = await ctx.db
    .query('sceneFogLayers')
    .withIndex('by_sceneId_ownerUserId', (q) =>
      q.eq('sceneId', header.id).eq('ownerUserId', save.input.layer.ownerUserId)
    )
    .unique()
  const existing = existingRow ? parseFogLayer(existingRow, header.version) : null
  const { layer, patch, previousLayer } = planSceneFogPublication(save, header, state, existing)
  if (existingRow) await ctx.db.replace(existingRow._id, layer)
  else await ctx.db.insert('sceneFogLayers', layer)
  return {
    patch,
    previousLayer
  }
}
