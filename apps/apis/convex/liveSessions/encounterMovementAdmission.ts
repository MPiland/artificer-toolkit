import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionMovementCaptureScope } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import { readLiveMovementAdmission as readSharedLiveMovementAdmission } from '@artificer-toolkit/encounter-persistence/liveMovementAdmission'
import type { QueryCtx } from '../_generated/server'
import { readGeometrySave } from '../scenes/geometryDocuments'
import { readSessionVisionScope } from '../scenes/sessionVisionDocuments'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/** Authorize raw movement reads against the staged Scene command and current Encounter. */
export async function readLiveMovementAdmission(
  ctx: QueryCtx,
  input: Pick<
    LiveSessionEncounterRulesInput,
    'campaignId' | 'authorityEpoch' | 'expectedUserId' | 'expectedRole'
  > & { movement: LiveSessionMovementCaptureScope }
) {
  return readSharedLiveMovementAdmission(encounterReadTransaction(ctx), input, {
    readGeometrySave: (saveId) => readGeometrySave(ctx, saveId),
    readSessionVisionScope: (scope, current) => readSessionVisionScope(ctx, scope, current),
    readLiveEntity: async (sceneId, tokenId) => {
      const row = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q.eq('sceneId', sceneId).eq('collection', 'tokens').eq('entityId', tokenId)
        )
        .unique()
      if (!row) return null
      const { _id, _creationTime, ...stored } = row
      return stored
    },
    readDefinitionToken: async (saveId, ordinal) => {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_ordinal', (q) =>
          q.eq('saveId', saveId).eq('value.collection', 'tokens').eq('ordinal', ordinal)
        )
        .unique()
      if (!row) return null
      const { _id, _creationTime, ...stored } = row
      return stored
    }
  })
}
