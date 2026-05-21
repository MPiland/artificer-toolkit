import type {
  AbilityCode,
  SAVING_THROW_DC_BONUS_KIND,
  SAVING_THROW_DC_METHOD
} from '#core'

export type SavingThrowDcBonusAuthored
  = | {
    id: string
    bonusKind: typeof SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER
    ability: AbilityCode
  }
  | {
    id: string
    bonusKind: typeof SAVING_THROW_DC_BONUS_KIND.PROFICIENCY_BONUS
  }
  | {
    id: string
    bonusKind: typeof SAVING_THROW_DC_BONUS_KIND.STATIC_BONUS
    amount: number
  }

export type SavingThrowAuthored
  = | {
    id: string
    ability: AbilityCode
    dcMethod: typeof SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC
  } | {
    id: string
    ability: AbilityCode
    dcMethod: typeof SAVING_THROW_DC_METHOD.FIXED_DC
    baseDc: number
    bonuses?: SavingThrowDcBonusAuthored[]
  } | {
    id: string
    ability: AbilityCode
    dcMethod: typeof SAVING_THROW_DC_METHOD.DERIVED_DC
    baseDc: number
    bonuses: SavingThrowDcBonusAuthored[]
  }
