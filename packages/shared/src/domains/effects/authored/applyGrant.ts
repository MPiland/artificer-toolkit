import type { ModifierGrantAuthored, ProficiencyGrantAuthored, SenseGrantAuthored } from '#authored'
import { EFFECT_KIND } from '#core'

export type ApplyGrantAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.APPLY_GRANT
  grants: {
    modifiers?: ModifierGrantAuthored[]
    proficiencies?: ProficiencyGrantAuthored[]
    senses?: SenseGrantAuthored[]
  }
}
