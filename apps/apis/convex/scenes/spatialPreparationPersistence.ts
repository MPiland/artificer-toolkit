import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { readRunState } from '../encounters/documents'
import {
  assertGeometryReceiving,
  readGeometrySave,
  readSpatialPreparation
} from './geometryDocuments'
import { readSessionVisionScope } from './sessionVisionDocuments'

/**
 * Internal staged evidence only. The parent validates token control and publishes all gameplay state.
 * `value` is already parsed by the caller's contract; it is validated again as stored below.
 */
export async function persistSpatialPreparation(
  ctx: MutationCtx,
  saveId: string,
  value: SceneSpatialPreparation
) {
  const { row, save, header, userId } = await readGeometrySave(ctx, saveId)
  assertGeometryReceiving(save, header.version, userId)
  const checksum = checksumCanonicalJson(value)
  readSpatialPreparation({
    ...save,
    spatialPreparationJson: JSON.stringify(value),
    spatialPreparationChecksum: checksum
  })
  const { campaign } = await readSessionVisionScope(ctx, save.sessionVision!)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', value.encounterId))
    .unique()
  if (!run) throw new Error('Spatial preparation Encounter is unavailable.')
  const state = readRunState(run)
  if (
    state.status !== 'ACTIVE' ||
    state.version !== value.expectedEncounterVersion ||
    state.campaignId !== header.campaignId ||
    state.campaignId !== campaign.id ||
    state.gameSystemId !== save.sessionVision!.systemId
  )
    throw new Error('Spatial preparation Encounter scope is stale.')
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  if (!binding || binding.sceneId !== save.sceneId || binding.campaignId !== state.campaignId)
    throw new Error('Spatial preparation Scene binding is stale.')
  const prior = readSpatialPreparation(save)
  if (prior) {
    if (checksum !== save.spatialPreparationChecksum)
      throw new Error('Spatial preparation cannot replace previously frozen evidence.')
    return prior
  }
  if (save.fogSaves.length !== 0) throw new Error('Spatial preparation must precede fog staging.')
  await ctx.db.patch(row._id, {
    spatialPreparationJson: JSON.stringify(value),
    spatialPreparationChecksum: checksum
  })
  return value
}
