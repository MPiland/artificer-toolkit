import { z } from '../zod.js'
import {
  nodeRuntimePathDtoSchema,
  nodeRuntimeResolvedScopeDtoSchema,
  nodeRuntimeResolveResponseDtoSchema,
  type NodeRuntimeResolveResponseDto
} from './nodeRuntime.js'

const nodeRuntimeCompactModelDtoSchema = z.strictObject(
  z.omit(nodeRuntimeResolvedScopeDtoSchema, { path: true }).shape
)

const nodeRuntimeCompactScopeDtoSchema = z.strictObject({
  path: nodeRuntimePathDtoSchema,
  modelIndex: z.number().check(z.int()).check(z.nonnegative())
})

export const nodeRuntimeCompactResolveResponseDtoSchema = z
  .extend(
    z.pick(nodeRuntimeResolveResponseDtoSchema, { mapId: true, steps: true, clearPaths: true }),
    {
      models: z.array(nodeRuntimeCompactModelDtoSchema),
      scopes: z.array(nodeRuntimeCompactScopeDtoSchema)
    }
  )
  .check(
    z.superRefine((response, context) => {
      response.scopes.forEach((scope, index) => {
        if (scope.modelIndex >= response.models.length) {
          context.addIssue({
            code: 'custom',
            message: 'Scope modelIndex must refer to a response model.',
            path: ['scopes', index, 'modelIndex']
          })
        }
      })
    })
  )

export type NodeRuntimeCompactResolveResponseDto = z.infer<
  typeof nodeRuntimeCompactResolveResponseDtoSchema
>

export function compactNodeRuntimeResponse(
  response: NodeRuntimeResolveResponseDto
): NodeRuntimeCompactResolveResponseDto {
  const models: NodeRuntimeCompactResolveResponseDto['models'] = []
  const modelIndexes = new Map<string, number>()
  const scopes = response.scopes.map((scope) => {
    const { path, ...model } = scope
    const key = JSON.stringify(model)
    let modelIndex = modelIndexes.get(key)

    if (modelIndex === undefined) {
      modelIndex = models.length
      modelIndexes.set(key, modelIndex)
      models.push(model)
    }

    return { path, modelIndex }
  })

  return {
    mapId: response.mapId,
    steps: response.steps,
    clearPaths: response.clearPaths,
    models,
    scopes
  }
}

export function expandNodeRuntimeResponse(input: unknown): NodeRuntimeResolveResponseDto {
  const response = nodeRuntimeCompactResolveResponseDtoSchema.parse(input)

  return {
    mapId: response.mapId,
    steps: response.steps,
    clearPaths: response.clearPaths,
    scopes: response.scopes.map((scope) => {
      const model = response.models[scope.modelIndex]
      if (!model) throw new Error('Scope modelIndex must refer to a response model.')
      return { ...structuredClone(model), path: structuredClone(scope.path) }
    })
  }
}
