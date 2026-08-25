import {
  compileFailure,
  compileSuccess,
  type CompileDiagnostic,
  type CompileResult
} from '../../utils/compileResult.js'
import {
  type CompiledRuleGraph,
  type GameSystemCapabilityContract,
  type RuleFactContract,
  type RuleGraphDefinition,
  type RuleGraphNodeDefinition,
  type RuleGraphSourceIdentity,
  RULE_GRAPH_LIMITS,
  type RuleInputBinding,
  type RuleOperationReference,
  type RuleValueKind
} from './contracts.js'
import type { RuleOperationContract, RuleOperationRegistry } from './operationRegistry.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CAPABILITY_KEY_PATTERN = /^[a-z][a-z0-9.-]{0,79}$/
const LOCAL_NODE_ID_PATTERN = /^[a-z][a-z0-9_-]{0,79}$/
const PORT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,79}$/

function diagnostic(code: string, message: string, path?: string[]): CompileDiagnostic {
  return { code, message, severity: 'error', ...(path ? { path } : {}) }
}

function operationIdentity(reference: RuleOperationReference): string {
  return `${reference.key}@${reference.contractVersion}`
}

function duplicateKeys(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

function copyBinding(binding: RuleInputBinding): RuleInputBinding {
  return { ...binding }
}

function bindingValueKind(input: {
  binding: RuleInputBinding
  facts: ReadonlyMap<string, RuleFactContract>
  nodes: ReadonlyMap<
    string,
    { definition: RuleGraphNodeDefinition; operation: RuleOperationContract }
  >
}): RuleValueKind | undefined {
  switch (input.binding.kind) {
    case 'FACT':
      return input.facts.get(input.binding.factKey)?.valueKind
    case 'LITERAL':
      if (typeof input.binding.value === 'boolean') return 'BOOLEAN'
      if (typeof input.binding.value === 'number') return 'NUMBER'
      return 'TEXT'
    case 'NODE_OUTPUT':
      return input.nodes.get(input.binding.nodeId)?.operation.outputs[input.binding.port]
  }
}

function validateBindingReference(input: {
  binding: RuleInputBinding
  path: string[]
  expectedKind?: RuleValueKind
  facts: ReadonlyMap<string, RuleFactContract>
  nodes: ReadonlyMap<
    string,
    { definition: RuleGraphNodeDefinition; operation: RuleOperationContract }
  >
}): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = []

  if (
    input.binding.kind === 'LITERAL' &&
    ((typeof input.binding.value === 'number' && !Number.isFinite(input.binding.value)) ||
      (typeof input.binding.value === 'string' &&
        input.binding.value.length > RULE_GRAPH_LIMITS.TEXT_VALUE_LENGTH))
  ) {
    diagnostics.push(
      diagnostic(
        'RULE_LITERAL_OUT_OF_BOUNDS',
        'Rule literal value is outside supported bounds.',
        input.path
      )
    )
  }

  if (input.binding.kind === 'FACT' && !input.facts.has(input.binding.factKey)) {
    diagnostics.push(
      diagnostic('RULE_UNKNOWN_FACT', `Unknown System fact "${input.binding.factKey}".`, input.path)
    )
  }

  if (input.binding.kind === 'NODE_OUTPUT') {
    const sourceNode = input.nodes.get(input.binding.nodeId)
    if (!sourceNode) {
      diagnostics.push(
        diagnostic(
          'RULE_UNKNOWN_NODE',
          `Unknown source node "${input.binding.nodeId}".`,
          input.path
        )
      )
    } else if (!Object.hasOwn(sourceNode.operation.outputs, input.binding.port)) {
      diagnostics.push(
        diagnostic(
          'RULE_UNKNOWN_OUTPUT_PORT',
          `Operation "${operationIdentity(sourceNode.definition.operation)}" has no output port "${input.binding.port}".`,
          input.path
        )
      )
    }
  }

  const actualKind = bindingValueKind(input)
  if (input.expectedKind && actualKind && input.expectedKind !== actualKind) {
    diagnostics.push(
      diagnostic(
        'RULE_PORT_TYPE_MISMATCH',
        `Expected ${input.expectedKind} but binding provides ${actualKind}.`,
        input.path
      )
    )
  }

  return diagnostics
}

function topologicalNodes(
  definitions: readonly RuleGraphNodeDefinition[]
): RuleGraphNodeDefinition[] | undefined {
  const indexById = new Map(definitions.map((node, index) => [node.id, index]))
  const incoming = new Map(definitions.map((node) => [node.id, 0]))
  const dependents = new Map(definitions.map((node) => [node.id, [] as string[]]))

  for (const node of definitions) {
    const dependencies = new Set(
      Object.values(node.inputs)
        .filter(
          (binding): binding is Extract<RuleInputBinding, { kind: 'NODE_OUTPUT' }> =>
            binding.kind === 'NODE_OUTPUT'
        )
        .map((binding) => binding.nodeId)
    )
    incoming.set(node.id, dependencies.size)
    for (const dependency of dependencies) {
      dependents.get(dependency)?.push(node.id)
    }
  }

  const ready = definitions.filter((node) => incoming.get(node.id) === 0)
  const ordered: RuleGraphNodeDefinition[] = []
  while (ready.length > 0) {
    ready.sort((left, right) => (indexById.get(left.id) ?? 0) - (indexById.get(right.id) ?? 0))
    const next = ready.shift()
    if (!next) break
    ordered.push(next)
    for (const dependentId of dependents.get(next.id) ?? []) {
      const remaining = (incoming.get(dependentId) ?? 0) - 1
      incoming.set(dependentId, remaining)
      if (remaining === 0) {
        const dependent = definitions[indexById.get(dependentId) ?? -1]
        if (dependent) ready.push(dependent)
      }
    }
  }

  return ordered.length === definitions.length ? ordered : undefined
}

export function compileRuleGraph(input: {
  definition: RuleGraphDefinition
  sourceChecksum: string
  capability: GameSystemCapabilityContract
  operations: RuleOperationRegistry
}): CompileResult<CompiledRuleGraph> {
  const diagnostics: CompileDiagnostic[] = []
  const { definition, capability } = input

  if (!UUID_PATTERN.test(definition.id) || !UUID_PATTERN.test(definition.gameSystemId)) {
    diagnostics.push(
      diagnostic(
        'RULE_INVALID_IDENTITY',
        'Rule definition and Game System identities must be UUIDs.'
      )
    )
  }
  if (!UUID_PATTERN.test(capability.gameSystemId)) {
    diagnostics.push(
      diagnostic('RULE_INVALID_SYSTEM_IDENTITY', 'Capability Game System identity must be a UUID.')
    )
  }
  if (!CAPABILITY_KEY_PATTERN.test(definition.definitionFamilyKey)) {
    diagnostics.push(
      diagnostic('RULE_INVALID_DEFINITION_FAMILY', 'Rule definition family key is invalid.')
    )
  }
  if (
    !Number.isInteger(capability.contractVersion) ||
    capability.contractVersion < 1 ||
    capability.contractVersion > 10_000
  ) {
    diagnostics.push(
      diagnostic('RULE_INVALID_CAPABILITY_VERSION', 'Capability contract version is invalid.')
    )
  }

  if (definition.gameSystemId !== capability.gameSystemId) {
    diagnostics.push(
      diagnostic(
        'RULE_SYSTEM_MISMATCH',
        'Rule definition and capability contract must belong to the same Game System.'
      )
    )
  }
  if (!capability.definitionFamilyKeys.includes(definition.definitionFamilyKey)) {
    diagnostics.push(
      diagnostic(
        'RULE_DEFINITION_FAMILY_NOT_SUPPORTED',
        `Game System does not support definition family "${definition.definitionFamilyKey}".`
      )
    )
  }
  if (!/^[a-f0-9]{64}$/.test(input.sourceChecksum)) {
    diagnostics.push(
      diagnostic(
        'RULE_INVALID_CHECKSUM',
        'Rule source checksum must be 64 lowercase hexadecimal characters.'
      )
    )
  }
  if (definition.nodes.length < 1 || definition.nodes.length > RULE_GRAPH_LIMITS.NODES) {
    diagnostics.push(
      diagnostic(
        'RULE_GRAPH_NODE_BOUNDS',
        `Rule graphs require between one and ${RULE_GRAPH_LIMITS.NODES} nodes.`
      )
    )
  }
  const outputCount = Object.keys(definition.outputs).length
  if (outputCount < 1 || outputCount > RULE_GRAPH_LIMITS.OUTPUTS) {
    diagnostics.push(
      diagnostic(
        'RULE_GRAPH_OUTPUT_BOUNDS',
        `Rule graphs require between one and ${RULE_GRAPH_LIMITS.OUTPUTS} outputs.`
      )
    )
  }
  if (capability.authoredRootKinds.length > RULE_GRAPH_LIMITS.AUTHORED_ROOT_KINDS) {
    diagnostics.push(
      diagnostic(
        'RULE_AUTHORED_ROOT_KIND_BOUNDS',
        `Game Systems support at most ${RULE_GRAPH_LIMITS.AUTHORED_ROOT_KINDS} authored root kinds.`
      )
    )
  }
  if (capability.definitionFamilyKeys.length > RULE_GRAPH_LIMITS.DEFINITION_FAMILIES) {
    diagnostics.push(
      diagnostic(
        'RULE_DEFINITION_FAMILY_BOUNDS',
        `Game Systems support at most ${RULE_GRAPH_LIMITS.DEFINITION_FAMILIES} definition families.`
      )
    )
  }
  if (capability.factContracts.length > RULE_GRAPH_LIMITS.FACT_CONTRACTS) {
    diagnostics.push(
      diagnostic(
        'RULE_FACT_CONTRACT_BOUNDS',
        `Game Systems support at most ${RULE_GRAPH_LIMITS.FACT_CONTRACTS} fact contracts.`
      )
    )
  }
  if (capability.operationContracts.length > RULE_GRAPH_LIMITS.OPERATION_CONTRACTS) {
    diagnostics.push(
      diagnostic(
        'RULE_OPERATION_CONTRACT_BOUNDS',
        `Game Systems support at most ${RULE_GRAPH_LIMITS.OPERATION_CONTRACTS} operation contracts.`
      )
    )
  }
  for (const [index, key] of capability.authoredRootKinds.entries()) {
    if (!CAPABILITY_KEY_PATTERN.test(key)) {
      diagnostics.push(
        diagnostic('RULE_INVALID_AUTHORED_ROOT_KIND', `Authored root kind "${key}" is invalid.`, [
          'capability',
          'authoredRootKinds',
          String(index)
        ])
      )
    }
  }
  for (const [index, key] of capability.definitionFamilyKeys.entries()) {
    if (!CAPABILITY_KEY_PATTERN.test(key)) {
      diagnostics.push(
        diagnostic('RULE_INVALID_DEFINITION_FAMILY', `Definition family "${key}" is invalid.`, [
          'capability',
          'definitionFamilyKeys',
          String(index)
        ])
      )
    }
  }
  for (const [index, fact] of capability.factContracts.entries()) {
    if (!CAPABILITY_KEY_PATTERN.test(fact.key)) {
      diagnostics.push(
        diagnostic('RULE_INVALID_FACT_KEY', `Fact key "${fact.key}" is invalid.`, [
          'capability',
          'factContracts',
          String(index),
          'key'
        ])
      )
    }
  }
  for (const [index, operation] of capability.operationContracts.entries()) {
    if (
      !CAPABILITY_KEY_PATTERN.test(operation.key) ||
      !Number.isInteger(operation.contractVersion) ||
      operation.contractVersion < 1 ||
      operation.contractVersion > 10_000
    ) {
      diagnostics.push(
        diagnostic(
          'RULE_INVALID_OPERATION_CAPABILITY',
          'Game System operation capability is invalid.',
          ['capability', 'operationContracts', String(index)]
        )
      )
    }
  }

  for (const duplicate of duplicateKeys(capability.factContracts.map((fact) => fact.key))) {
    diagnostics.push(
      diagnostic('RULE_DUPLICATE_FACT_CONTRACT', `Duplicate System fact contract "${duplicate}".`)
    )
  }
  for (const duplicate of duplicateKeys(capability.authoredRootKinds)) {
    diagnostics.push(
      diagnostic(
        'RULE_DUPLICATE_AUTHORED_ROOT_KIND',
        `Duplicate authored root kind "${duplicate}".`
      )
    )
  }
  for (const duplicate of duplicateKeys(capability.definitionFamilyKeys)) {
    diagnostics.push(
      diagnostic('RULE_DUPLICATE_DEFINITION_FAMILY', `Duplicate definition family "${duplicate}".`)
    )
  }
  const supportedOperations = new Set(capability.operationContracts.map(operationIdentity))
  for (const duplicate of duplicateKeys(capability.operationContracts.map(operationIdentity))) {
    diagnostics.push(
      diagnostic(
        'RULE_DUPLICATE_OPERATION_CAPABILITY',
        `Duplicate operation capability "${duplicate}".`
      )
    )
  }

  const nodeIds = definition.nodes.map((node) => node.id)
  for (const duplicate of duplicateKeys(nodeIds)) {
    diagnostics.push(diagnostic('RULE_DUPLICATE_NODE', `Duplicate rule node "${duplicate}".`))
  }

  const nodes = new Map<
    string,
    { definition: RuleGraphNodeDefinition; operation: RuleOperationContract }
  >()
  for (const [index, node] of definition.nodes.entries()) {
    if (!LOCAL_NODE_ID_PATTERN.test(node.id)) {
      diagnostics.push(
        diagnostic('RULE_INVALID_NODE_ID', `Rule node ID "${node.id}" is invalid.`, [
          'nodes',
          String(index),
          'id'
        ])
      )
    }
    if (
      !CAPABILITY_KEY_PATTERN.test(node.operation.key) ||
      !Number.isInteger(node.operation.contractVersion) ||
      node.operation.contractVersion < 1 ||
      node.operation.contractVersion > 10_000
    ) {
      diagnostics.push(
        diagnostic('RULE_INVALID_OPERATION_REFERENCE', 'Rule operation reference is invalid.', [
          'nodes',
          String(index),
          'operation'
        ])
      )
    }
    for (const port of Object.keys(node.inputs)) {
      if (!PORT_NAME_PATTERN.test(port)) {
        diagnostics.push(
          diagnostic('RULE_INVALID_INPUT_PORT', `Rule input port "${port}" is invalid.`, [
            'nodes',
            String(index),
            'inputs',
            port
          ])
        )
      }
    }
    const identity = operationIdentity(node.operation)
    if (!supportedOperations.has(identity)) {
      diagnostics.push(
        diagnostic(
          'RULE_OPERATION_NOT_SUPPORTED',
          `Game System does not support operation "${identity}".`,
          ['nodes', String(index), 'operation']
        )
      )
      continue
    }
    try {
      nodes.set(node.id, { definition: node, operation: input.operations.require(node.operation) })
    } catch (error) {
      diagnostics.push(
        diagnostic(
          'RULE_OPERATION_NOT_REGISTERED',
          error instanceof Error ? error.message : `Operation "${identity}" is not registered.`,
          ['nodes', String(index), 'operation']
        )
      )
    }
  }

  const facts = new Map(capability.factContracts.map((fact) => [fact.key, fact]))
  for (const [index, node] of definition.nodes.entries()) {
    if (Object.keys(node.inputs).length > RULE_GRAPH_LIMITS.NODE_INPUTS) {
      diagnostics.push(
        diagnostic(
          'RULE_NODE_INPUT_BOUNDS',
          `Rule nodes support at most ${RULE_GRAPH_LIMITS.NODE_INPUTS} input bindings.`,
          ['nodes', String(index), 'inputs']
        )
      )
    }
    const operation = nodes.get(node.id)?.operation
    if (!operation) continue
    const requiredPorts = Object.keys(operation.inputs)
    const suppliedPorts = Object.keys(node.inputs)
    for (const port of requiredPorts.filter((port) => !Object.hasOwn(node.inputs, port))) {
      diagnostics.push(
        diagnostic('RULE_INPUT_PORT_MISSING', `Required input port "${port}" is missing.`, [
          'nodes',
          String(index),
          'inputs',
          port
        ])
      )
    }
    for (const port of suppliedPorts.filter((port) => !Object.hasOwn(operation.inputs, port))) {
      diagnostics.push(
        diagnostic('RULE_INPUT_PORT_UNKNOWN', `Unknown input port "${port}".`, [
          'nodes',
          String(index),
          'inputs',
          port
        ])
      )
    }
    for (const [port, binding] of Object.entries(node.inputs)) {
      diagnostics.push(
        ...validateBindingReference({
          binding,
          path: ['nodes', String(index), 'inputs', port],
          expectedKind: operation.inputs[port],
          facts,
          nodes
        })
      )
    }
  }

  for (const [output, binding] of Object.entries(definition.outputs)) {
    if (!PORT_NAME_PATTERN.test(output)) {
      diagnostics.push(
        diagnostic('RULE_INVALID_OUTPUT_PORT', `Rule output port "${output}" is invalid.`, [
          'outputs',
          output
        ])
      )
    }
    diagnostics.push(
      ...validateBindingReference({
        binding,
        path: ['outputs', output],
        facts,
        nodes
      })
    )
  }

  const orderedNodes = topologicalNodes(definition.nodes)
  if (!orderedNodes) diagnostics.push(diagnostic('RULE_GRAPH_CYCLE', 'Rule graph must be acyclic.'))

  if (diagnostics.length > 0 || !orderedNodes) return compileFailure(diagnostics)

  const source: RuleGraphSourceIdentity = {
    definitionId: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: input.sourceChecksum
  }
  return compileSuccess({
    schemaVersion: 1,
    source,
    capabilityContractVersion: capability.contractVersion,
    factContracts: capability.factContracts.map((fact) => ({ ...fact })),
    nodes: orderedNodes.map((node) => ({
      id: node.id,
      operation: { ...node.operation },
      inputs: Object.fromEntries(
        Object.entries(node.inputs).map(([port, binding]) => [port, copyBinding(binding)])
      )
    })),
    outputs: Object.fromEntries(
      Object.entries(definition.outputs).map(([output, binding]) => [output, copyBinding(binding)])
    )
  })
}
