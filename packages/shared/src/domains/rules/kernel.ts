import {
  type CompiledRuleGraph,
  type RuleExecutionContinuation,
  type RuleExecutionResult,
  type RuleExecutionTraceEntry,
  type RuleInputBinding,
  type RuleIntegerRangeEvidenceRequest,
  type RuleValue
} from './contracts.js'
import { valueMatchesKind, type RuleOperationRegistry } from './operationRegistry.js'

export class RuleKernelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleKernelError'
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function resolveBinding(input: {
  binding: RuleInputBinding
  facts: Readonly<Record<string, RuleValue>>
  nodeOutputs: ReadonlyMap<string, Readonly<Record<string, RuleValue>>>
}): RuleValue {
  switch (input.binding.kind) {
    case 'FACT': {
      const value = input.facts[input.binding.factKey]
      if (value === undefined)
        throw new RuleKernelError(`Required runtime fact "${input.binding.factKey}" is missing.`)
      return value
    }
    case 'LITERAL':
      return input.binding.value
    case 'NODE_OUTPUT': {
      const value = input.nodeOutputs.get(input.binding.nodeId)?.[input.binding.port]
      if (value === undefined)
        throw new RuleKernelError(
          `Node output "${input.binding.nodeId}.${input.binding.port}" is unavailable.`
        )
      return value
    }
  }
}

/** The fact keys a graph's node inputs and outputs read, each of which execution requires. */
export function requiredRuleGraphFacts(
  graph: Pick<CompiledRuleGraph, 'nodes' | 'outputs'>
): Set<string> {
  return new Set(
    [...graph.nodes.flatMap((node) => Object.values(node.inputs)), ...Object.values(graph.outputs)]
      .filter(
        (binding): binding is Extract<RuleInputBinding, { kind: 'FACT' }> => binding.kind === 'FACT'
      )
      .map((binding) => binding.factKey)
  )
}

/** Validates and retains only the graph facts that can affect execution evidence. */
export function freezeRuleGraphFacts(
  graph: CompiledRuleGraph,
  facts: Readonly<Record<string, RuleValue>>
): Record<string, RuleValue> {
  const contracts = new Map(graph.factContracts.map((fact) => [fact.key, fact]))
  for (const [key, value] of Object.entries(facts)) {
    const contract = contracts.get(key)
    if (!contract)
      throw new RuleKernelError(`Runtime fact "${key}" is not declared by the Game System.`)
    if (!valueMatchesKind(value, contract.valueKind))
      throw new RuleKernelError(`Runtime fact "${key}" must be ${contract.valueKind}.`)
  }
  const frozen: Record<string, RuleValue> = {}
  for (const key of requiredRuleGraphFacts(graph)) {
    const contract = contracts.get(key)
    const value = facts[key]
    if (!contract || value === undefined)
      throw new RuleKernelError(`Required runtime fact "${key}" is missing.`)
    if (!valueMatchesKind(value, contract.valueKind))
      throw new RuleKernelError(`Runtime fact "${key}" must be ${contract.valueKind}.`)
    frozen[key] = value
  }
  return frozen
}

function copyGraph(graph: CompiledRuleGraph): CompiledRuleGraph {
  return {
    ...graph,
    source: { ...graph.source },
    factContracts: graph.factContracts.map((fact) => ({ ...fact })),
    nodes: graph.nodes.map((node) => ({
      ...node,
      operation: { ...node.operation },
      inputs: Object.fromEntries(
        Object.entries(node.inputs).map(([key, binding]) => [key, { ...binding }])
      )
    })),
    outputs: Object.fromEntries(
      Object.entries(graph.outputs).map(([key, binding]) => [key, { ...binding }])
    ),
    ...(graph.sourceEntryBindings
      ? {
          sourceEntryBindings: graph.sourceEntryBindings.map((binding) => ({
            ...binding
          }))
        }
      : {}),
    ...(graph.vocabularyBindings
      ? {
          vocabularyBindings: graph.vocabularyBindings.map((binding) => ({ ...binding }))
        }
      : {})
  }
}

function copyTrace(trace: readonly RuleExecutionTraceEntry[]): RuleExecutionTraceEntry[] {
  return trace.map((entry) => ({
    ...entry,
    operation: { ...entry.operation },
    inputs: { ...entry.inputs },
    outputs: { ...entry.outputs },
    ...(entry.evidence ? { evidence: { ...entry.evidence } } : {})
  }))
}

function validateOperationInputs(
  operation: ReturnType<RuleOperationRegistry['require']>,
  inputs: Readonly<Record<string, RuleValue>>
): void {
  for (const [port, kind] of Object.entries(operation.inputs)) {
    const value = inputs[port]
    if (value === undefined || !valueMatchesKind(value, kind))
      throw new RuleKernelError(`Operation "${operation.key}" input "${port}" must be ${kind}.`)
  }
}

function validateOperationOutputs(
  operation: ReturnType<RuleOperationRegistry['require']>,
  outputs: Readonly<Record<string, RuleValue>>
): void {
  const outputPorts = Object.keys(operation.outputs)
  if (
    Object.keys(outputs).length !== outputPorts.length ||
    outputPorts.some((port) => !Object.hasOwn(outputs, port))
  )
    throw new RuleKernelError(`Operation "${operation.key}" returned an invalid output shape.`)
  for (const [port, kind] of Object.entries(operation.outputs)) {
    const value = outputs[port]
    if (value === undefined || !valueMatchesKind(value, kind))
      throw new RuleKernelError(`Operation "${operation.key}" output "${port}" must be ${kind}.`)
  }
}

function requestForNode(input: {
  occurrenceId: string
  nodeId: string
  ordinal: number
  min: number
  max: number
}): RuleIntegerRangeEvidenceRequest {
  if (!Number.isInteger(input.min) || !Number.isInteger(input.max) || input.min > input.max)
    throw new RuleKernelError('Integer-range evidence bounds must be ordered integers.')
  return {
    requestId: `${input.occurrenceId}:${input.ordinal}:${input.nodeId}`,
    kind: 'INTEGER_RANGE',
    nodeId: input.nodeId,
    ordinal: input.ordinal,
    min: input.min,
    max: input.max
  }
}

function continueExecution(input: {
  graph: CompiledRuleGraph
  occurrenceId: string
  facts: Readonly<Record<string, RuleValue>>
  nextNodeIndex: number
  nodeOutputs: Map<string, Readonly<Record<string, RuleValue>>>
  trace: RuleExecutionTraceEntry[]
  operations: RuleOperationRegistry
  response?: { requestId: string; value: number }
}): RuleExecutionResult {
  let response = input.response
  for (let index = input.nextNodeIndex; index < input.graph.nodes.length; index += 1) {
    const node = input.graph.nodes[index]!
    const operation = input.operations.require(node.operation)
    const resolvedInputs = Object.fromEntries(
      Object.entries(node.inputs).map(([port, binding]) => [
        port,
        resolveBinding({
          binding,
          facts: input.facts,
          nodeOutputs: input.nodeOutputs
        })
      ])
    )
    validateOperationInputs(operation, resolvedInputs)
    if (operation.executionKind === 'EVIDENCE') {
      const descriptor = operation.evidence
      if (
        descriptor.enabledInput !== undefined &&
        resolvedInputs[descriptor.enabledInput] === false
      ) {
        const outputs = { [descriptor.valueOutput]: resolvedInputs[descriptor.minInput] as number }
        validateOperationOutputs(operation, outputs)
        input.nodeOutputs.set(node.id, outputs)
        input.trace.push({
          nodeId: node.id,
          operation: node.operation,
          inputs: resolvedInputs,
          outputs
        })
        continue
      }
      const request = requestForNode({
        occurrenceId: input.occurrenceId,
        nodeId: node.id,
        ordinal: index,
        min: resolvedInputs[descriptor.minInput] as number,
        max: resolvedInputs[descriptor.maxInput] as number
      })
      if (!response) {
        return {
          status: 'PAUSED',
          continuation: {
            schemaVersion: 1,
            occurrenceId: input.occurrenceId,
            graph: copyGraph(input.graph),
            facts: { ...input.facts },
            nextNodeIndex: index,
            nodeOutputs: Object.fromEntries(
              [...input.nodeOutputs].map(([key, value]) => [key, { ...value }])
            ),
            trace: copyTrace(input.trace),
            request,
            authority: 'APPLICATION_SERVICE',
            redaction: 'SERVER_ONLY'
          }
        }
      }
      if (
        response.requestId !== request.requestId ||
        !Number.isInteger(response.value) ||
        response.value < request.min ||
        response.value > request.max
      )
        throw new RuleKernelError('Evidence response does not exactly satisfy the issued request.')
      const outputs = { [descriptor.valueOutput]: response.value }
      validateOperationOutputs(operation, outputs)
      input.nodeOutputs.set(node.id, outputs)
      input.trace.push({
        nodeId: node.id,
        operation: node.operation,
        inputs: resolvedInputs,
        outputs,
        evidence: {
          requestId: request.requestId,
          kind: request.kind,
          value: response.value
        }
      })
      response = undefined
      continue
    }
    // Proposal operations are deterministic scalar transforms. Their meaning
    // remains outside the kernel and is interpreted only after completion by
    // a server-owned application service.
    const outputs = operation.execute(resolvedInputs)
    validateOperationOutputs(operation, outputs)
    input.nodeOutputs.set(node.id, outputs)
    input.trace.push({
      nodeId: node.id,
      operation: node.operation,
      inputs: resolvedInputs,
      outputs
    })
  }
  if (response)
    throw new RuleKernelError('Evidence response did not match a pending evidence operation.')
  const outputs = Object.fromEntries(
    Object.entries(input.graph.outputs).map(([key, binding]) => [
      key,
      resolveBinding({
        binding,
        facts: input.facts,
        nodeOutputs: input.nodeOutputs
      })
    ])
  )
  return {
    status: 'COMPLETE',
    outputs,
    evidence: {
      source: input.graph.source,
      capabilityContractVersion: input.graph.capabilityContractVersion,
      facts: { ...input.facts },
      trace: input.trace,
      outputs,
      ...(input.graph.sourceEntryBindings
        ? {
            sourceEntryBindings: input.graph.sourceEntryBindings.map((binding) => ({ ...binding }))
          }
        : {}),
      ...(input.graph.vocabularyBindings
        ? {
            vocabularyBindings: input.graph.vocabularyBindings.map((binding) => ({ ...binding }))
          }
        : {})
    }
  }
}

export function executeRuleGraph(input: {
  graph: CompiledRuleGraph
  occurrenceId: string
  facts: Readonly<Record<string, RuleValue>>
  operations: RuleOperationRegistry
}): RuleExecutionResult {
  if (!UUID_PATTERN.test(input.occurrenceId))
    throw new RuleKernelError('Rule occurrence identity must be a UUID.')
  return continueExecution({
    graph: input.graph,
    occurrenceId: input.occurrenceId,
    facts: freezeRuleGraphFacts(input.graph, input.facts),
    nextNodeIndex: 0,
    nodeOutputs: new Map(),
    trace: [],
    operations: input.operations
  })
}

export function resumeRuleGraph(input: {
  continuation: RuleExecutionContinuation
  response: { requestId: string; value: number }
  operations: RuleOperationRegistry
}): RuleExecutionResult {
  const continuation = input.continuation
  if (
    continuation.schemaVersion !== 1 ||
    !UUID_PATTERN.test(continuation.occurrenceId) ||
    continuation.authority !== 'APPLICATION_SERVICE' ||
    continuation.redaction !== 'SERVER_ONLY' ||
    !Number.isInteger(continuation.nextNodeIndex) ||
    continuation.nextNodeIndex < 0 ||
    continuation.nextNodeIndex >= continuation.graph.nodes.length ||
    continuation.request.ordinal !== continuation.nextNodeIndex ||
    continuation.request.nodeId !== continuation.graph.nodes[continuation.nextNodeIndex]?.id ||
    continuation.trace.length !== continuation.nextNodeIndex ||
    continuation.trace.some((entry, index) => entry.nodeId !== continuation.graph.nodes[index]?.id)
  )
    throw new RuleKernelError('Rule continuation has an unsupported contract.')
  return continueExecution({
    graph: continuation.graph,
    occurrenceId: continuation.occurrenceId,
    facts: freezeRuleGraphFacts(continuation.graph, continuation.facts),
    nextNodeIndex: continuation.nextNodeIndex,
    nodeOutputs: new Map(
      Object.entries(continuation.nodeOutputs).map(([key, value]) => [key, { ...value }])
    ),
    trace: copyTrace(continuation.trace),
    operations: input.operations,
    response: input.response
  })
}
