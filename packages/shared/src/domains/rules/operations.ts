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
  execute(inputs) {
    const value = requireNumber(inputs, 'value')
    const threshold = requireNumber(inputs, 'threshold')
    return {
      passed: value >= threshold,
      margin: value - threshold
    }
  }
} satisfies RuleOperationContract

export const coreRuleOperations = [
  addNumbersRuleOperation,
  compareThresholdRuleOperation
] as const satisfies readonly RuleOperationContract[]
