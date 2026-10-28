import { z, lazySchema } from '../zod.js'
import {
  nodeRuntimeNodeDtoSchema,
  nodeRuntimePathDtoSchema,
  nodeRuntimeSectionDtoSchema,
  nodeRuntimeStepDtoSchema,
  type NodeRuntimeNodeDto,
  type NodeRuntimeResolveResponseDto,
  type NodeRuntimeStepDto
} from './nodeRuntime.js'

const tableIndexSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

/** A step whose section nodes are indexes into the response's `nodes` table. */
const nodeRuntimeCompactStepDtoSchema = lazySchema(() =>
  z.strictObject({
    ...z.omit(nodeRuntimeStepDtoSchema, { sections: true }).shape,
    sections: z.array(
      z.strictObject({
        ...z.omit(nodeRuntimeSectionDtoSchema, { nodes: true }).shape,
        nodes: z.array(tableIndexSchema)
      })
    )
  })
)

const nodeRuntimeCompactModelDtoSchema = lazySchema(() =>
  z.strictObject({
    mapId: z.string(),
    steps: z.array(nodeRuntimeCompactStepDtoSchema),
    clearPaths: z.array(nodeRuntimePathDtoSchema)
  })
)

const nodeRuntimeCompactScopeDtoSchema = lazySchema(() =>
  z.strictObject({ path: nodeRuntimePathDtoSchema, modelIndex: tableIndexSchema })
)

/**
 * The resolve response with every distinct node and every distinct nested scope model sent once:
 * steps reference `nodes` by index and scopes reference `models` by index.
 */
export const nodeRuntimeCompactResolveResponseDtoSchema = lazySchema(() =>
  z
    .strictObject({
      mapId: z.string(),
      steps: z.array(nodeRuntimeCompactStepDtoSchema),
      clearPaths: z.array(nodeRuntimePathDtoSchema),
      nodes: z.array(nodeRuntimeNodeDtoSchema),
      models: z.array(nodeRuntimeCompactModelDtoSchema),
      scopes: z.array(nodeRuntimeCompactScopeDtoSchema)
    })
    .check(
      z.superRefine((response, context) => {
        const checkSteps = (steps: CompactStep[], path: (string | number)[]) =>
          steps.forEach((step, stepIndex) =>
            step.sections.forEach((section, sectionIndex) =>
              section.nodes.forEach((nodeIndex, index) => {
                if (nodeIndex >= response.nodes.length)
                  context.addIssue({
                    code: 'custom',
                    message: 'Section node index must refer to a response node.',
                    path: [...path, stepIndex, 'sections', sectionIndex, 'nodes', index]
                  })
              })
            )
          )
        checkSteps(response.steps, ['steps'])
        response.models.forEach((model, index) =>
          checkSteps(model.steps, ['models', index, 'steps'])
        )
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
)

export type NodeRuntimeCompactResolveResponseDto = z.infer<
  typeof nodeRuntimeCompactResolveResponseDtoSchema
>
type CompactStep = NodeRuntimeCompactResolveResponseDto['steps'][number]

/** Interns `values` by their JSON text; each table entry is the parsed text, so it is JSON-clean. */
function createInternTable<T>() {
  const entries: T[] = []
  const indexes = new Map<string, number>()
  const intern = (key: string): number => {
    let index = indexes.get(key)
    if (index === undefined) {
      index = entries.length
      indexes.set(key, index)
      entries.push(JSON.parse(key) as T)
    }
    return index
  }
  return { entries, intern }
}

/**
 * Builds the compact transport. Its output is JSON-clean (no undefined properties), so it crosses
 * the Convex boundary as it is.
 */
export function compactNodeRuntimeResponse(
  response: NodeRuntimeResolveResponseDto
): NodeRuntimeCompactResolveResponseDto {
  const nodes = createInternTable<NodeRuntimeNodeDto>()
  const models = createInternTable<NodeRuntimeCompactResolveResponseDto['models'][number]>()
  const compactSteps = (steps: readonly NodeRuntimeStepDto[]): CompactStep[] =>
    steps.map((step) => ({
      ...step,
      sections: step.sections.map((section) => ({
        ...section,
        nodes: section.nodes.map((node) => nodes.intern(JSON.stringify(node)))
      }))
    }))
  const scopes = response.scopes.map(({ path, mapId, steps, clearPaths }) => ({
    path: [...path],
    modelIndex: models.intern(JSON.stringify({ mapId, steps: compactSteps(steps), clearPaths }))
  }))
  const root: Pick<NodeRuntimeCompactResolveResponseDto, 'steps' | 'clearPaths'> = JSON.parse(
    JSON.stringify({ steps: compactSteps(response.steps), clearPaths: response.clearPaths })
  )

  return {
    mapId: response.mapId,
    ...root,
    nodes: nodes.entries,
    models: models.entries,
    scopes
  }
}

/** The only consumer of the compact transport: rebuilds the full response with fresh objects. */
export function expandNodeRuntimeResponse(input: unknown): NodeRuntimeResolveResponseDto {
  const response = nodeRuntimeCompactResolveResponseDtoSchema.parse(input)
  const expandSteps = (steps: CompactStep[]): NodeRuntimeStepDto[] =>
    steps.map((step) => ({
      ...step,
      sections: step.sections.map((section) => ({
        ...section,
        nodes: section.nodes.map((index) => structuredClone(tableEntry(response.nodes, index)))
      }))
    }))

  return {
    mapId: response.mapId,
    steps: expandSteps(response.steps),
    clearPaths: response.clearPaths,
    scopes: response.scopes.map((scope) => {
      const model = tableEntry(response.models, scope.modelIndex)
      return {
        mapId: model.mapId,
        path: structuredClone(scope.path),
        steps: expandSteps(model.steps),
        clearPaths: structuredClone(model.clearPaths)
      }
    })
  }
}

function tableEntry<T>(table: readonly T[], index: number): T {
  const entry = table[index]
  if (entry === undefined) throw new Error('Compact index must refer to a response table entry.')
  return entry
}
