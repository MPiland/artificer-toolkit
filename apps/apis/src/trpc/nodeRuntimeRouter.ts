import { normalizeNodeRuntimeValues, resolveNodeRuntime } from '@artificer-toolkit/functions'
import {
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  nodeRuntimeResolveRequestDtoSchema,
  nodeRuntimeResolveResponseDtoSchema
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { withAuthenticatedDb } from './dbContext.js'

import { authenticatedProcedure, createTRPCRouter } from './procedures.js'

export const nodeRuntimeRouter = createTRPCRouter({
  resolve: authenticatedProcedure
    .input(nodeRuntimeResolveRequestDtoSchema)
    .output(nodeRuntimeResolveResponseDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db) => resolveNodeRuntime(db, input))
    ),

  normalizeValues: authenticatedProcedure
    .input(nodeRuntimeNormalizeValuesRequestDtoSchema)
    .output(nodeRuntimeNormalizeValuesResponseDtoSchema)
    .mutation(({ ctx, input }) =>
      withAuthenticatedDb(ctx, async (db) => normalizeNodeRuntimeValues(db, input))
    )
})
