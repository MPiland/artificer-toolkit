import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneFogChunksPageInputSchema,
  sceneFogChunksPageSchema,
  sceneFogLayersPageInputSchema,
  sceneFogLayersPageSchema
} from '@artificer-toolkit/schema/api/sceneFog'
import { internalQuery } from '../_generated/server'
import { readFogChunks, readFogLayers } from './fogReadDocuments'

export const layers = internalQuery({
  args: zodToConvexFields(sceneFogLayersPageInputSchema.shape),
  returns: zodToConvex(sceneFogLayersPageSchema),
  handler: async (ctx, args) =>
    readFogLayers(ctx, sceneFogLayersPageInputSchema.parse(args), 'TRANSIENT_HOST')
})

export const chunks = internalQuery({
  args: zodToConvexFields(sceneFogChunksPageInputSchema.shape),
  returns: zodToConvex(sceneFogChunksPageSchema),
  handler: async (ctx, args) =>
    readFogChunks(ctx, sceneFogChunksPageInputSchema.parse(args), 'TRANSIENT_HOST')
})
