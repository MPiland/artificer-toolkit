import type {
  AbilityCode,
  SAVING_THROW_KIND
} from '#core'

export type SavingThrowAuthored
  = | {
    id: string
    ability: AbilityCode // what the target rolls against the source DC
    sourceAbility?: AbilityCode // what the source uses to calculate the DC
    savingThrowKind: typeof SAVING_THROW_KIND.SOURCE_SAVE_DC
  } | {
    id: string
    ability: AbilityCode // what the SCOPE rolls
    savingThrowKind: typeof SAVING_THROW_KIND.FIXED_VALUE
    dc: number
  }
