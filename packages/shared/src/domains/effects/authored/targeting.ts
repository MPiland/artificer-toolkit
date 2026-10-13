import type { TargetDispositionKind, TargetSelectionKind, ScalableValueAuthored } from '#core'

export type TargetingAuthored =
  | {
      selectionKind: Extract<TargetSelectionKind, 'SELF'>
    }
  | {
      selectionKind: Extract<TargetSelectionKind, 'SINGLE_TARGET'>
      dispositionKind?: TargetDispositionKind
      excludesSelf?: boolean
      /** Naming the user is refused outright, where `excludesSelf` only warns. */
      refusesSelf?: boolean
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
