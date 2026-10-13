import type {
  TargetDispositionKind,
  TargetSelectionKind,
  TargetSelfPolicy,
  ScalableValueAuthored
} from '#core'

export type TargetingAuthored =
  | {
      selectionKind: Extract<TargetSelectionKind, 'SELF'>
    }
  | {
      selectionKind: Extract<TargetSelectionKind, 'SINGLE_TARGET'>
      dispositionKind?: TargetDispositionKind
      /** Naming the user: allowed (default), an overridable warning, or refused outright. */
      self?: TargetSelfPolicy
      excludedCreatureTypeIds?: string[]
    }
  | {
      selectionKind: Extract<TargetSelectionKind, 'CHOSEN_CREATURES'>
      dispositionKind?: TargetDispositionKind
      maxTargets?: number
      maxTargetsScaling?: ScalableValueAuthored<{ amount: number }>
      resolutionCount?: number
      resolutionCountScaling?: ScalableValueAuthored<{ amount: number }>
      allowRepeatedTargets?: boolean
      excludedCreatureTypeIds?: string[]
    }
  | {
      selectionKind: Extract<TargetSelectionKind, 'AREA_CONTENTS'>
      dispositionKind?: TargetDispositionKind
      excludedCreatureTypeIds?: string[]
    }
