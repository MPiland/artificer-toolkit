import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  checksumRuleDocument,
  selectNumberRuleOperation,
  type RuleValue
} from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionSystemAdapter } from '../../characterRuleActionSystemAdapter.js'
import {
  Dnd5eEffectActionCompilerError,
  ROLL_TABLE_FACE_OUTPUT,
  ROLL_TABLE_TEST_NODE_PREFIX
} from './effectActionContracts.js'
import {
  dnd5eMovementInterruptionAuthorizationOperation,
  dnd5eRollTableRerollFaceOperation,
  dnd5eRollTableRowGateOperation
} from './effectActionOperationRegistry.js'

const ROLL_TABLE_TEST_OPERATIONS = new Map<
  string,
  { execute: (inputs: Readonly<Record<string, RuleValue>>) => Record<string, RuleValue> }
>(
  [
    dnd5eMovementInterruptionAuthorizationOperation,
    selectNumberRuleOperation,
    dnd5eRollTableRowGateOperation,
    dnd5eRollTableRerollFaceOperation
  ].map((operation) => [operation.key, operation])
)

/**
 * The die and rerolls a repeat table rolls in the TEST graph: each node's inputs are what its
 * committed bindings resolve to, a pure node re-executes to its outputs, and an integer request is
 * answered only when its enabling node authorizes it. The rolled faces then equal the execution's
 * `rollTableFace_*` outputs, which the OUTCOME's specialisation reads.
 */
export function requireRollTableTestTraces(input: {
  traces: Parameters<
    CharacterRuleActionSystemAdapter['interpret']
  >[0]['execution']['evidence']['trace']
  published: ServerPublishedRuleDefinitionDto
  occurrenceId: string
  outputs: Readonly<Record<string, RuleValue>>
}): void {
  const { traces, published, occurrenceId } = input
  const invalid = () =>
    new Dnd5eEffectActionCompilerError('The committed D&D roll table dice topology is invalid.')
  const nodeIds = published.definition.nodes.map((node) => node.id)
  const traceOf = (nodeId: string) => traces.find((trace) => trace.nodeId === nodeId)
  const resolve = (
    binding: ServerPublishedRuleDefinitionDto['definition']['nodes'][number]['inputs'][string]
  ) => {
    if (binding?.kind === 'LITERAL') return binding.value
    if (binding?.kind === 'NODE_OUTPUT') {
      const source = traceOf(binding.nodeId)
      if (!source) throw invalid()
      return source.outputs[binding.port]
    }
    throw invalid()
  }
  for (const trace of traces) {
    if (trace.nodeId === 'test') continue
    const node = published.definition.nodes.find(({ id }) => id === trace.nodeId)
    if (!node) throw invalid()
    const inputs = Object.fromEntries(
      Object.entries(node.inputs).map(([port, binding]) => [port, resolve(binding)])
    )
    if (
      node.operation.key !== trace.operation.key ||
      node.operation.contractVersion !== trace.operation.contractVersion ||
      checksumRuleDocument(inputs) !== checksumRuleDocument(trace.inputs)
    )
      throw invalid()
    if (trace.operation.key === 'evidence.optional-integer-range') {
      const { min, max, enabled } = trace.inputs
      const value = trace.outputs.value
      const answered = trace.evidence
      if (
        typeof min !== 'number' ||
        typeof max !== 'number' ||
        typeof value !== 'number' ||
        (enabled === true
          ? answered?.kind !== 'INTEGER_RANGE' ||
            answered.value !== value ||
            answered.requestId !==
              `${occurrenceId}:${nodeIds.indexOf(trace.nodeId)}:${trace.nodeId}` ||
            value < min ||
            value > max
          : answered !== undefined || value !== min)
      )
        throw invalid()
      continue
    }
    const operation = ROLL_TABLE_TEST_OPERATIONS.get(trace.operation.key)
    if (
      !operation ||
      trace.evidence !== undefined ||
      checksumRuleDocument(operation.execute(trace.inputs)) !== checksumRuleDocument(trace.outputs)
    )
      throw invalid()
  }
  for (const [name, binding] of Object.entries(published.definition.outputs)) {
    if (!ROLL_TABLE_FACE_OUTPUT.test(name)) continue
    if (
      binding.kind !== 'NODE_OUTPUT' ||
      !traceOf(binding.nodeId)?.nodeId.startsWith(ROLL_TABLE_TEST_NODE_PREFIX) ||
      input.outputs[name] !== traceOf(binding.nodeId)?.outputs[binding.port]
    )
      throw invalid()
  }
}
