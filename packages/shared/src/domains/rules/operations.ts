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
 * An `evidence.integer-range` that asks for its value only while `enabled` is true; otherwise it
 * settles at `min` without a request. A test asks for a second face this way only when a fact says
 * its roll mode keeps one of two.
 */
export const optionalIntegerRangeEvidenceRuleOperation = {
  key: 'evidence.optional-integer-range',
  contractVersion: 1,
  inputs: {
    min: RULE_VALUE_KIND.NUMBER,
    max: RULE_VALUE_KIND.NUMBER,
    enabled: RULE_VALUE_KIND.BOOLEAN
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  executionKind: 'EVIDENCE',
  evidence: {
    kind: 'INTEGER_RANGE',
    minInput: 'min',
    maxInput: 'max',
    valueOutput: 'value',
    enabledInput: 'enabled'
  }
} satisfies RuleOperationContract

/**
 * The signed total of the dice a holder adds to a test after its roll mode keeps one face. `min` and
 * `max` bound the signed sum; it asks for the total only while `enabled` is true and otherwise
 * settles at `min` (0) without a request. A key of its own keeps it apart from the face requests,
 * which share the integer-range keys.
 */
export const addedDiceTotalEvidenceRuleOperation = {
  key: 'evidence.added-dice-total',
  contractVersion: 1,
  inputs: {
    min: RULE_VALUE_KIND.NUMBER,
    max: RULE_VALUE_KIND.NUMBER,
    enabled: RULE_VALUE_KIND.BOOLEAN
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  executionKind: 'EVIDENCE',
  evidence: {
    kind: 'INTEGER_RANGE',
    minInput: 'min',
    maxInput: 'max',
    valueOutput: 'value',
    enabledInput: 'enabled'
  }
} satisfies RuleOperationContract

/** Keeps one of two rolled faces: the first, the higher or the lower, as the System's roll mode says. */
export const keepOneOfTwoRuleOperation = {
  key: 'number.keep-one-of-two',
  contractVersion: 1,
  inputs: {
    first: RULE_VALUE_KIND.NUMBER,
    second: RULE_VALUE_KIND.NUMBER,
    keep: RULE_VALUE_KIND.TEXT
  },
  outputs: { value: RULE_VALUE_KIND.NUMBER },
  executionKind: 'PURE',
  execute(inputs) {
    const first = requireNumber(inputs, 'first')
    const second = requireNumber(inputs, 'second')
    switch (inputs.keep) {
      case 'FIRST':
        return { value: first }
      case 'HIGHER':
        return { value: Math.max(first, second) }
      case 'LOWER':
        return { value: Math.min(first, second) }
      default:
        throw new Error('Rule operation input "keep" must be FIRST, HIGHER or LOWER.')
    }
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
  optionalIntegerRangeEvidenceRuleOperation,
  addedDiceTotalEvidenceRuleOperation,
  keepOneOfTwoRuleOperation,
  boundedChoiceIndexEvidenceRuleOperation
] as const satisfies readonly RuleOperationContract[]
