/** Where an equipped item sits: in a hand, carried on the body, or worn (D107). */
export const EQUIPMENT_SLOT_CODES = ['MAIN_HAND', 'OFF_HAND', 'CARRIED', 'WORN'] as const

export type EquipmentSlotCode = (typeof EQUIPMENT_SLOT_CODES)[number]

export type HandSlotCode = Extract<EquipmentSlotCode, 'MAIN_HAND' | 'OFF_HAND'>

export function isHandSlot(slot: EquipmentSlotCode): slot is HandSlotCode {
  return slot === 'MAIN_HAND' || slot === 'OFF_HAND'
}

export type HandOccupancyItem = {
  readonly id: string
  readonly slot: EquipmentSlotCode
  readonly twoHanded: boolean
}

export type HandConflictCode = 'HAND_OCCUPIED_TWICE' | 'TWO_HANDED_IN_OFF_HAND' | 'OFF_HAND_BLOCKED'

export type HandConflict = { readonly code: HandConflictCode; readonly itemId: string }

export const HAND_CONFLICT_MESSAGE: Readonly<Record<HandConflictCode, string>> = {
  HAND_OCCUPIED_TWICE: 'A hand can hold only one item.',
  TWO_HANDED_IN_OFF_HAND: 'A two-handed item cannot be held in the off hand.',
  OFF_HAND_BLOCKED: 'A two-handed main-hand item blocks the off hand.'
}

export type HandOccupancy = {
  readonly mainHandId: string | null
  readonly offHandId: string | null
  /** The main hand holds a two-handed item, so the off hand cannot hold anything. */
  readonly offHandBlocked: boolean
  /** Either hand is empty and usable. */
  readonly freeHand: boolean
  readonly conflicts: readonly HandConflict[]
}

/**
 * The one hand-occupancy rule (D107), shared by Creature loadouts and Characters: at most one item
 * per hand, and a two-handed item belongs in the main hand where it blocks the off hand. The first
 * item in a hand is the one that holds it; every further claim on that hand is a conflict.
 */
export function resolveHandOccupancy(items: readonly HandOccupancyItem[]): HandOccupancy {
  const conflicts: HandConflict[] = []
  const mainHand = items.find((item) => item.slot === 'MAIN_HAND') ?? null
  const offHand = items.find((item) => item.slot === 'OFF_HAND') ?? null
  const offHandBlocked = mainHand?.twoHanded === true

  for (const item of items) {
    if (!isHandSlot(item.slot)) continue
    if ((item.slot === 'MAIN_HAND' ? mainHand : offHand) !== item) {
      conflicts.push({ code: 'HAND_OCCUPIED_TWICE', itemId: item.id })
    } else if (item.slot === 'OFF_HAND' && item.twoHanded) {
      conflicts.push({ code: 'TWO_HANDED_IN_OFF_HAND', itemId: item.id })
    } else if (item.slot === 'OFF_HAND' && offHandBlocked) {
      conflicts.push({ code: 'OFF_HAND_BLOCKED', itemId: item.id })
    }
  }

  return {
    mainHandId: mainHand?.id ?? null,
    offHandId: offHand?.id ?? null,
    offHandBlocked,
    freeHand: mainHand === null || (offHand === null && !offHandBlocked),
    conflicts
  }
}
