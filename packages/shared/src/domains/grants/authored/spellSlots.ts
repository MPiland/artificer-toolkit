import type { ChargeResetKind } from '#core'

/**
 * A feature's table of spell slots by spell level. The feature's spell grants that carry no cast
 * attribute (not at will, limited use or fixed level) cast from it: a spell of level N spends a slot
 * of level N or higher, the lowest one with a slot left.
 */
export type SpellSlotTableAuthored = {
  id: string
  resetKind: ChargeResetKind
  levels: { id: string; level: number; amount: number }[]
}
