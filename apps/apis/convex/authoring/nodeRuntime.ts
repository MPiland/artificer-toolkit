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
    // T24-DIAG start
    console.time('t24 identity')
    const identity = await requireIdentity(ctx)
    console.timeEnd('t24 identity')
    console.time('t24 parseArgs')
    const input = nodeRuntimeResolveRequestDtoSchema.parse(args)
    console.timeEnd('t24 parseArgs')
    console.time('t24 reader')
    const reader = await createSystemSourceReader(ctx, input.systemId, identity.userId)
    console.timeEnd('t24 reader')
    const tables: string[] = []
    const timed: typeof reader = async (...query) => {
      const label = `t24 read ${query[0]} ${tables.length}`
      tables.push(String(query[0]))
      console.time(label)
      const rows = await reader(...query)
      console.timeEnd(label)
      return rows
    }
    console.time('t24 resolve')
    const full = await resolveNodeRuntime(timed, input)
    console.timeEnd('t24 resolve')
    console.time('t24 compact')
    const compact = compactNodeRuntimeResponse(full)
    console.timeEnd('t24 compact')
    console.log(
      't24 sizes',
      JSON.stringify(args).length,
      JSON.stringify(compact.nodes).length,
      JSON.stringify(compact.models).length,
      JSON.stringify(compact.scopes).length,
      JSON.stringify(compact.steps).length
    )
    return compact
    // T24-DIAG end
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
