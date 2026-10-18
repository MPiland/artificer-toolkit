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
      /** The largest target, in size steps above the actor's; a larger one only warns. */
      sizeLimit?: { stepsAboveActor: number }
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
      /** Hit points of creatures the area affects, lowest first, rolled once per cast (Sleep). */
      hitPointPool?: { diceConfig: string }
      hitPointPoolScaling?: ScalableValueAuthored<{ diceConfig: string }>
      allowedCreatureTypeIds?: string[]
      excludedCreatureTypeIds?: string[]
    }
