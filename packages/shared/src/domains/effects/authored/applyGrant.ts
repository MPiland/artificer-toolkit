import type { ModifierGrantAuthored, ProficiencyGrantAuthored, SenseGrantAuthored } from '#authored'
import { EFFECT_KIND } from '#core'

export type ApplyGrantAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.APPLY_GRANT
  /** The grants apply only to the path's chosen item (Magic Weapon's bonus, Shillelagh's die). */
  bindsChosenItem?: boolean
  /**
   * The grants apply only when the path's chosen item stays with its holder: a releasable (held)
   * item released by this result's `RELEASE_CHOSEN_ITEM` skips them (Heat Metal's disadvantage).
   */
  unlessChosenItemReleased?: boolean
  grants: {
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
  }
}
