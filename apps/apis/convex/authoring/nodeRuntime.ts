import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  normalizeNodeRuntimeValues,
  resolveNodeRuntime
} from '@artificer-toolkit/authoring/nodeRuntime'
import {
  nodeRuntimeResolveRequestDtoSchema,
  nodeRuntimeNormalizeValuesRequestDtoSchema,
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  type NodeRuntimeNormalizeValuesResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  compactNodeRuntimeResponse,
  nodeRuntimeCompactResolveResponseDtoSchema,
  type NodeRuntimeCompactResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { createSystemSourceReader } from './systemSources'

export const resolve = query({
  args: zodToConvexFields(nodeRuntimeResolveRequestDtoSchema.shape),
  get returns(): Validator<NodeRuntimeCompactResolveResponseDto, 'required', string> {
    return zodToConvex<z.core.$ZodType<NodeRuntimeCompactResolveResponseDto>>(
      nodeRuntimeCompactResolveResponseDtoSchema
    )
  },
  handler: async (ctx, args): Promise<NodeRuntimeCompactResolveResponseDto> => {
    const identity = await requireIdentity(ctx)
    const input = nodeRuntimeResolveRequestDtoSchema.parse(args)
    const reader = await createSystemSourceReader(ctx, input.systemId, identity.userId)
    // The compact transport is JSON-clean and checked by `returns`, so it crosses as built.
    return compactNodeRuntimeResponse(await resolveNodeRuntime(reader, input))
  }
})

// Pure normalization is a query: it neither saves a draft nor authorizes publication.
export const normalizeValues = query({
  args: zodToConvexFields(nodeRuntimeNormalizeValuesRequestDtoSchema.shape),
  returns: zodToConvex(nodeRuntimeNormalizeValuesResponseDtoSchema),
  handler: async (ctx, args): Promise<NodeRuntimeNormalizeValuesResponseDto> => {
    const identity = await requireIdentity(ctx)
    const input = nodeRuntimeNormalizeValuesRequestDtoSchema.parse(args)
    const reader = await createSystemSourceReader(ctx, input.systemId, identity.userId)
    const result = await normalizeNodeRuntimeValues(reader, input)
    return nodeRuntimeNormalizeValuesResponseDtoSchema.parse(JSON.parse(JSON.stringify(result)))
  }
})
