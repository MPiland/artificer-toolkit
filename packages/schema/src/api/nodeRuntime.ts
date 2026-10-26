import {
  actionDisplay,
  actionEmphasis,
  actionWidth,
  controlDensity,
  semanticSurfaceRoles,
  semanticTextStyles,
  semanticTextTones
} from '@artificer-toolkit/design-system'
import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { AUTHORED_LIMITS } from '../shared/authoredLimits.js'

export const nodeRuntimePathSegmentDtoSchema = lazySchema(() =>
  z.union([z.string(), z.number().check(z.int()).check(z.nonnegative())])
)
export const nodeRuntimePathDtoSchema = lazySchema(() =>
  z.readonly(z.array(nodeRuntimePathSegmentDtoSchema))
)

export const nodeRuntimeValuesDtoSchema = lazySchema(() => z.record(z.string(), z.unknown()))

export const nodeRuntimeContextDtoSchema = lazySchema(() =>
  z
    .strictObject({
      mapId: z.string().check(z.minLength(1)),
      values: z._default(nodeRuntimeValuesDtoSchema, {}),
      parentValues: z.optional(nodeRuntimeValuesDtoSchema),
      ancestors: z.optional(
        z.array(nodeRuntimeValuesDtoSchema).check(z.maxLength(AUTHORED_LIMITS.jsonNestingDepth))
      ),
      systemId: z.string().check(z.minLength(1))
    })
    .check(
      z.superRefine((request, context) => {
        const roots = [request.values, request.parentValues, ...(request.ancestors ?? [])]
        for (const root of roots) {
          if (root && exceedsNodeRuntimeStructureLimits(root)) {
            context.addIssue({
              code: 'custom',
              message: `Node runtime values may nest at most ${AUTHORED_LIMITS.jsonNestingDepth} levels and arrays may contain at most ${AUTHORED_LIMITS.referenceCollectionItems} items.`
            })
            return
          }
        }

        if (
          new TextEncoder().encode(JSON.stringify(request)).byteLength >
          AUTHORED_LIMITS.mutationPayloadBytes
        ) {
          context.addIssue({
            code: 'custom',
            message: `Node runtime requests must be at most ${AUTHORED_LIMITS.mutationPayloadBytes} bytes.`
          })
        }
      })
    )
)

function exceedsNodeRuntimeStructureLimits(value: unknown): boolean {
  const pending: Array<{ depth: number; value: unknown }> = [{ depth: 0, value }]
  while (pending.length > 0) {
    const current = pending.pop()!
    if (current.depth > AUTHORED_LIMITS.jsonNestingDepth) return true
    if (Array.isArray(current.value)) {
      if (current.value.length > AUTHORED_LIMITS.referenceCollectionItems) return true
      for (const child of current.value) pending.push({ depth: current.depth + 1, value: child })
      continue
    }
    if (typeof current.value !== 'object' || current.value === null) continue
    for (const child of Object.values(current.value)) {
      pending.push({ depth: current.depth + 1, value: child })
    }
  }
  return false
}

export const nodeRuntimeResolveRequestDtoSchema = nodeRuntimeContextDtoSchema
export const nodeRuntimeNormalizeValuesRequestDtoSchema = nodeRuntimeContextDtoSchema

export const nodeRuntimeOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    value: z.string(),
    label: z.string(),
    description: z.optional(z.string()),
    disabled: z.optional(z.boolean()),
    group: z.optional(z.string()),
    metadata: z.optional(z.record(z.string(), z.unknown()))
  })
)

const nodeRuntimeActionAppearanceBaseShape = lazySchemaParts(() => ({
  emphasis: z.enum(actionEmphasis),
  density: z.enum(controlDensity)
}))

const nodeRuntimeActionAppearanceDtoSchema = lazySchema(() =>
  z.discriminatedUnion('display', [
    z.strictObject({
      ...nodeRuntimeActionAppearanceBaseShape(),
      display: z.literal(actionDisplay[0]),
      width: z.literal(actionWidth[0])
    }),
    z.strictObject({
      ...nodeRuntimeActionAppearanceBaseShape(),
      display: z.enum([actionDisplay[1], actionDisplay[2]]),
      width: z.enum(actionWidth)
    })
  ])
)

const nodeRuntimeActionPresentationDtoSchema = lazySchema(() =>
  z.strictObject({
    default: nodeRuntimeActionAppearanceDtoSchema,
    compact: z.optional(nodeRuntimeActionAppearanceDtoSchema),
    wide: z.optional(nodeRuntimeActionAppearanceDtoSchema)
  })
)

const nodeRuntimeTextAppearanceDtoSchema = lazySchema(() =>
  z.strictObject({
    style: z.enum(semanticTextStyles),
    tone: z.enum(semanticTextTones)
  })
)

const nodeRuntimeTextPresentationDtoSchema = lazySchema(() =>
  z.strictObject({
    default: nodeRuntimeTextAppearanceDtoSchema,
    compact: z.optional(nodeRuntimeTextAppearanceDtoSchema),
    wide: z.optional(nodeRuntimeTextAppearanceDtoSchema)
  })
)

const nodeRuntimeSurfaceAppearanceDtoSchema = lazySchema(() =>
  z.strictObject({
    role: z.enum(semanticSurfaceRoles)
  })
)

const nodeRuntimeSurfacePresentationDtoSchema = lazySchema(() =>
  z.strictObject({
    default: nodeRuntimeSurfaceAppearanceDtoSchema,
    compact: z.optional(nodeRuntimeSurfaceAppearanceDtoSchema),
    wide: z.optional(nodeRuntimeSurfaceAppearanceDtoSchema)
  })
)

const nodeRuntimeGroupAppearanceDtoSchema = lazySchema(() =>
  z.strictObject({
    heading: z.optional(nodeRuntimeTextPresentationDtoSchema),
    surface: z.optional(nodeRuntimeSurfacePresentationDtoSchema)
  })
)

const nodeRuntimeActionBaseDtoSchema = lazySchema(() =>
  z.strictObject({
    label: z.string().check(z.minLength(1)),
    presentation: nodeRuntimeActionPresentationDtoSchema
  })
)

const nodeRuntimeCollectionAddActionDtoSchema = lazySchema(() =>
  z.extend(nodeRuntimeActionBaseDtoSchema, {
    type: z.literal('collection.add')
  })
)
const nodeRuntimeCollectionEditActionDtoSchema = lazySchema(() =>
  z.extend(nodeRuntimeActionBaseDtoSchema, {
    type: z.literal('collection.edit')
  })
)
const nodeRuntimeCollectionDuplicateActionDtoSchema = lazySchema(() =>
  z.extend(nodeRuntimeActionBaseDtoSchema, {
    type: z.literal('collection.duplicate')
  })
)
const nodeRuntimeCollectionRemoveActionDtoSchema = lazySchema(() =>
  z.extend(nodeRuntimeActionBaseDtoSchema, {
    type: z.literal('collection.remove')
  })
)

export const nodeRuntimeCollectionActionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    nodeRuntimeCollectionAddActionDtoSchema,
    nodeRuntimeCollectionEditActionDtoSchema,
    nodeRuntimeCollectionDuplicateActionDtoSchema,
    nodeRuntimeCollectionRemoveActionDtoSchema
  ])
)

const nodeRuntimeObjectActionDtoSchema = lazySchema(() =>
  z.discriminatedUnion('type', [
    nodeRuntimeCollectionAddActionDtoSchema,
    nodeRuntimeCollectionRemoveActionDtoSchema
  ])
)

const nodeRuntimeCollectionOrderingDtoSchema = lazySchema(() =>
  z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('derived') }),
    z.strictObject({
      mode: z.literal('manual'),
      identityPath: z.readonly(z.tuple([z.string().check(z.minLength(1))])),
      orderPath: z.optional(z.readonly(z.tuple([z.string().check(z.minLength(1))])))
    })
  ])
)

function rejectDuplicateActionTypes(
  actions: readonly { type: string }[],
  context: z.core.$RefinementCtx
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

export const nodeRuntimeCollectionAuthoringDtoSchema = lazySchema(() =>
  z.strictObject({
    actions: z.readonly(
      z.array(nodeRuntimeCollectionActionDtoSchema).check(z.superRefine(rejectDuplicateActionTypes))
    ),
    ordering: nodeRuntimeCollectionOrderingDtoSchema,
    itemLabel: z.optional(z.string().check(z.minLength(1))),
    emptyLabel: z.optional(z.string().check(z.minLength(1))),
    showHeading: z.optional(z.boolean()),
    join: z.optional(z.enum(['AND', 'OR'])),
    rowLayout: z.optional(z.enum(['default', 'card', 'flat', 'compact'])),
    rowExpansion: z.optional(z.enum(['collapsible', 'expanded'])),
    rowSummary: z.optional(
      z.enum([
        'default',
        'facet-context',
        'facet-condition',
        'modifier',
        'effect',
        'effect-path',
        'outcome',
        'speed'
      ])
    )
  })
)

const nodeRuntimeInputAuthoringDtoSchema = lazySchema(() =>
  z.strictObject({
    exposure: z.enum(['author', 'system'])
  })
)

const nodeRuntimeObjectAuthoringDtoSchema = lazySchema(() =>
  z.strictObject({
    exposure: z.enum(['author', 'system']),
    actions: z.readonly(
      z.array(nodeRuntimeObjectActionDtoSchema).check(z.superRefine(rejectDuplicateActionTypes))
    ),
    appearance: z.optional(nodeRuntimeGroupAppearanceDtoSchema),
    emptyLabel: z.optional(z.string().check(z.minLength(1)))
  })
)

export const nodeRuntimeAuthoringDtoSchema = lazySchema(() =>
  z.strictObject({
    exposure: z.enum(['author', 'system']),
    appearance: z.optional(nodeRuntimeGroupAppearanceDtoSchema),
    collection: nodeRuntimeCollectionAuthoringDtoSchema
  })
)

const nodeRuntimeNodeBaseShape = lazySchemaParts(() => ({
  id: z.string().check(z.minLength(1)),
  path: nodeRuntimePathDtoSchema,
  label: z.string().check(z.minLength(1)),
  visible: z.boolean(),
  required: z.boolean(),
  hiddenBehavior: z.enum(['KEEP', 'CLEAR']),
  clearPaths: z.array(nodeRuntimePathDtoSchema)
}))

const nodeRuntimeInputConstraintsDtoSchema = lazySchema(() =>
  z.strictObject({
    maximum: z.optional(z.number()),
    maximumLength: z.optional(z.number().check(z.int()).check(z.positive())),
    minimum: z.optional(z.number())
  })
)

const nodeRuntimeScalarInputDtoSchemas = ['TEXT', 'NUMBER', 'RICH_TEXT', 'TOGGLE'] as const

const scalarInputSchemas = lazySchemaParts(() =>
  nodeRuntimeScalarInputDtoSchemas.map((type) =>
    z.strictObject({
      ...nodeRuntimeNodeBaseShape(),
      kind: z.literal('INPUT'),
      type: z.literal(type),
      constraints: z.optional(nodeRuntimeInputConstraintsDtoSchema),
      authoring: nodeRuntimeInputAuthoringDtoSchema
    })
  )
)

const selectInputSchemas = lazySchemaParts(() =>
  (['SELECT_SINGLE', 'SELECT_NUMBER', 'SELECT_MULTI'] as const).map((type) =>
    z.strictObject({
      ...nodeRuntimeNodeBaseShape(),
      kind: z.literal('INPUT'),
      type: z.literal(type),
      options: z.array(nodeRuntimeOptionDtoSchema),
      /** An unknown value is kept (PRESERVE), refused at ingress (REFUSE) or, when unset, cleared. */
      unknownOptions: z.optional(z.enum(['PRESERVE', 'REFUSE'])),
      constraints: z.optional(nodeRuntimeInputConstraintsDtoSchema),
      authoring: nodeRuntimeInputAuthoringDtoSchema
    })
  )
)

const nodeRuntimeObjectGroupDtoSchema = lazySchema(() =>
  z.strictObject({
    ...nodeRuntimeNodeBaseShape(),
    kind: z.literal('GROUP'),
    groupKind: z.literal('OBJECT'),
    presentation: z.enum(['inline', 'branch']),
    childMapId: z.string().check(z.minLength(1)),
    authoring: nodeRuntimeObjectAuthoringDtoSchema
  })
)

const nodeRuntimeArrayGroupDtoSchema = lazySchema(() =>
  z.strictObject({
    ...nodeRuntimeNodeBaseShape(),
    kind: z.literal('GROUP'),
    groupKind: z.literal('ARRAY'),
    presentation: z.enum(['inline', 'table', 'summary', 'branch', 'focused']),
    childMapId: z.string().check(z.minLength(1)),
    authoring: nodeRuntimeAuthoringDtoSchema
  })
)

export const nodeRuntimeNodeDtoSchema = lazySchema(() =>
  z.union([
    ...scalarInputSchemas(),
    ...selectInputSchemas(),
    nodeRuntimeObjectGroupDtoSchema,
    nodeRuntimeArrayGroupDtoSchema
  ])
)

export const nodeRuntimeSectionDtoSchema = lazySchema(() =>
  z.strictObject({
    id: z.string(),
    label: z.string(),
    order: z.number(),
    nodes: z.array(nodeRuntimeNodeDtoSchema)
  })
)

export const nodeRuntimeStepDtoSchema = lazySchema(() =>
  z.strictObject({
    id: z.string(),
    label: z.string(),
    description: z.optional(z.string()),
    order: z.number(),
    sections: z.array(nodeRuntimeSectionDtoSchema)
  })
)

export const nodeRuntimeResolvedScopeDtoSchema = lazySchema(() =>
  z.strictObject({
    mapId: z.string(),
    path: nodeRuntimePathDtoSchema,
    steps: z.array(nodeRuntimeStepDtoSchema),
    clearPaths: z.array(nodeRuntimePathDtoSchema)
  })
)

export const nodeRuntimeResolveResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    mapId: z.string(),
    steps: z.array(nodeRuntimeStepDtoSchema),
    clearPaths: z.array(nodeRuntimePathDtoSchema),
    scopes: z.array(nodeRuntimeResolvedScopeDtoSchema)
  })
)

export const nodeRuntimeNormalizeValuesResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    values: z.unknown(),
    clearedPaths: z.array(nodeRuntimePathDtoSchema),
    /** The cleared paths whose node refuses an unknown value; ingress fails on any. */
    refusedPaths: z.array(nodeRuntimePathDtoSchema)
  })
)

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
  { type: 'SELECT_SINGLE' | 'SELECT_NUMBER' | 'SELECT_MULTI' }
>
export type NodeRuntimeGroupNodeDto = Extract<NodeRuntimeNodeDto, { kind: 'GROUP' }>
export type NodeRuntimeObjectGroupNodeDto = Extract<
  NodeRuntimeGroupNodeDto,
  { groupKind: 'OBJECT' }
>
export type NodeRuntimeArrayGroupNodeDto = Extract<NodeRuntimeGroupNodeDto, { groupKind: 'ARRAY' }>
export type NodeRuntimeSectionDto = z.infer<typeof nodeRuntimeSectionDtoSchema>
export type NodeRuntimeStepDto = z.infer<typeof nodeRuntimeStepDtoSchema>
export type NodeRuntimeResolvedScopeDto = z.infer<typeof nodeRuntimeResolvedScopeDtoSchema>
export type NodeRuntimeResolveResponseDto = z.infer<typeof nodeRuntimeResolveResponseDtoSchema>
export type NodeRuntimeNormalizeValuesResponseDto = z.infer<
  typeof nodeRuntimeNormalizeValuesResponseDtoSchema
>
