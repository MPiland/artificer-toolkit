export const CHARACTER_CALCULATION_CONTRIBUTION_STATE = {
  APPLIED: 'APPLIED',
  SUPPRESSED: 'SUPPRESSED'
} as const

export type CharacterCalculationContributionState =
  (typeof CHARACTER_CALCULATION_CONTRIBUTION_STATE)[keyof typeof CHARACTER_CALCULATION_CONTRIBUTION_STATE]

export const CHARACTER_AUTHORED_SOURCE_KIND = {
  BACKGROUND: 'BACKGROUND',
  CLASS: 'CLASS',
  FEAT: 'FEAT',
  FEATURE: 'FEATURE',
  OPTION: 'OPTION',
  RACE: 'RACE',
  SPELL: 'SPELL',
  SUBCLASS: 'SUBCLASS'
} as const

export type CharacterAuthoredSourceKind =
  (typeof CHARACTER_AUTHORED_SOURCE_KIND)[keyof typeof CHARACTER_AUTHORED_SOURCE_KIND]

/**
 * Stable mechanical provenance carried through the pure engine.
 *
 * Labels and notes are deliberately absent. Application services resolve those
 * presentation values after engine calculation.
 */
export type CharacterMechanicSourceRef =
  | {
      kind: 'AUTHORED'
      sourceKind: CharacterAuthoredSourceKind
      definitionId: string
      sourceInstanceId: string
    }
  | {
      kind: 'EQUIPMENT_INSTANCE'
      equipmentId: string
      itemInstanceId: string
    }
  | {
      kind: 'COMPANION_INSTANCE'
      creatureId: string
      companionInstanceId: string
    }
  | {
      kind: 'SYSTEM'
      systemId: string
    }
  | {
      kind: 'MANUAL_ADJUSTMENT'
      adjustmentId: string
    }

export interface CharacterCalculationContribution<T> {
  id: string
  source: CharacterMechanicSourceRef
  value: T
  state: CharacterCalculationContributionState
}

export interface CharacterCalculation<T> {
  base: T
  contributions: CharacterCalculationContribution<T>[]
  override?: {
    adjustmentId: string
    value: T
  }
  effective: T
}
