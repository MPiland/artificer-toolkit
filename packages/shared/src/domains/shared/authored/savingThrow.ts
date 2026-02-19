import type {
  AbilityCode,
  SAVING_THROW_KIND
} from '#core'

export type SavingThrowAuthored
  = | {
    id: string
    savingThrowKind: typeof SAVING_THROW_KIND.SPELL_SAVE_DC
  } | {
    id: string
    ability: AbilityCode // what the SCOPE rolls
    savingThrowKind: typeof SAVING_THROW_KIND.FIXED_VALUE
    dc: number
  }
