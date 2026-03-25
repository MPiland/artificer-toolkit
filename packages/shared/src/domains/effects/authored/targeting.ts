import type {
  TargetDispositionKind,
  TargetSelectionKind
} from '#core'

export type TargetingAuthored =
  | {
    selectionKind: Extract<TargetSelectionKind, 'SELF'>
  }
  | {
    selectionKind: Exclude<TargetSelectionKind, 'SELF'>
    dispositionKind?: TargetDispositionKind
    maxTargets?: number
    excludedCreatureTypeIds?: string[]
  }
