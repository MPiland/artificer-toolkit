import type { CoreMeta } from '#core'
import { valuesOf } from '#utils'

export const TARGET_SELECTION_KIND = {
  SELF: 'SELF',
  SINGLE_TARGET: 'SINGLE_TARGET',
  CHOSEN_CREATURES: 'CHOSEN_CREATURES',
  AREA_CONTENTS: 'AREA_CONTENTS'
} as const

export type TargetSelectionKind = keyof typeof TARGET_SELECTION_KIND

export type TargetSelectionKindOption = CoreMeta<TargetSelectionKind>

export const TARGET_SELECTION_KIND_REGISTRY: Record<
  TargetSelectionKind,
  TargetSelectionKindOption
> = {
  [TARGET_SELECTION_KIND.SELF]: {
    code: TARGET_SELECTION_KIND.SELF,
    label: 'Self',
    tooltip: 'The effect targets the source only.',
    description: 'The effect targets the source only.'
  },
  [TARGET_SELECTION_KIND.SINGLE_TARGET]: {
    code: TARGET_SELECTION_KIND.SINGLE_TARGET,
    label: 'Single Target',
    tooltip: 'Choose a single target.',
    description: 'The effect chooses a single target.'
  },
  [TARGET_SELECTION_KIND.CHOSEN_CREATURES]: {
    code: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
    label: 'Chosen Creatures',
    tooltip: 'Choose one or more creatures as targets.',
    description: 'The effect chooses one or more creatures as targets.'
  },
  [TARGET_SELECTION_KIND.AREA_CONTENTS]: {
    code: TARGET_SELECTION_KIND.AREA_CONTENTS,
    label: 'Area Contents',
    tooltip: 'The effect affects creatures or objects within an area.',
    description: 'The effect affects creatures or objects within an area.'
  }
} as const

export const TARGET_SELECTION_KIND_OPTIONS = valuesOf(
  TARGET_SELECTION_KIND_REGISTRY
) as readonly TargetSelectionKindOption[]

export const TARGET_DISPOSITION_KIND = {
  ANY: 'ANY',
  WILLING: 'WILLING',
  HOSTILE: 'HOSTILE'
} as const

export type TargetDispositionKind = keyof typeof TARGET_DISPOSITION_KIND

export type TargetDispositionKindOption = CoreMeta<TargetDispositionKind>

export const TARGET_DISPOSITION_KIND_REGISTRY: Record<
  TargetDispositionKind,
  TargetDispositionKindOption
> = {
  [TARGET_DISPOSITION_KIND.ANY]: {
    code: TARGET_DISPOSITION_KIND.ANY,
    label: 'Any valid target',
    tooltip: 'Any valid target can be affected.',
    description: 'Any valid target can be selected.'
  },
  [TARGET_DISPOSITION_KIND.WILLING]: {
    code: TARGET_DISPOSITION_KIND.WILLING,
    label: 'Willing targets only',
    tooltip: 'Only willing targets can be affected.',
    description: 'Only willing targets can be selected.'
  },
  [TARGET_DISPOSITION_KIND.HOSTILE]: {
    code: TARGET_DISPOSITION_KIND.HOSTILE,
    label: 'Hostile targets only',
    tooltip: 'Only hostile targets can be affected.',
    description: 'Only hostile targets can be selected.'
  }
} as const

export const TARGET_DISPOSITION_KIND_OPTIONS = valuesOf(
  TARGET_DISPOSITION_KIND_REGISTRY
) as readonly TargetDispositionKindOption[]
