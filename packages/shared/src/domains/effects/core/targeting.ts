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
    description: 'The effect targets the source only.'
  },
  [TARGET_SELECTION_KIND.SINGLE_TARGET]: {
    code: TARGET_SELECTION_KIND.SINGLE_TARGET,
    label: 'Single Target',
    description: 'Choose a single target.'
  },
  [TARGET_SELECTION_KIND.CHOSEN_CREATURES]: {
    code: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
    label: 'Chosen Creatures',
    description: 'Choose one or more creatures as targets.'
  },
  [TARGET_SELECTION_KIND.AREA_CONTENTS]: {
    code: TARGET_SELECTION_KIND.AREA_CONTENTS,
    label: 'Area Contents',
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
    description: 'Any valid target can be affected.'
  },
  [TARGET_DISPOSITION_KIND.WILLING]: {
    code: TARGET_DISPOSITION_KIND.WILLING,
    label: 'Willing targets only',
    description: 'Only willing targets can be affected.'
  },
  [TARGET_DISPOSITION_KIND.HOSTILE]: {
    code: TARGET_DISPOSITION_KIND.HOSTILE,
    label: 'Hostile targets only',
    description: 'Only hostile targets can be affected.'
  }
} as const

export const TARGET_DISPOSITION_KIND_OPTIONS = valuesOf(
  TARGET_DISPOSITION_KIND_REGISTRY
) as readonly TargetDispositionKindOption[]

export const TARGET_SELF_POLICY = {
  ALLOWED: 'ALLOWED',
  WARN: 'WARN',
  REFUSED: 'REFUSED'
} as const

export type TargetSelfPolicy = keyof typeof TARGET_SELF_POLICY

export type TargetSelfPolicyOption = CoreMeta<TargetSelfPolicy>

export const TARGET_SELF_POLICY_REGISTRY: Record<TargetSelfPolicy, TargetSelfPolicyOption> = {
  [TARGET_SELF_POLICY.ALLOWED]: {
    code: TARGET_SELF_POLICY.ALLOWED,
    label: 'Allowed',
    description: 'The user may name themself.'
  },
  [TARGET_SELF_POLICY.WARN]: {
    code: TARGET_SELF_POLICY.WARN,
    label: 'Warn',
    description: 'Naming the user warns, and can be overridden.'
  },
  [TARGET_SELF_POLICY.REFUSED]: {
    code: TARGET_SELF_POLICY.REFUSED,
    label: 'Refused',
    description: 'The user cannot name themself.'
  }
} as const

export const TARGET_SELF_POLICY_OPTIONS = valuesOf(
  TARGET_SELF_POLICY_REGISTRY
) as readonly TargetSelfPolicyOption[]
