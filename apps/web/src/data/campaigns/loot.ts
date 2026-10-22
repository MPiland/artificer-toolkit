import { queryOptions } from '@tanstack/react-query'
import type { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  saveLootInputSchema,
  lootDocumentSchema,
  lootLookupInputSchema,
  type LootOwner,
  type SaveLootInput
} from '@artificer-toolkit/schema/api/lootTables'
import { queryKeys } from '#app/lib/queryKeys'

export function getLoot(owner: LootOwner, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.campaigns.loot(owner),
    queryFn: async () =>
      lootDocumentSchema.parse(
        await client.query(api.loot.tables.get, lootLookupInputSchema.parse({ owner }))
      )
  })
}

export async function saveLoot(client: ConvexReactClient, input: SaveLootInput) {
  return lootDocumentSchema.parse(
    await client.mutation(api.loot.tables.save, saveLootInputSchema.parse(input))
  )
}
