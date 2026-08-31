import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'
import { CHARACTER_GRANT_FOLD_MODEL_KEY } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { CHARACTER_ACTION_MODEL_KEY } from '@artificer-toolkit/schema/api/characterActionRules'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'

import { dnd5e2014CharacterActionModel } from './systems/dnd5e/2014/characterActionSource.js'
import { dnd5e2014CharacterGrantFoldModel } from './systems/dnd5e/2014/characterGrantFoldSource.js'
import { dnd5e2014EncounterActorModel } from './systems/dnd5e/2014/encounterActorSource.js'
import { equalCanonicalJson } from '@artificer-toolkit/shared/rules'

const ALLOWED_NODE_TYPES = new Set([
  'inputNode',
  'outputNode',
  'decisionTableNode',
  'expressionNode',
  'switchNode',
  'decisionNode'
])
const NONDETERMINISTIC_CALL = /\b(?:now|today|random|rand|uuid)\s*\(/i
const MAX_JSON_DEPTH = 32
const MAX_GRAPH_NODES = 100
const MAX_GRAPH_EDGES = 200
const RESERVED_MODELS: Readonly<Record<string, RulePackDocumentDto['models'][string]>> = {
  [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel,
  [CHARACTER_ACTION_MODEL_KEY]: dnd5e2014CharacterActionModel,
  [CHARACTER_GRANT_FOLD_MODEL_KEY]: dnd5e2014CharacterGrantFoldModel
}

export class RuleDocumentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleDocumentValidationError'
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function assertJsonDepth(value: unknown, depth = 0): void {
  if (depth > MAX_JSON_DEPTH) {
    throw new RuleDocumentValidationError(`Rule documents cannot exceed ${MAX_JSON_DEPTH} levels.`)
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => assertJsonDepth(entry, depth + 1))
    return
  }
  const object = record(value)
  if (object) Object.values(object).forEach((entry) => assertJsonDepth(entry, depth + 1))
}

function assertDeterministicModel(value: unknown): void {
  if (typeof value === 'string' && NONDETERMINISTIC_CALL.test(value)) {
    throw new RuleDocumentValidationError(
      'Rule models cannot call wall-clock, random, or UUID functions.'
    )
  }
  if (Array.isArray(value)) {
    value.forEach(assertDeterministicModel)
    return
  }
  const object = record(value)
  if (object) Object.values(object).forEach(assertDeterministicModel)
}

function assertSafeGraph(
  modelKey: string,
  model: unknown,
  modelKeys: Set<string>,
  allowReservedFunction: boolean
): void {
  const graph = record(model)
  if (!graph) throw new RuleDocumentValidationError(`Rule model "${modelKey}" must be an object.`)
  const nodes = graph.nodes
  const edges = graph.edges
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new RuleDocumentValidationError(
      `Rule model "${modelKey}" must contain node and edge arrays.`
    )
  }
  assertDeterministicModel(model)
  if (nodes.length < 2 || nodes.length > MAX_GRAPH_NODES) {
    throw new RuleDocumentValidationError(
      `Rule model "${modelKey}" must contain between two and ${MAX_GRAPH_NODES} nodes.`
    )
  }
  if (edges.length > MAX_GRAPH_EDGES) {
    throw new RuleDocumentValidationError(
      `Rule model "${modelKey}" cannot contain more than ${MAX_GRAPH_EDGES} edges.`
    )
  }

  const ids = new Set<string>()
  let inputNodes = 0
  let outputNodes = 0
  for (const [index, value] of nodes.entries()) {
    const node = record(value)
    const id = node?.id
    const type = node?.type
    if (typeof id !== 'string' || id.length === 0 || id.length > 160) {
      throw new RuleDocumentValidationError(
        `Rule model "${modelKey}" node ${index + 1} has an invalid ID.`
      )
    }
    if (ids.has(id)) {
      throw new RuleDocumentValidationError(`Rule model "${modelKey}" repeats node ID "${id}".`)
    }
    ids.add(id)
    if (
      typeof type !== 'string' ||
      (!ALLOWED_NODE_TYPES.has(type) && !(allowReservedFunction && type === 'functionNode'))
    ) {
      throw new RuleDocumentValidationError(
        `Rule model "${modelKey}" contains unsupported node type "${String(type)}".`
      )
    }
    if (type === 'inputNode') inputNodes += 1
    if (type === 'outputNode') outputNodes += 1
    if (type === 'decisionNode') {
      const referencedModel = record(node?.content)?.key
      if (typeof referencedModel !== 'string' || !modelKeys.has(referencedModel)) {
        throw new RuleDocumentValidationError(
          `Rule model "${modelKey}" references missing model "${String(referencedModel)}".`
        )
      }
    }
  }
  if (inputNodes !== 1 || outputNodes !== 1) {
    throw new RuleDocumentValidationError(
      `Rule model "${modelKey}" requires exactly one input and one output node.`
    )
  }

  for (const [index, value] of edges.entries()) {
    const edge = record(value)
    const sourceId = edge?.sourceId
    const targetId = edge?.targetId
    if (
      typeof sourceId !== 'string' ||
      typeof targetId !== 'string' ||
      sourceId === targetId ||
      !ids.has(sourceId) ||
      !ids.has(targetId)
    ) {
      throw new RuleDocumentValidationError(
        `Rule model "${modelKey}" edge ${index + 1} has invalid endpoints.`
      )
    }
  }
}

export function validateRulePackDocument(document: RulePackDocumentDto): void {
  const serialized = JSON.stringify(document)
  if (Buffer.byteLength(serialized, 'utf8') > AUTHORED_LIMITS.mutationPayloadBytes) {
    throw new RuleDocumentValidationError(
      `Rule documents cannot exceed ${AUTHORED_LIMITS.mutationPayloadBytes} bytes.`
    )
  }
  for (const [modelKey, canonicalModel] of Object.entries(RESERVED_MODELS)) {
    const reservedModel = document.models[modelKey]
    if (reservedModel !== undefined && !equalCanonicalJson(reservedModel, canonicalModel)) {
      throw new RuleDocumentValidationError(
        `Rule model "${modelKey}" must exactly match the repository-owned model.`
      )
    }
  }
  assertJsonDepth(document)
  const modelKeys = new Set(Object.keys(document.models))
  Object.entries(document.models).forEach(([modelKey, model]) => {
    const reserved = Object.hasOwn(RESERVED_MODELS, modelKey)
    assertSafeGraph(modelKey, model, modelKeys, reserved)
  })

  const fixtureIds = new Set<string>()
  for (const fixture of document.fixtures) {
    if (!Object.hasOwn(document.models, fixture.modelKey)) {
      throw new RuleDocumentValidationError(
        `Fixture "${fixture.label}" references missing model "${fixture.modelKey}".`
      )
    }
    if (fixtureIds.has(fixture.id)) {
      throw new RuleDocumentValidationError(`Rule fixture ID "${fixture.id}" is duplicated.`)
    }
    fixtureIds.add(fixture.id)
  }
}

export function validateActivatableRulePackDocument(document: RulePackDocumentDto): void {
  validateRulePackDocument(document)
  const coveredModels = new Set(document.fixtures.map((fixture) => fixture.modelKey))
  const uncovered = Object.keys(document.models).filter((modelKey) => !coveredModels.has(modelKey))
  if (uncovered.length > 0) {
    throw new RuleDocumentValidationError(
      `Every model requires an activation fixture. Missing: ${uncovered.join(', ')}.`
    )
  }
}
