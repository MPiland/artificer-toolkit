export const CHARACTER_CALCULATION_CONTRIBUTION_STATE = {
  APPLIED: 'APPLIED',
  SUPPRESSED: 'SUPPRESSED'
} as const

export type CharacterCalculationContributionState =
  (typeof CHARACTER_CALCULATION_CONTRIBUTION_STATE)[keyof typeof CHARACTER_CALCULATION_CONTRIBUTION_STATE]

export const CHARACTER_AUTHORED_SOURCE_KIND = {
  ANCESTRY: 'ANCESTRY',
  BACKGROUND: 'BACKGROUND',
  CLASS: 'CLASS',
  FEAT: 'FEAT',
  FEATURE: 'FEATURE',
  OPTION: 'OPTION',
  RACE: 'RACE',
  SPELL: 'SPELL',
  SUBRACE: 'SUBRACE',
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
  | {
      kind: 'ACTIVE_EFFECT'
      activeEffectId: string
    }

export function createCharacterMechanicSourceKey(source: CharacterMechanicSourceRef): string {
  switch (source.kind) {
    case 'AUTHORED':
      return [source.kind, source.sourceKind, source.definitionId, source.sourceInstanceId]
        .map(encodeURIComponent)
        .join(':')
    case 'EQUIPMENT_INSTANCE':
      return [source.kind, source.equipmentId, source.itemInstanceId]
        .map(encodeURIComponent)
        .join(':')
    case 'COMPANION_INSTANCE':
      return [source.kind, source.creatureId, source.companionInstanceId]
        .map(encodeURIComponent)
        .join(':')
    case 'SYSTEM':
      return [source.kind, source.systemId].map(encodeURIComponent).join(':')
    case 'MANUAL_ADJUSTMENT':
      return [source.kind, source.adjustmentId].map(encodeURIComponent).join(':')
    case 'ACTIVE_EFFECT':
      return [source.kind, source.activeEffectId].map(encodeURIComponent).join(':')
  }
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
