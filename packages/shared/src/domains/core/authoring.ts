import { valuesOf } from '#utils'
import type { CoreMeta } from './core.js'

export const AUTHORING_MODE_KIND = {
  ALL: 'ALL', // All valid options are allowed
  SELECTED: 'SELECTED' // Author picks which options are allowed
} as const

export type AuthoringModeKind = keyof typeof AUTHORING_MODE_KIND

export type AuthoringModeOption = CoreMeta<AuthoringModeKind>

export const AUTHORING_MODE_KIND_REGISTRY: Record<AuthoringModeKind, AuthoringModeOption> = {
  [AUTHORING_MODE_KIND.ALL]: {
    code: AUTHORING_MODE_KIND.ALL,
    label: 'All',
    description: 'All eligible options are granted automatically.'
  },

  [AUTHORING_MODE_KIND.SELECTED]: {
    code: AUTHORING_MODE_KIND.SELECTED,
    label: 'Selected',
    description: 'Only selected options are ed.'
  }
}

export const AUTHORING_MODE_KIND_OPTIONS = valuesOf(
  AUTHORING_MODE_KIND_REGISTRY
) as AuthoringModeOption[]

export const AUTHORING_CONSTRAINT = {
  INCLUDE: 'INCLUDE',
  EXCLUDE: 'EXCLUDE'
} as const

export type AuthoringConstraintCode = keyof typeof AUTHORING_CONSTRAINT

export type AuthoringConstraintOption = CoreMeta<AuthoringConstraintCode>

export const AUTHORING_CONSTRAINT_REGISTRY: Record<
  AuthoringConstraintCode,
  AuthoringConstraintOption
> = {
  [AUTHORING_CONSTRAINT.INCLUDE]: {
    code: AUTHORING_CONSTRAINT.INCLUDE,
    label: 'Must Match',
    description: 'Condition must be satisfied.'
  },

  [AUTHORING_CONSTRAINT.EXCLUDE]: {
    code: AUTHORING_CONSTRAINT.EXCLUDE,
    label: 'Must Not Match',
    description: 'Condition must not be satisfied.'
  }
} as const

export const AUTHORING_CONSTRAINT_OPTIONS = valuesOf(AUTHORING_CONSTRAINT_REGISTRY)

export const AUTHORING_SELECTION_KIND = {
  GRANTED: 'GRANTED', // Automatically applied
  CHOSEN: 'CHOSEN' // Player chooses
} as const

export type AuthoringSelectionKind = keyof typeof AUTHORING_SELECTION_KIND

export type AuthoringSelectionOption = CoreMeta<AuthoringSelectionKind>

export const AUTHORING_SELECTION_REGISTRY: Record<
  AuthoringSelectionKind,
  AuthoringSelectionOption
> = {
  [AUTHORING_SELECTION_KIND.GRANTED]: {
    code: AUTHORING_SELECTION_KIND.GRANTED,
    label: 'Automatically Granted',
    description: 'This option is automatically applied and does not require a choice.'
  },

  [AUTHORING_SELECTION_KIND.CHOSEN]: {
    code: AUTHORING_SELECTION_KIND.CHOSEN,
    label: 'Player Chooses',
    description: 'The player chooses one or more options.'
  }
} as const

export const AUTHORING_SELECTION_OPTIONS = valuesOf(AUTHORING_SELECTION_REGISTRY)

export const AUTHORING_SELECTION_DUPLICATE_POLICY = {
  UNIQUE: 'UNIQUE',
  REPEATABLE: 'REPEATABLE'
} as const

export type AuthoringSelectionDuplicatePolicy = keyof typeof AUTHORING_SELECTION_DUPLICATE_POLICY

export type AuthoringSelectionDuplicatePolicyOption = CoreMeta<AuthoringSelectionDuplicatePolicy>

export const AUTHORING_SELECTION_DUPLICATE_POLICY_REGISTRY: Record<
  AuthoringSelectionDuplicatePolicy,
  AuthoringSelectionDuplicatePolicyOption
> = {
  [AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE]: {
    code: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
    label: 'Unique',
    description: 'Each selected option must be different.'
  },

  [AUTHORING_SELECTION_DUPLICATE_POLICY.REPEATABLE]: {
    code: AUTHORING_SELECTION_DUPLICATE_POLICY.REPEATABLE,
    label: 'Repeatable',
    description: 'The same option may be selected more than once.'
  }
} as const

export const AUTHORING_SELECTION_DUPLICATE_POLICY_OPTIONS = valuesOf(
  AUTHORING_SELECTION_DUPLICATE_POLICY_REGISTRY
)
