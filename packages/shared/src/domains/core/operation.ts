import type { CoreMeta } from './core.js'
import { valuesOf } from '#utils'

export const OPTIONAL_LOGIC_CODE = {
  AND: 'AND',
  OR: 'OR'
} as const

export type OptionalLogicCode = keyof typeof OPTIONAL_LOGIC_CODE

export type OptionalLogicOption = CoreMeta<OptionalLogicCode>

export const OPERATIONAL_LOGIC_REGISTRY: Record<OptionalLogicCode, OptionalLogicOption> = {
  [OPTIONAL_LOGIC_CODE.AND]: {
    code: OPTIONAL_LOGIC_CODE.AND,
    label: 'And',
    description: 'This is included with the other options for this section.',
    tooltip: 'Required option(s).'
  },

  [OPTIONAL_LOGIC_CODE.OR]: {
    code: OPTIONAL_LOGIC_CODE.OR,
    label: 'Or',
    description: 'Can be chosen as the option for this section instead of the other option(s)',
    tooltip: 'Optionally chosen option(s).'
  }
} as const

export const OPERATION_CODE = {
  ADD: 'ADD',
  SUBTRACT: 'SUBTRACT',
  MULTIPLY: 'MULTIPLY',
  DIVIDE: 'DIVIDE',
  SET: 'SET',
  REPLACE: 'REPLACE'
} as const

export type OperationCode = keyof typeof OPERATION_CODE

export type OperationOption = CoreMeta<OperationCode>

export const OPERATIONS_REGISTRY: Record<OperationCode, OperationOption> = {
  [OPERATION_CODE.ADD]: {
    code: OPERATION_CODE.ADD,
    label: 'Add',
    description: 'Adds a value to an existing value.',
    tooltip: 'Add a value.'
  },

  [OPERATION_CODE.SUBTRACT]: {
    code: OPERATION_CODE.SUBTRACT,
    label: 'Subtract',
    description: 'Subtracts a value from an existing value.',
    tooltip: 'Subtract a value.'
  },

  [OPERATION_CODE.MULTIPLY]: {
    code: OPERATION_CODE.MULTIPLY,
    label: 'Multiply',
    description: 'Multiplies an existing value by a specified factor.',
    tooltip: 'Multiply a value.'
  },

  [OPERATION_CODE.DIVIDE]: {
    code: OPERATION_CODE.DIVIDE,
    label: 'Divide',
    description: 'Divides an existing value by a specified factor.',
    tooltip: 'Divide a value.'
  },

  [OPERATION_CODE.SET]: {
    code: OPERATION_CODE.SET,
    label: 'Set',
    description: 'Sets a value to a specific amount, overriding previous values.',
    tooltip: 'Set a value.'
  },

  [OPERATION_CODE.REPLACE]: {
    code: OPERATION_CODE.REPLACE,
    label: 'Replace',
    description: 'Replaces an existing value or component with a new one.',
    tooltip: 'Replace an existing value.'
  }
} as const

export const OPERATIONS_OPTIONS = valuesOf(OPERATIONS_REGISTRY) as readonly OperationOption[]
