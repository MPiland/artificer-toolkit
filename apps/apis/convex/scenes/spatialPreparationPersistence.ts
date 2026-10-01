import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readGeometrySave } from './geometryDocuments'
import { assertGeometryReceiving, readSpatialPreparation } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { readSessionVisionScope } from './sessionVisionDocuments'
import { beforeWrite } from '@artificer-toolkit/encounter-persistence/transactionReads'

/**
 * Internal staged evidence only. The parent validates token control and publishes all gameplay state.
 * `value` is already parsed by the caller's contract; it is validated again as stored below.
 * Returns the stored preparation and its checksum.
 */
export async function persistSpatialPreparation(
  ctx: MutationCtx,
  saveId: string,
  value: SceneSpatialPreparation
) {
  const { row, save, header, userId } = await readGeometrySave(ctx, saveId)
  assertGeometryReceiving(save, header.version, userId)
  const stored = {
    spatialPreparationJson: JSON.stringify(value),
    spatialPreparationChecksum: checksumCanonicalJson(value)
  }
  // Verified as it will be stored; the transaction's re-read of the same content reuses this.
  readSpatialPreparation(beforeWrite(ctx.db, { ...save, ...stored }))
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
  const checksum = stored.spatialPreparationChecksum
  if (prior) {
    if (checksum !== save.spatialPreparationChecksum)
      throw new Error('Spatial preparation cannot replace previously frozen evidence.')
    return { preparation: prior, checksum }
  }
  if (save.fogSaves.length !== 0) throw new Error('Spatial preparation must precede fog staging.')
  await ctx.db.patch(row._id, stored)
  return { preparation: value, checksum }
}
