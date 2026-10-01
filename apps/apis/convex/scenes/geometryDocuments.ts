import type { SceneStoredGeometrySave } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import type { QueryCtx } from '../_generated/server'
import { deriveOnce } from '@artificer-toolkit/encounter-persistence/transactionReads'
import {
  parseGeometrySave,
  assertStandaloneMovement as assertSharedStandaloneMovement
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readLiveScene } from './liveDocuments'
import { readPresentedVisionScene } from './sessionVisionDocuments'

export async function readGeometrySave(ctx: QueryCtx, saveId: string) {
  const row = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_publicId', (q) => q.eq('id', saveId.toLowerCase()))
    .unique()
  if (!row) throw new Error('Scene geometry save is unavailable.')
  // Parsed once per stored save in a memoized transaction (`deriveOnce`).
  const save = deriveOnce(row, parseGeometrySave)
  // Only the save's own actor may continue it; a player's door save exists only through the room.
  const scene = await readLiveScene(
    ctx,
    row.sceneId,
    save.input.type === 'MOVE_SCENE_TOKEN' || save.input.type === 'SET_SCENE_DOOR_STATE'
      ? 'MEMBER'
      : 'OWNER'
  )
  if (scene.campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  let presented: Awaited<ReturnType<typeof readPresentedVisionScene>> | null = null
  if (save.sessionVision) {
    if (
      save.sessionVision.campaignId !== scene.campaign.id ||
      save.sessionVision.systemId !== scene.campaign.gameSystemId
    )
      throw new Error('Stored Scene geometry presentation identity is inconsistent.')
    presented = await readPresentedVisionScene(ctx, save.sessionVision)
  }
  return { ...scene, presented, row, save }
}

/** Check again at publication: a binding may be installed after an unbound move was staged. */
export async function assertStandaloneMovement(
  ctx: QueryCtx,
  campaignId: string,
  input: SceneStoredGeometrySave['input']
) {
  return assertSharedStandaloneMovement(
    { db: createConvexEncounterStoreReader(ctx) },
    campaignId,
    input
  )
}
