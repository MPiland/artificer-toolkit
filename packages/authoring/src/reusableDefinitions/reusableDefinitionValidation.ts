import type {
  ReusableDefinitionCurrentDto,
  ReusableDefinitionRootRecord
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type {
  GameSystemRuleCapabilityDto,
  RuleGraphDefinitionDto
} from '@artificer-toolkit/schema/api/rulesRuntime'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { RULE_RUNTIME_GRAPH_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import {
  checksumRuleDocument,
  compileRuleGraph,
  RULE_VALUE_KIND,
  type createRuleOperationRegistry
} from '@artificer-toolkit/shared/rules'

export class ReusableDefinitionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReusableDefinitionValidationError'
  }
}

export type RuleOperationRegistry = ReturnType<typeof createRuleOperationRegistry>

export type ReusableDefinitionRequireCurrent = {
  requireCurrent(definitionId: string): Promise<ReusableDefinitionCurrentDto>
}

/** What a reusable definition publisher validates: one draft or publication of one definition. */
export interface ReusableDefinitionValidationInput {
  root: ReusableDefinitionRootRecord
  document: unknown
  checksum: string
  capabilities: ReadonlyMap<string, GameSystemRuleCapabilityDto>
  operations: RuleOperationRegistry
  store: ReusableDefinitionRequireCurrent
  resolveSystemVocabulary?: (gameSystemId: string) => Promise<unknown>
}

/** A System's publisher for one reusable definition family it owns. */
export interface SystemDefinitionPublisher {
  readonly familyKey: string
  /** The definition ids a document pins and publication must lock; empty for any other document. */
  dependencyDefinitionIds(document: unknown): readonly string[]
  validate(input: ReusableDefinitionValidationInput): Promise<unknown>
}

/** The publishers by family key; each installed family key has exactly one, and no publisher is for another. */
export function indexDefinitionPublishers(
  publishers: readonly SystemDefinitionPublisher[],
  installedFamilyKeys: readonly string[]
): ReadonlyMap<string, SystemDefinitionPublisher> {
  const byFamily = new Map<string, SystemDefinitionPublisher>()
  for (const publisher of publishers) {
    if (byFamily.has(publisher.familyKey))
      throw new ReusableDefinitionValidationError(
        `Reusable definition family "${publisher.familyKey}" has more than one publisher.`
      )
    byFamily.set(publisher.familyKey, publisher)
  }
  for (const familyKey of installedFamilyKeys)
    if (!byFamily.has(familyKey))
      throw new ReusableDefinitionValidationError(
        `Installed reusable definition family "${familyKey}" has no publisher.`
      )
  for (const familyKey of byFamily.keys())
    if (!installedFamilyKeys.includes(familyKey))
      throw new ReusableDefinitionValidationError(
        `Publisher family "${familyKey}" is not an installed reusable definition family.`
      )
  return byFamily
}

export async function requireExactCurrentRuntimeGraph(input: {
  pin: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
  }
  root: ReusableDefinitionRootRecord
  store: ReusableDefinitionRequireCurrent
  capability: GameSystemRuleCapabilityDto
  operations: RuleOperationRegistry
  policyName: string
  requireExecutable?: boolean
}) {
  let current: ReusableDefinitionCurrentDto
  try {
    current = await input.store.requireCurrent(input.pin.definitionId)
  } catch {
    throw new ReusableDefinitionValidationError(
      `${input.policyName} references an unavailable current Rules Runtime graph.`
    )
  }
  if (
    current.id !== input.pin.definitionId ||
    current.definitionFamilyKey !== RULE_RUNTIME_GRAPH_FAMILY_KEY ||
    current.gameSystemId !== input.root.gameSystemId ||
    current.version !== input.pin.definitionVersion ||
    current.checksum !== input.pin.definitionChecksum
  ) {
    throw new ReusableDefinitionValidationError(
      `${input.policyName} graph pins must reference exact current Rules Runtime graphs from the same Game System.`
    )
  }
  const parsed = ruleGraphDefinitionDtoSchema.safeParse(current.document)
  if (!parsed.success || checksumRuleDocument(parsed.data) !== current.checksum) {
    throw new ReusableDefinitionValidationError(
      `${input.policyName} graph pins must reference checksum-valid current Rules Runtime graphs.`
    )
  }
  if (input.requireExecutable !== false) {
    const compiled = compileRuleGraph({
      definition: parsed.data,
      sourceChecksum: current.checksum,
      capability: input.capability,
      operations: input.operations
    })
    if (!compiled.ok) {
      throw new ReusableDefinitionValidationError(
        `${input.policyName} graph pins must reference executable Rules Runtime graphs.`
      )
    }
  }
  return parsed.data
}

export function ruleGraphOutputKind(input: {
  graph: RuleGraphDefinitionDto
  outputName: string
  capability: GameSystemRuleCapabilityDto
  operations: RuleOperationRegistry
}) {
  const binding = input.graph.outputs[input.outputName]
  if (!binding) return undefined
  switch (binding.kind) {
    case 'LITERAL':
      if (typeof binding.value === 'boolean') return RULE_VALUE_KIND.BOOLEAN
      if (typeof binding.value === 'number') return RULE_VALUE_KIND.NUMBER
      return RULE_VALUE_KIND.TEXT
    case 'FACT':
      return input.capability.factContracts.find((fact) => fact.key === binding.factKey)?.valueKind
    case 'NODE_OUTPUT': {
      const node = input.graph.nodes.find((candidate) => candidate.id === binding.nodeId)
      return node ? input.operations.require(node.operation).outputs[binding.port] : undefined
    }
  }
}
