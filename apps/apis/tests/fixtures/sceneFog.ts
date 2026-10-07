import type { SceneFogChunksPage } from '@artificer-toolkit/schema/api/sceneFog'
import type { TestConvex } from 'convex-test'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import type schema from '../../convex/schema'
import { api } from '../../convex/_generated/api'
import { checkpointLiveRoom, type RoomCaller } from './localRoomWorker'

/**
 * The fog the real room committed for the Campaign owner, as Convex holds it once the room
 * checkpoints (the room's move result carries no fog patches to read). Shaped for
 * `isScenePointExplored`.
 */
export async function readOwnerFog(
  base: {
    t: TestConvex<typeof schema>
    campaign: { id: string }
    owner: { caller: RoomCaller; userId: string }
  },
  sceneId: string,
  settings: Pick<CampaignSceneState, 'map' | 'fogMode'>
) {
  await checkpointLiveRoom(base.campaign.id)
  const head = (await base.t.run((ctx) => ctx.db.query('sceneLiveStates').collect())).find(
    (row) => row.sceneId === sceneId
  )
  if (!head) throw new Error('Missing Scene live state.')
  const chunks: SceneFogChunksPage['page'] = []
  let page: SceneFogChunksPage
  let offset = 0
  do {
    page = await base.owner.caller.query(api.scenes.fogReads.chunks, {
      sceneId,
      ownerUserId: base.owner.userId,
      expectedVersion: head.version,
      offset,
      numItems: 8
    })
    chunks.push(...page.page)
    offset = page.nextOffset
  } while (!page.isDone)
  return {
    map: settings.map,
    fogMode: settings.fogMode,
    fogLayers: [{ ownerUserId: base.owner.userId, width: page.width, height: page.height, chunks }]
  }
}
