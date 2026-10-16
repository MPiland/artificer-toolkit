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
      allowedCreatureTypeIds?: string[]
      excludedCreatureTypeIds?: string[]
    }
  | {
      selectionKind: Extract<TargetSelectionKind, 'CHOSEN_CREATURES'>
      dispositionKind?: TargetDispositionKind
      maxTargets?: number
      maxTargetsScaling?: ScalableValueAuthored<{ amount: number }>
      allowRepeatedTargets?: boolean
      allowedCreatureTypeIds?: string[]
      excludedCreatureTypeIds?: string[]
    }
  | {
      selectionKind: Extract<TargetSelectionKind, 'AREA_CONTENTS'>
      dispositionKind?: TargetDispositionKind
      allowedCreatureTypeIds?: string[]
      excludedCreatureTypeIds?: string[]
    }
