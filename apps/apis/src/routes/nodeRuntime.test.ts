import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NodeRuntimeNormalizeValuesRequestDto,
  NodeRuntimeNormalizeValuesResponseDto,
  NodeRuntimeResolveRequestDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'

type SchemaResult<TBody> =
  | { success: true, data: TBody }
  | { success: false, error: { issues: unknown } }

type RouteSchema<TBody> = {
  safeParse(value: unknown): SchemaResult<TBody>
}

type RouteHandler<TBody, TResult> = (
  db: Record<string, never>,
  body: TBody,
  userId: string
) => Promise<TResult>

const functionsMock = vi.hoisted(() => ({
  resolveNodeRuntime: vi.fn(async (
    _db: Record<string, never>,
    request: NodeRuntimeResolveRequestDto
  ): Promise<NodeRuntimeResolveResponseDto> => ({
    mapId: request.mapId,
    clearPaths: [],
    steps: [{
      id: 'basics',
      label: 'Basics',
      order: 10,
      sections: [{
        id: 'basics',
        label: 'Basics',
        order: 10,
        nodes: [{
          id: 'label',
          path: ['label'],
          label: 'Name',
          kind: 'INPUT',
          type: 'TEXT',
          visible: true,
          required: false,
          clearPaths: []
        }]
      }]
    }]
  })),
  normalizeNodeRuntimeValues: vi.fn(async (
    _db: Record<string, never>,
    request: NodeRuntimeNormalizeValuesRequestDto
  ): Promise<NodeRuntimeNormalizeValuesResponseDto> => ({
    values: request.values,
    clearedPaths: []
  }))
}))

vi.mock('@artificer-toolkit/functions', () => ({
  handleAuthoringRequest: <TBody, TResult>(
    schema: RouteSchema<TBody>,
    handler: RouteHandler<TBody, TResult>
  ) => {
    if (typeof schema?.safeParse !== 'function') {
      throw new Error('Node runtime routes must use the schema validation overload.')
    }

    return async (request: Request): Promise<Response> => {
      try {
        const raw: unknown = await request.json()
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
          return Response.json(
            { error: 'Validation failed', issues: parsed.error.issues },
            { status: 422 }
          )
        }

        return Response.json(await handler({}, parsed.data, 'test-user-id'))
      } catch (error) {
        if (error instanceof Error && error.name === 'NodeRuntimeInputError') {
          return Response.json({ error: error.message }, { status: 400 })
        }

        return new Response('Internal Server Error', { status: 500 })
      }
    }
  },
  normalizeNodeRuntimeValues: functionsMock.normalizeNodeRuntimeValues,
  resolveNodeRuntime: functionsMock.resolveNodeRuntime
}))

describe('node runtime REST route handlers', () => {
  beforeEach(() => {
    functionsMock.resolveNodeRuntime.mockClear()
    functionsMock.normalizeNodeRuntimeValues.mockClear()
  })

  it('resolves valid runtime requests through the functions service', async () => {
    const { resolveNodeMapRuntime } = await import('./nodeRuntime.js')

    const response = await resolveNodeMapRuntime(jsonRequest({
      mapId: 'spell',
      values: { label: 'Fire Lace' }
    }))
    const body = await response.json() as NodeRuntimeResolveResponseDto

    expect(response.status).toBe(200)
    expect(body.mapId).toBe('spell')
    expect(functionsMock.resolveNodeRuntime).toHaveBeenCalledTimes(1)
  })

  it('returns 422 for invalid runtime resolve request bodies', async () => {
    const { resolveNodeMapRuntime } = await import('./nodeRuntime.js')

    const response = await resolveNodeMapRuntime(jsonRequest({
      values: { label: 'Missing map id' }
    }))

    expect(response.status).toBe(422)
    expect(functionsMock.resolveNodeRuntime).not.toHaveBeenCalled()
  })

  it('normalizes valid runtime values through the functions service', async () => {
    const { normalizeNodeMapRuntimeValues } = await import('./nodeRuntime.js')

    const response = await normalizeNodeMapRuntimeValues(jsonRequest({
      mapId: 'spell',
      values: { label: 'Fire Lace' }
    }))
    const body = await response.json() as NodeRuntimeNormalizeValuesResponseDto

    expect(response.status).toBe(200)
    expect(body.values).toEqual({ label: 'Fire Lace' })
    expect(functionsMock.normalizeNodeRuntimeValues).toHaveBeenCalledTimes(1)
  })

  it('returns 422 for invalid normalize request bodies', async () => {
    const { normalizeNodeMapRuntimeValues } = await import('./nodeRuntime.js')

    const response = await normalizeNodeMapRuntimeValues(jsonRequest({
      values: { label: 'Missing map id' }
    }))

    expect(response.status).toBe(422)
    expect(functionsMock.normalizeNodeRuntimeValues).not.toHaveBeenCalled()
  })

  it('returns 400 when the trusted resolver rejects runtime input', async () => {
    const { resolveNodeMapRuntime } = await import('./nodeRuntime.js')
    const error = new Error('Unknown node map: nope')
    error.name = 'NodeRuntimeInputError'
    functionsMock.resolveNodeRuntime.mockRejectedValueOnce(error)

    const response = await resolveNodeMapRuntime(jsonRequest({
      mapId: 'nope',
      values: {}
    }))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toBe('Unknown node map: nope')
  })
})

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/node-runtime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
