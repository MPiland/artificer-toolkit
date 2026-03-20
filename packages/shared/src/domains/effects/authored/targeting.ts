import type {
  TargetDispositionKind,
  TargetSelectionKind
} from '#core'

export type TargetingAuthored =
  | {
    selectionKind: Extract<TargetSelectionKind, 'SELF'>
    detail?: string
  }
  | {
    selectionKind: Exclude<TargetSelectionKind, 'SELF'>
    dispositionKind?: TargetDispositionKind
    maxTargets?: number
    excludedCreatureTypeIds?: string[]
    detail?: string
  }
