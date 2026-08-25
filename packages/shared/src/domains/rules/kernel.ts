import {
  type CompiledRuleGraph,
  type CompletedRuleExecution,
  type RuleInputBinding,
  type RuleValue
} from './contracts.js'
import { valueMatchesKind, type RuleOperationRegistry } from './operationRegistry.js'

export class RuleKernelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleKernelError'
  }
}

function resolveBinding(input: {
  binding: RuleInputBinding
  facts: Readonly<Record<string, RuleValue>>
  nodeOutputs: ReadonlyMap<string, Readonly<Record<string, RuleValue>>>
}): RuleValue {
  switch (input.binding.kind) {
    case 'FACT': {
      const value = input.facts[input.binding.factKey]
      if (value === undefined) {
        throw new RuleKernelError(`Required runtime fact "${input.binding.factKey}" is missing.`)
      }
      return value
    }
    case 'LITERAL':
      return input.binding.value
    case 'NODE_OUTPUT': {
      const value = input.nodeOutputs.get(input.binding.nodeId)?.[input.binding.port]
      if (value === undefined) {
        throw new RuleKernelError(
          `Node output "${input.binding.nodeId}.${input.binding.port}" is unavailable.`
        )
      }
      return value
    }
  }
}

export function executeRuleGraph(input: {
  graph: CompiledRuleGraph
  facts: Readonly<Record<string, RuleValue>>
  operations: RuleOperationRegistry
}): CompletedRuleExecution {
  const factContracts = new Map(input.graph.factContracts.map((fact) => [fact.key, fact]))
  for (const [key, value] of Object.entries(input.facts)) {
    const contract = factContracts.get(key)
    if (!contract)
      throw new RuleKernelError(`Runtime fact "${key}" is not declared by the Game System.`)
    if (!valueMatchesKind(value, contract.valueKind)) {
      throw new RuleKernelError(`Runtime fact "${key}" must be ${contract.valueKind}.`)
    }
  }

  const usedFactKeys = new Set<string>()
  for (const binding of [
    ...input.graph.nodes.flatMap((node) => Object.values(node.inputs)),
    ...Object.values(input.graph.outputs)
  ]) {
    if (binding.kind === 'FACT') usedFactKeys.add(binding.factKey)
  }
  const consumedFacts: Record<string, RuleValue> = {}
  for (const fact of input.graph.factContracts) {
    const value = input.facts[fact.key]
    if (usedFactKeys.has(fact.key) && value !== undefined) consumedFacts[fact.key] = value
  }

  const nodeOutputs = new Map<string, Readonly<Record<string, RuleValue>>>()
  const trace = []
  for (const node of input.graph.nodes) {
    const operation = input.operations.require(node.operation)
    const resolvedInputs = Object.fromEntries(
      Object.entries(node.inputs).map(([port, binding]) => [
        port,
        resolveBinding({ binding, facts: input.facts, nodeOutputs })
      ])
    )
    for (const [port, kind] of Object.entries(operation.inputs)) {
      const value = resolvedInputs[port]
      if (value === undefined || !valueMatchesKind(value, kind)) {
        throw new RuleKernelError(`Operation "${operation.key}" input "${port}" must be ${kind}.`)
      }
    }

    const outputs = operation.execute(resolvedInputs)
    const outputPorts = Object.keys(operation.outputs)
    if (
      Object.keys(outputs).length !== outputPorts.length ||
      outputPorts.some((port) => !Object.hasOwn(outputs, port))
    ) {
      throw new RuleKernelError(`Operation "${operation.key}" returned an invalid output shape.`)
    }
    for (const [port, kind] of Object.entries(operation.outputs)) {
      const value = outputs[port]
      if (value === undefined || !valueMatchesKind(value, kind)) {
        throw new RuleKernelError(`Operation "${operation.key}" output "${port}" must be ${kind}.`)
      }
    }

    nodeOutputs.set(node.id, outputs)
    trace.push({ nodeId: node.id, operation: node.operation, inputs: resolvedInputs, outputs })
  }

  const outputs = Object.fromEntries(
    Object.entries(input.graph.outputs).map(([key, binding]) => [
      key,
      resolveBinding({ binding, facts: input.facts, nodeOutputs })
    ])
  )

  return {
    status: 'COMPLETE',
    outputs,
    evidence: {
      source: input.graph.source,
      capabilityContractVersion: input.graph.capabilityContractVersion,
      facts: consumedFacts,
      trace,
      outputs
    }
  }
}
