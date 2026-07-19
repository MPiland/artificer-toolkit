import {
  actionDisplay,
  actionEmphasis,
  actionWidth,
  controlDensity,
  semanticSurfaceRoles,
  semanticTextStyles,
  semanticTextTones
} from '@artificer-toolkit/design-system'
import { z } from 'zod'

export const nodeRuntimePathSegmentDtoSchema = z.union([z.string(), z.number().int().nonnegative()])
export const nodeRuntimePathDtoSchema = z.array(nodeRuntimePathSegmentDtoSchema).readonly()

export const nodeRuntimeValuesDtoSchema = z.record(z.string(), z.unknown())

export const nodeRuntimeContextDtoSchema = z.strictObject({
  mapId: z.string().min(1),
  values: nodeRuntimeValuesDtoSchema.default({}),
  parentValues: nodeRuntimeValuesDtoSchema.optional(),
  ancestors: z.array(nodeRuntimeValuesDtoSchema).optional(),
  systemId: z.string().min(1)
})

export const nodeRuntimeResolveRequestDtoSchema = nodeRuntimeContextDtoSchema
export const nodeRuntimeNormalizeValuesRequestDtoSchema = nodeRuntimeContextDtoSchema

export const nodeRuntimeOptionDtoSchema = z.strictObject({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  group: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

const nodeRuntimeActionAppearanceBaseShape = {
  emphasis: z.enum(actionEmphasis),
  density: z.enum(controlDensity)
}

const nodeRuntimeActionAppearanceDtoSchema = z.discriminatedUnion('display', [
  z.strictObject({
    ...nodeRuntimeActionAppearanceBaseShape,
    display: z.literal(actionDisplay[0]),
    width: z.literal(actionWidth[0])
  }),
  z.strictObject({
    ...nodeRuntimeActionAppearanceBaseShape,
    display: z.enum([actionDisplay[1], actionDisplay[2]]),
    width: z.enum(actionWidth)
  })
])

const nodeRuntimeActionPresentationDtoSchema = z.strictObject({
  default: nodeRuntimeActionAppearanceDtoSchema,
  compact: nodeRuntimeActionAppearanceDtoSchema.optional(),
  wide: nodeRuntimeActionAppearanceDtoSchema.optional()
})

const nodeRuntimeTextAppearanceDtoSchema = z.strictObject({
  style: z.enum(semanticTextStyles),
  tone: z.enum(semanticTextTones)
})

const nodeRuntimeTextPresentationDtoSchema = z.strictObject({
  default: nodeRuntimeTextAppearanceDtoSchema,
  compact: nodeRuntimeTextAppearanceDtoSchema.optional(),
  wide: nodeRuntimeTextAppearanceDtoSchema.optional()
})

const nodeRuntimeSurfaceAppearanceDtoSchema = z.strictObject({
  role: z.enum(semanticSurfaceRoles)
})

const nodeRuntimeSurfacePresentationDtoSchema = z.strictObject({
  default: nodeRuntimeSurfaceAppearanceDtoSchema,
  compact: nodeRuntimeSurfaceAppearanceDtoSchema.optional(),
  wide: nodeRuntimeSurfaceAppearanceDtoSchema.optional()
})

const nodeRuntimeGroupAppearanceDtoSchema = z.strictObject({
  heading: nodeRuntimeTextPresentationDtoSchema.optional(),
  surface: nodeRuntimeSurfacePresentationDtoSchema.optional()
})

const nodeRuntimeActionBaseDtoSchema = z.strictObject({
  label: z.string().min(1),
  presentation: nodeRuntimeActionPresentationDtoSchema
})

const nodeRuntimeCollectionAddActionDtoSchema = nodeRuntimeActionBaseDtoSchema.extend({
  type: z.literal('collection.add')
})
const nodeRuntimeCollectionEditActionDtoSchema = nodeRuntimeActionBaseDtoSchema.extend({
  type: z.literal('collection.edit')
})
const nodeRuntimeCollectionDuplicateActionDtoSchema = nodeRuntimeActionBaseDtoSchema.extend({
  type: z.literal('collection.duplicate')
})
const nodeRuntimeCollectionRemoveActionDtoSchema = nodeRuntimeActionBaseDtoSchema.extend({
  type: z.literal('collection.remove')
})

export const nodeRuntimeCollectionActionDtoSchema = z.discriminatedUnion('type', [
  nodeRuntimeCollectionAddActionDtoSchema,
  nodeRuntimeCollectionEditActionDtoSchema,
  nodeRuntimeCollectionDuplicateActionDtoSchema,
  nodeRuntimeCollectionRemoveActionDtoSchema
])

const nodeRuntimeObjectActionDtoSchema = z.discriminatedUnion('type', [
  nodeRuntimeCollectionAddActionDtoSchema,
  nodeRuntimeCollectionRemoveActionDtoSchema
])

const nodeRuntimeCollectionOrderingDtoSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('derived') }),
  z.strictObject({
    mode: z.literal('manual'),
    identityPath: z.tuple([z.string().min(1)]).readonly(),
    orderPath: z.tuple([z.string().min(1)]).readonly().optional()
  })
])

function rejectDuplicateActionTypes(
  actions: readonly { type: string }[],
  context: z.RefinementCtx
): void {
  const seen = new Set<string>()
  actions.forEach((action, index) => {
    if (seen.has(action.type)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'type'],
        message: `Duplicate action type: ${action.type}`
      })
    }
    seen.add(action.type)
  })
}

export const nodeRuntimeCollectionAuthoringDtoSchema = z.strictObject({
  actions: z
    .array(nodeRuntimeCollectionActionDtoSchema)
    .superRefine(rejectDuplicateActionTypes)
    .readonly(),
  ordering: nodeRuntimeCollectionOrderingDtoSchema,
  itemLabel: z.string().min(1).optional(),
  emptyLabel: z.string().min(1).optional(),
  showHeading: z.boolean().optional(),
  join: z.enum(['AND', 'OR']).optional(),
  rowLayout: z.enum(['default', 'card', 'flat', 'compact']).optional(),
  rowExpansion: z.enum(['collapsible', 'expanded']).optional(),
  rowSummary: z
    .enum([
      'default',
      'facet-context',
      'facet-condition',
      'modifier',
      'effect',
      'effect-path',
      'outcome',
      'speed'
    ])
    .optional()
})

const nodeRuntimeInputAuthoringDtoSchema = z.strictObject({
  exposure: z.enum(['author', 'system'])
})

const nodeRuntimeObjectAuthoringDtoSchema = z.strictObject({
  exposure: z.enum(['author', 'system']),
  actions: z.array(nodeRuntimeObjectActionDtoSchema).superRefine(rejectDuplicateActionTypes).readonly(),
  appearance: nodeRuntimeGroupAppearanceDtoSchema.optional(),
  emptyLabel: z.string().min(1).optional()
})

export const nodeRuntimeAuthoringDtoSchema = z.strictObject({
  exposure: z.enum(['author', 'system']),
  appearance: nodeRuntimeGroupAppearanceDtoSchema.optional(),
  collection: nodeRuntimeCollectionAuthoringDtoSchema
})

const nodeRuntimeNodeBaseShape = {
  id: z.string().min(1),
  path: nodeRuntimePathDtoSchema,
  label: z.string().min(1),
  visible: z.boolean(),
  required: z.boolean(),
  hiddenBehavior: z.enum(['KEEP', 'CLEAR']),
  clearPaths: z.array(nodeRuntimePathDtoSchema)
}

const nodeRuntimeScalarInputDtoSchemas = [
  'TEXT',
  'NUMBER',
  'RICH_TEXT',
  'TOGGLE'
] as const

const scalarInputSchemas = nodeRuntimeScalarInputDtoSchemas.map((type) =>
  z.strictObject({
    ...nodeRuntimeNodeBaseShape,
    kind: z.literal('INPUT'),
    type: z.literal(type),
    authoring: nodeRuntimeInputAuthoringDtoSchema
  })
)

const selectInputSchemas = (['SELECT_SINGLE', 'SELECT_MULTI'] as const).map((type) =>
  z.strictObject({
    ...nodeRuntimeNodeBaseShape,
    kind: z.literal('INPUT'),
    type: z.literal(type),
    options: z.array(nodeRuntimeOptionDtoSchema),
    authoring: nodeRuntimeInputAuthoringDtoSchema
  })
)

const nodeRuntimeObjectGroupDtoSchema = z.strictObject({
  ...nodeRuntimeNodeBaseShape,
  kind: z.literal('GROUP'),
  groupKind: z.literal('OBJECT'),
  presentation: z.enum(['inline', 'branch']),
  childMapId: z.string().min(1),
  authoring: nodeRuntimeObjectAuthoringDtoSchema
})

const nodeRuntimeArrayGroupDtoSchema = z.strictObject({
  ...nodeRuntimeNodeBaseShape,
  kind: z.literal('GROUP'),
  groupKind: z.literal('ARRAY'),
  presentation: z.enum(['inline', 'table', 'summary', 'branch', 'focused']),
  childMapId: z.string().min(1),
  authoring: nodeRuntimeAuthoringDtoSchema
})

export const nodeRuntimeNodeDtoSchema = z.union([
  ...scalarInputSchemas,
  ...selectInputSchemas,
  nodeRuntimeObjectGroupDtoSchema,
  nodeRuntimeArrayGroupDtoSchema
])

export const nodeRuntimeSectionDtoSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  nodes: z.array(nodeRuntimeNodeDtoSchema)
})

export const nodeRuntimeStepDtoSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  order: z.number(),
  sections: z.array(nodeRuntimeSectionDtoSchema)
})

export const nodeRuntimeResolvedScopeDtoSchema = z.strictObject({
  mapId: z.string(),
  path: nodeRuntimePathDtoSchema,
  steps: z.array(nodeRuntimeStepDtoSchema),
  clearPaths: z.array(nodeRuntimePathDtoSchema)
})

export const nodeRuntimeResolveResponseDtoSchema = z.strictObject({
  mapId: z.string(),
  steps: z.array(nodeRuntimeStepDtoSchema),
  clearPaths: z.array(nodeRuntimePathDtoSchema),
  scopes: z.array(nodeRuntimeResolvedScopeDtoSchema)
})

export const nodeRuntimeNormalizeValuesResponseDtoSchema = z.strictObject({
  values: z.unknown(),
  clearedPaths: z.array(nodeRuntimePathDtoSchema)
})

export type NodeRuntimePathSegmentDto = z.infer<typeof nodeRuntimePathSegmentDtoSchema>
export type NodeRuntimePathDto = z.infer<typeof nodeRuntimePathDtoSchema>
export type NodeRuntimeValuesDto = z.infer<typeof nodeRuntimeValuesDtoSchema>
export type NodeRuntimeResolveRequestDto = z.infer<typeof nodeRuntimeResolveRequestDtoSchema>
export type NodeRuntimeNormalizeValuesRequestDto = z.infer<
  typeof nodeRuntimeNormalizeValuesRequestDtoSchema
>
export type NodeRuntimeOptionDto = z.infer<typeof nodeRuntimeOptionDtoSchema>
export type NodeRuntimeCollectionActionDto = z.infer<typeof nodeRuntimeCollectionActionDtoSchema>
export type NodeRuntimeObjectActionDto = z.infer<typeof nodeRuntimeObjectActionDtoSchema>
export type NodeRuntimeCollectionOrderingDto = z.infer<
  typeof nodeRuntimeCollectionOrderingDtoSchema
>
export type NodeRuntimeCollectionAuthoringDto = z.infer<
  typeof nodeRuntimeCollectionAuthoringDtoSchema
>
export type NodeRuntimeAuthoringDto = z.infer<typeof nodeRuntimeAuthoringDtoSchema>
export type NodeRuntimeNodeDto = z.infer<typeof nodeRuntimeNodeDtoSchema>
export type NodeRuntimeInputNodeDto = Extract<NodeRuntimeNodeDto, { kind: 'INPUT' }>
export type NodeRuntimeSelectInputNodeDto = Extract<
  NodeRuntimeInputNodeDto,
  { type: 'SELECT_SINGLE' | 'SELECT_MULTI' }
>
export type NodeRuntimeGroupNodeDto = Extract<NodeRuntimeNodeDto, { kind: 'GROUP' }>
export type NodeRuntimeObjectGroupNodeDto = Extract<
  NodeRuntimeGroupNodeDto,
  { groupKind: 'OBJECT' }
>
export type NodeRuntimeArrayGroupNodeDto = Extract<
  NodeRuntimeGroupNodeDto,
  { groupKind: 'ARRAY' }
>
export type NodeRuntimeSectionDto = z.infer<typeof nodeRuntimeSectionDtoSchema>
export type NodeRuntimeStepDto = z.infer<typeof nodeRuntimeStepDtoSchema>
export type NodeRuntimeResolvedScopeDto = z.infer<typeof nodeRuntimeResolvedScopeDtoSchema>
export type NodeRuntimeResolveResponseDto = z.infer<typeof nodeRuntimeResolveResponseDtoSchema>
export type NodeRuntimeNormalizeValuesResponseDto = z.infer<
  typeof nodeRuntimeNormalizeValuesResponseDtoSchema
>
