import type { CoreMeta } from './core.js'

export const AUTHORING_MODE_KIND = {
  ALL: 'ALL', // All valid options are allowed
  SELECTED: 'SELECTED' // Author picks which options are allowed
} as const

export type AuthoringModeKind = keyof typeof AUTHORING_MODE_KIND

export type AuthoringModeOption = CoreMeta<AuthoringModeKind>

export const AUTHORING_MODE_KIND_REGISTRY: Record<
  AuthoringModeKind,
  AuthoringModeOption
> = {
  [AUTHORING_MODE_KIND.ALL]: {
    code: AUTHORING_MODE_KIND.ALL,
    label: 'All',
    tooltip: 'All eligible options are granted automatically.',
    description:
      'Every option that meets the current restrictions is granted. '
      + 'No selection is required.'
  },

  [AUTHORING_MODE_KIND.SELECTED]: {
    code: AUTHORING_MODE_KIND.SELECTED,
    label: 'Selected',
    tooltip: 'Only selected options are ed.',
    description:
      'Only the explicitly selected options are granted. '
      + 'The available options may be Targeted by restrictions.'
  }
}

export const AUTHORING_MODE_KIND_OPTIONS = Object.values(
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
    tooltip: 'Condition must be satisfied.',
    description: 'The Target or restriction requires the condition to be true.'
  },

  [AUTHORING_CONSTRAINT.EXCLUDE]: {
    code: AUTHORING_CONSTRAINT.EXCLUDE,
    label: 'Must Not Match',
    tooltip: 'Condition must not be satisfied.',
    description: 'The restriction requires the condition to be false.'
  }
} as const

export const AUTHORING_SELECTION_KIND = {
  GRANTED: 'GRANTED', // Automatically applied
  CHOSEN: 'CHOSEN' // Player chooses
} as const

export type AuthoringSelectionKind = keyof typeof AUTHORING_SELECTION_KIND

export type AuthoringSelectionOption = CoreMeta<AuthoringSelectionKind>

export const GRANT_SELECTION_REGISTRY: Record<
  AuthoringSelectionKind,
  AuthoringSelectionOption
> = {
  [AUTHORING_SELECTION_KIND.GRANTED]: {
    code: AUTHORING_SELECTION_KIND.GRANTED,
    label: 'Automatically Granted',
    tooltip:
      'This option is automatically applied and does not require a choice.',
    description:
      'The player does not make a selection. This grant is applied automatically when it becomes available.'
  },

  [AUTHORING_SELECTION_KIND.CHOSEN]: {
    code: AUTHORING_SELECTION_KIND.CHOSEN,
    label: 'Player Chooses',
    tooltip: 'The player chooses one or more options.',
    description:
      'The player must select which option(s) to gain from the available choices.'
  }
} as const
