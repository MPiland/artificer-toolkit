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
    description: 'Required option(s).'
  },

  [OPTIONAL_LOGIC_CODE.OR]: {
    code: OPTIONAL_LOGIC_CODE.OR,
    label: 'Or',
    description: 'Optionally chosen option(s).'
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
    description: 'Add a value.'
  },

  [OPERATION_CODE.SUBTRACT]: {
    code: OPERATION_CODE.SUBTRACT,
    label: 'Subtract',
    description: 'Subtract a value.'
  },

  [OPERATION_CODE.MULTIPLY]: {
    code: OPERATION_CODE.MULTIPLY,
    label: 'Multiply',
    description: 'Multiply a value.'
  },

  [OPERATION_CODE.DIVIDE]: {
    code: OPERATION_CODE.DIVIDE,
    label: 'Divide',
    description: 'Divide a value.'
  },

  [OPERATION_CODE.SET]: {
    code: OPERATION_CODE.SET,
    label: 'Set',
    description: 'Set a value.'
  },

  [OPERATION_CODE.REPLACE]: {
    code: OPERATION_CODE.REPLACE,
    label: 'Replace',
    description: 'Replace an existing value.'
  }
} as const

export const OPERATIONS_OPTIONS = valuesOf(OPERATIONS_REGISTRY) as readonly OperationOption[]
