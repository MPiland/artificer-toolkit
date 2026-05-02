import { z } from 'zod'

export const nodeRuntimePathSegmentDtoSchema = z.union([z.string(), z.number().int().nonnegative()])
export const nodeRuntimePathDtoSchema = z.array(nodeRuntimePathSegmentDtoSchema).readonly()

export const nodeRuntimeValuesDtoSchema = z.record(z.string(), z.unknown())

export const nodeRuntimeContextDtoSchema = z.object({
  mapId: z.string().min(1),
  values: nodeRuntimeValuesDtoSchema.default({}),
  parentValues: nodeRuntimeValuesDtoSchema.optional(),
  ancestors: z.array(nodeRuntimeValuesDtoSchema).optional(),
  systemId: z.string().optional()
})

export const nodeRuntimeResolveRequestDtoSchema = nodeRuntimeContextDtoSchema
export const nodeRuntimeNormalizeValuesRequestDtoSchema = nodeRuntimeContextDtoSchema

export const nodeRuntimeOptionDtoSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  group: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export const nodeRuntimeNodeDtoSchema = z.object({
  id: z.string(),
  path: nodeRuntimePathDtoSchema,
  label: z.string(),
  kind: z.enum(['INPUT', 'GROUP']),
  type: z.enum(['TEXT', 'NUMBER', 'RICH_TEXT', 'SELECT_SINGLE', 'SELECT_MULTI']).optional(),
  groupKind: z.enum(['OBJECT', 'ARRAY']).optional(),
  childMapId: z.string().optional(),
  visible: z.boolean(),
  required: z.boolean(),
  hiddenBehavior: z.enum(['KEEP', 'CLEAR']).optional(),
  clearPaths: z.array(nodeRuntimePathDtoSchema).default([]),
  disabled: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  options: z.array(nodeRuntimeOptionDtoSchema).optional()
})

export const nodeRuntimeSectionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  nodes: z.array(nodeRuntimeNodeDtoSchema)
})

export const nodeRuntimeStepDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  sections: z.array(nodeRuntimeSectionDtoSchema)
})

export const nodeRuntimeResolveResponseDtoSchema = z.object({
  mapId: z.string(),
  steps: z.array(nodeRuntimeStepDtoSchema),
  clearPaths: z.array(nodeRuntimePathDtoSchema)
})

export const nodeRuntimeNormalizeValuesResponseDtoSchema = z.object({
  values: z.unknown(),
  clearedPaths: z.array(nodeRuntimePathDtoSchema)
})

export type NodeRuntimePathSegmentDto = z.infer<typeof nodeRuntimePathSegmentDtoSchema>
export type NodeRuntimePathDto = z.infer<typeof nodeRuntimePathDtoSchema>
export type NodeRuntimeValuesDto = z.infer<typeof nodeRuntimeValuesDtoSchema>
export type NodeRuntimeResolveRequestDto = z.infer<typeof nodeRuntimeResolveRequestDtoSchema>
export type NodeRuntimeNormalizeValuesRequestDto = z.infer<typeof nodeRuntimeNormalizeValuesRequestDtoSchema>
export type NodeRuntimeOptionDto = z.infer<typeof nodeRuntimeOptionDtoSchema>
export type NodeRuntimeNodeDto = z.infer<typeof nodeRuntimeNodeDtoSchema>
export type NodeRuntimeSectionDto = z.infer<typeof nodeRuntimeSectionDtoSchema>
export type NodeRuntimeStepDto = z.infer<typeof nodeRuntimeStepDtoSchema>
export type NodeRuntimeResolveResponseDto = z.infer<typeof nodeRuntimeResolveResponseDtoSchema>
export type NodeRuntimeNormalizeValuesResponseDto = z.infer<typeof nodeRuntimeNormalizeValuesResponseDtoSchema>
