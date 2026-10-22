import { queryOptions } from '@tanstack/react-query'
import type { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  saveSceneLootInputSchema,
  sceneLootDocumentSchema,
  sceneLootLookupInputSchema,
  type SaveSceneLootInput
} from '@artificer-toolkit/schema/api/sceneLootTables'
import { queryKeys } from '#app/lib/queryKeys'

export function getSceneLoot(campaignId: string, sceneId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.campaigns.sceneLoot(campaignId, sceneId),
    queryFn: async () =>
      sceneLootDocumentSchema.parse(
        await client.query(
          api.scenes.lootTables.get,
          sceneLootLookupInputSchema.parse({ campaignId, sceneId })
        )
      )
  })
}

export async function saveSceneLoot(client: ConvexReactClient, input: SaveSceneLootInput) {
  return sceneLootDocumentSchema.parse(
    await client.mutation(api.scenes.lootTables.save, saveSceneLootInputSchema.parse(input))
  )
}
