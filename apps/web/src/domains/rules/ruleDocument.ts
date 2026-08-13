import type { RulePackDocumentDto } from '#app/lib/api'
import {
  ruleModelKeyDtoSchema,
  rulePackDocumentDtoSchema
} from '@artificer-toolkit/schema/api/rules'

export const editorNodeComponents = [
  'inputNode',
  'outputNode',
  'decisionTableNode',
  'expressionNode',
  'switchNode'
] as const

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

export function addRuleModel(document: RulePackDocumentDto, key: string): RulePackDocumentDto {
  const modelKey = ruleModelKeyDtoSchema.parse(key)
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
  if (from !== modelKey && document.models[modelKey])
    throw new Error('A model already uses that key.')
  const { [from]: model, ...models } = document.models
  if (!model) throw new Error('The selected model no longer exists.')
  return {
    ...document,
    models: { ...models, [modelKey]: model },
    fixtures: document.fixtures.map((fixture) =>
      fixture.modelKey === from ? { ...fixture, modelKey } : fixture
    )
  }
}

export function removeRuleModel(document: RulePackDocumentDto, key: string): RulePackDocumentDto {
  if (Object.keys(document.models).length === 1)
    throw new Error('A rule document must contain at least one model.')
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
