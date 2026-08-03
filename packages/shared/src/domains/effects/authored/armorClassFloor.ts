import { EFFECT_KIND } from '#core'

export type ArmorClassFloorAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.ARMOR_CLASS_FLOOR
  minimum: number
}
