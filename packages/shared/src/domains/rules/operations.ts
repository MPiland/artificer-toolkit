import { RULE_VALUE_KIND, type RuleValue } from './contracts.js'
import type { RuleOperationContract } from './operationRegistry.js'

function requireNumber(inputs: Readonly<Record<string, RuleValue>>, port: string): number {
  const value = inputs[port]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Rule operation input "${port}" must be a finite number.`)
  }
  return value
}

export const addNumbersRuleOperation = {
  key: 'number.add',
  contractVersion: 1,
  inputs: {
    left: RULE_VALUE_KIND.NUMBER,
    right: RULE_VALUE_KIND.NUMBER
  },
  outputs: {
    value: RULE_VALUE_KIND.NUMBER
  },
  executionKind: 'PURE',
  execute(inputs) {
    return { value: requireNumber(inputs, 'left') + requireNumber(inputs, 'right') }
  }
} satisfies RuleOperationContract

export const compareThresholdRuleOperation = {
  key: 'number.compare-threshold',
  contractVersion: 1,
  inputs: {
    value: RULE_VALUE_KIND.NUMBER,
    threshold: RULE_VALUE_KIND.NUMBER
  },
  outputs: {
    passed: RULE_VALUE_KIND.BOOLEAN,
    margin: RULE_VALUE_KIND.NUMBER
  },
  executionKind: 'PURE',
  execute(inputs) {
    const value = requireNumber(inputs, 'value')
    const threshold = requireNumber(inputs, 'threshold')
    return {
      passed: value >= threshold,
      margin: value - threshold
    }
  }
} satisfies RuleOperationContract

export const integerRangeEvidenceRuleOperation = {
  key: 'evidence.integer-range',
  contractVersion: 1,
  inputs: { min: RULE_VALUE_KIND.NUMBER, max: RULE_VALUE_KIND.NUMBER },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  executionKind: 'EVIDENCE',
  evidence: {
    kind: 'INTEGER_RANGE',
    minInput: 'min',
    maxInput: 'max',
    valueOutput: 'value'
  }
} satisfies RuleOperationContract

/**
 * Requests one index from an application-owned, frozen option list. The
 * application context owns option identities, labels, authority, and
 * redaction; the portable kernel only validates and records the bounded
 * selection.
 */
export const boundedChoiceIndexEvidenceRuleOperation = {
  key: 'evidence.bounded-choice-index',
  contractVersion: 1,
  inputs: { minIndex: RULE_VALUE_KIND.NUMBER, maxIndex: RULE_VALUE_KIND.NUMBER },
  outputs: { selectedIndex: RULE_VALUE_KIND.NUMBER },
  executionKind: 'EVIDENCE',
  evidence: {
    kind: 'INTEGER_RANGE',
    minInput: 'minIndex',
    maxInput: 'maxIndex',
    valueOutput: 'selectedIndex'
  }
} satisfies RuleOperationContract

export const coreRuleOperations = [
  addNumbersRuleOperation,
  compareThresholdRuleOperation,
  integerRangeEvidenceRuleOperation,
  boundedChoiceIndexEvidenceRuleOperation
] as const satisfies readonly RuleOperationContract[]
