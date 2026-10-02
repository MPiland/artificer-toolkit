import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema,
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema
} from '@artificer-toolkit/schema/api/sceneFog'
import { query } from '../lib/queries'
import { readFogChunks, readFogLayers } from './fogReadDocuments'

export const layers = query({
  args: zodToConvexFields(sceneFogLayersPageInputSchema.shape),
  returns: zodToConvex(sceneFogLayersPageSchema),
  handler: async (ctx, args) => {
    return readFogLayers(ctx, sceneFogLayersPageInputSchema.parse(args), 'RECIPIENT')
  }
})

export const chunks = query({
  args: zodToConvexFields(sceneFogChunksPageInputSchema.shape),
  returns: zodToConvex(sceneFogChunksPageSchema),
  handler: async (ctx, args) => {
    return readFogChunks(ctx, sceneFogChunksPageInputSchema.parse(args), 'RECIPIENT')
  }
})
