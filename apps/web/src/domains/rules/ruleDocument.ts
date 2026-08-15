import type { RulePackDocumentDto } from '#app/lib/api'
import { CHARACTER_ACTION_MODEL_KEY } from '@artificer-toolkit/schema/api/characterActionRules'
import { CHARACTER_GRANT_FOLD_MODEL_KEY } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  ruleModelKeyDtoSchema,
  rulePackDocumentDtoSchema
} from '@artificer-toolkit/schema/api/rules'

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function referencesModel(model: RulePackDocumentDto['models'][string], modelKey: string): boolean {
  const nodes = record(model)?.nodes
  return (
    Array.isArray(nodes) &&
    nodes.some((value) => {
      const node = record(value)
      return node?.type === 'decisionNode' && record(node.content)?.key === modelKey
    })
  )
}

const RESERVED_RULE_MODEL_KEYS = new Set([
  CHARACTER_ACTION_MODEL_KEY,
  CHARACTER_GRANT_FOLD_MODEL_KEY,
  ENCOUNTER_ACTOR_MODEL_KEY
])

export function isReservedRuleModelKey(modelKey: string): boolean {
  return RESERVED_RULE_MODEL_KEYS.has(modelKey)
}

export function getVisibleRuleModelKeys(document: RulePackDocumentDto): string[] {
  return Object.keys(document.models).filter((key) => !isReservedRuleModelKey(key))
}

export function getVisibleRuleFixtures(
  document: RulePackDocumentDto
): RulePackDocumentDto['fixtures'] {
  return document.fixtures.filter((fixture) => !isReservedRuleModelKey(fixture.modelKey))
}

function rewriteModelReference(
  model: RulePackDocumentDto['models'][string],
  from: string,
  to: string
): RulePackDocumentDto['models'][string] {
  const graph = record(model)
  if (!graph || !Array.isArray(graph.nodes)) return model
  let changed = false
  const nodes = graph.nodes.map((value) => {
    const node = record(value)
    const content = record(node?.content)
    if (node?.type !== 'decisionNode' || content?.key !== from) return value
    changed = true
    return { ...node, content: { ...content, key: to } }
  })
  return changed ? ({ ...graph, nodes } as RulePackDocumentDto['models'][string]) : model
}

export function createDefaultRuleDocument(): RulePackDocumentDto {
  return {
    schemaVersion: 1,
    models: {
      main: {
        nodes: [
          {
            id: 'input',
            type: 'inputNode',
            name: 'Input',
            position: { x: 0, y: 0 },
            content: { schema: '{}' }
          },
          {
            id: 'output',
            type: 'outputNode',
            name: 'Output',
            position: { x: 360, y: 0 },
            content: { schema: '{}' }
          }
        ],
        edges: [{ id: 'input-output', sourceId: 'input', targetId: 'output' }]
      }
    },
    fixtures: []
  }
}

export function parseRuleDocument(text: string): RulePackDocumentDto {
  return rulePackDocumentDtoSchema.parse(JSON.parse(text))
}

export function mergeImportedRuleDocument(
  current: RulePackDocumentDto,
  imported: RulePackDocumentDto
): RulePackDocumentDto {
  const reservedModels = Object.fromEntries(
    Object.entries(current.models).filter(([key]) => isReservedRuleModelKey(key))
  )
  return {
    ...imported,
    models: {
      ...Object.fromEntries(
        Object.entries(imported.models).filter(([key]) => !isReservedRuleModelKey(key))
      ),
      ...reservedModels
    },
    fixtures: [
      ...current.fixtures.filter((fixture) => isReservedRuleModelKey(fixture.modelKey)),
      ...getVisibleRuleFixtures(imported)
    ]
  }
}

export function addRuleModel(document: RulePackDocumentDto, key: string): RulePackDocumentDto {
  const modelKey = ruleModelKeyDtoSchema.parse(key)
  if (isReservedRuleModelKey(modelKey)) throw new Error('This model key is reserved.')
  if (document.models[modelKey]) throw new Error('A model already uses that key.')
  return {
    ...document,
    models: { ...document.models, [modelKey]: createDefaultRuleDocument().models.main }
  }
}

export function renameRuleModel(
  document: RulePackDocumentDto,
  from: string,
  to: string
): RulePackDocumentDto {
  const modelKey = ruleModelKeyDtoSchema.parse(to)
  if (isReservedRuleModelKey(from)) throw new Error('The selected model is reserved.')
  if (isReservedRuleModelKey(modelKey)) throw new Error('This model key is reserved.')
  if (from !== modelKey && document.models[modelKey])
    throw new Error('A model already uses that key.')
  const { [from]: model, ...models } = document.models
  if (!model) throw new Error('The selected model no longer exists.')
  return {
    ...document,
    models: Object.fromEntries(
      Object.entries({ ...models, [modelKey]: model }).map(([key, value]) => [
        key,
        rewriteModelReference(value, from, modelKey)
      ])
    ),
    fixtures: document.fixtures.map((fixture) =>
      fixture.modelKey === from ? { ...fixture, modelKey } : fixture
    )
  }
}

export function removeRuleModel(document: RulePackDocumentDto, key: string): RulePackDocumentDto {
  if (isReservedRuleModelKey(key))
    throw new Error('The reserved model cannot be removed from Rule Studio.')
  if (Object.keys(document.models).length === 1)
    throw new Error('A rule document must contain at least one model.')
  const caller = Object.entries(document.models).find(
    ([modelKey, model]) => modelKey !== key && referencesModel(model, key)
  )
  if (caller) throw new Error(`Model "${key}" is referenced by model "${caller[0]}".`)
  const { [key]: _removed, ...models } = document.models
  return {
    ...document,
    models,
    fixtures: document.fixtures.filter((fixture) => fixture.modelKey !== key)
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
