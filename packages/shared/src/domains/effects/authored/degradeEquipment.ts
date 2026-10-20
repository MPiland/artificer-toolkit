import { EFFECT_KIND } from '#core'

/** When a degraded item is destroyed: its offered armor class is this low, or its penalty this deep. */
export type DegradeEquipmentDestroyWhenAuthored = {
  kind: 'ARMOR_CLASS_OFFERED_AT_MOST' | 'PENALTY_REACHES'
  value: number
}

export type DegradeEquipmentAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.DEGRADE_EQUIPMENT
  /** The one kind of item it degrades: armor and shields lose armor class, weapons lose damage. */
  category: 'ARMOR' | 'SHIELD' | 'WEAPON'
  /** Degrades only an item without the MAGIC property. */
  nonmagical: boolean
  /** Degrades only an item with one of these material properties; empty for any material. */
  materials: ('METAL' | 'WOOD')[]
  /** Penalty steps added per use. */
  step: number
  destroyWhen: DegradeEquipmentDestroyWhenAuthored
}
