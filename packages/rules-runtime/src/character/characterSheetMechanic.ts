export type CharacterSheetProjectedOutcome =
  | {
      kind: 'DAMAGE'
      pathCode: string
      expression: string
      damageTypeId: string
      damageTypeLabel: string
      scaling?: CharacterSheetProjectedOutcomeScaling[]
    }
  | {
      kind: 'HEAL'
      pathCode: string
      expression: string
      temporary: boolean
      scaling?: CharacterSheetProjectedOutcomeScaling[]
    }
  | {
      kind: 'CONDITION'
      pathCode: string
      conditionId: string
      label: string
    }
  | {
      kind: 'EFFECT'
      pathCode: string
      effectKind: string
      label?: string
    }

export interface CharacterSheetProjectedOutcomeScaling {
  level: number
  expression: string
}

export interface CharacterSheetProjectedMechanic {
  effectId: string
  trigger: string
  activation?: {
    kind: string
    amount: number
  }
  rangeLabel?: string
  attackBonus?: number
  attackRollMode?: string
  save?: {
    ability: string
    dc?: number
  }
  outcomes: CharacterSheetProjectedOutcome[]
}
