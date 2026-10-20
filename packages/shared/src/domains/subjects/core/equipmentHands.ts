import { EQUIPMENT_CATEGORY_CODE } from './equipment.js'

/** Where an equipped item sits: in a hand, carried on the body, or worn (D107). */
export const EQUIPMENT_SLOT_CODES = ['MAIN_HAND', 'OFF_HAND', 'CARRIED', 'WORN'] as const

export type EquipmentSlotCode = (typeof EQUIPMENT_SLOT_CODES)[number]

/** Where a Character's equipped item sits; an inventory item that is not equipped is carried. */
export const EQUIPPED_SLOT_CODES = ['MAIN_HAND', 'OFF_HAND', 'WORN'] as const

export type EquippedSlotCode = Exclude<EquipmentSlotCode, 'CARRIED'>

export type HandSlotCode = Extract<EquipmentSlotCode, 'MAIN_HAND' | 'OFF_HAND'>

export function isHandSlot(slot: EquipmentSlotCode): slot is HandSlotCode {
  return slot === 'MAIN_HAND' || slot === 'OFF_HAND'
}

export type HandOccupancyItem = {
  readonly id: string
  readonly slot: EquipmentSlotCode
  readonly twoHanded: boolean
}

/** An item a hand holds. */
export type HeldItem = HandOccupancyItem & { readonly slot: HandSlotCode }

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
  /** How many hands are empty and usable (0 to 2). */
  readonly emptyHands: number
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

  const emptyHands = Number(mainHand === null) + Number(offHand === null && !offHandBlocked)
  return {
    mainHandId: mainHand?.id ?? null,
    offHandId: offHand?.id ?? null,
    offHandBlocked,
    emptyHands,
    freeHand: emptyHands > 0,
    conflicts
  }
}

/** A Character holds weapons and shields in its hands; everything else it equips is worn (D107). */
export function isHeldEquipmentCategory(category: string | undefined): boolean {
  return category === EQUIPMENT_CATEGORY_CODE.WEAPON || category === EQUIPMENT_CATEGORY_CODE.SHIELD
}

/**
 * The slot a Character's newly equipped item takes (D107): a worn item is simply worn; a held item
 * goes to the main hand when it is empty and to the off hand otherwise. `held` is what the hands
 * hold now. The result is checked by `resolveHandOccupancy`, so a full hand, a two-handed item in
 * the off hand and a two-handed item beside an off-hand item all come back as a conflict.
 */
export function nextEquipSlot(
  item: { readonly id: string; readonly category: string | undefined; readonly twoHanded: boolean },
  held: readonly HeldItem[]
): { readonly slot: EquippedSlotCode } | { readonly conflict: HandConflictCode } {
  if (!isHeldEquipmentCategory(item.category)) return { slot: 'WORN' }
  const slot: HandSlotCode =
    resolveHandOccupancy(held).mainHandId === null ? 'MAIN_HAND' : 'OFF_HAND'
  const [conflict] = resolveHandOccupancy([
    ...held,
    { id: item.id, slot, twoHanded: item.twoHanded }
  ]).conflicts
  return conflict ? { conflict: conflict.code } : { slot }
}

export type HandDrawPlan =
  | { readonly kind: 'DRAW'; readonly slot: HandSlotCode }
  | { readonly kind: 'RELEASE_REQUIRED'; readonly slot: HandSlotCode }
  | { readonly kind: 'NO_HAND' }

/**
 * How an attack draws its bound weapon (D107). `holds` counts the hands taken by held creatures,
 * which fill an empty hand each. A free hand draws; when only the holds keep the weapon's hands
 * occupied, the actor must release holds first (one at a time) before it can draw; when items fill
 * the hands, nothing is drawn (swapping weapons stays free, `encounterWieldConflict`).
 */
export function planHandDraw(
  item: { readonly id: string; readonly twoHanded: boolean },
  items: readonly HandOccupancyItem[],
  holds: number
): HandDrawPlan {
  const held = items.filter((entry): entry is HeldItem => isHandSlot(entry.slot))
  const placed = nextEquipSlot({ ...item, category: EQUIPMENT_CATEGORY_CODE.WEAPON }, held)
  const needed = item.twoHanded ? 2 : 1
  const { emptyHands } = resolveHandOccupancy(held)
  if ('conflict' in placed || placed.slot === 'WORN' || emptyHands < needed)
    return { kind: 'NO_HAND' }
  return needed <= emptyHands - holds
    ? { kind: 'DRAW', slot: placed.slot }
    : { kind: 'RELEASE_REQUIRED', slot: placed.slot }
}

/**
 * Emptying the main hand moves an off-hand weapon into it; an off-hand shield stays put (D107).
 * Only the Sheet unequip applies this; rule settlement (shield stow, Disarm) just empties the slot.
 */
export function promotesOffHandItem(
  removedSlot: EquippedSlotCode | undefined,
  offHandCategory: string | undefined
): boolean {
  return removedSlot === 'MAIN_HAND' && offHandCategory === EQUIPMENT_CATEGORY_CODE.WEAPON
}

/**
 * Exchanges what the main and off hands hold (D107); a lone item moves to the other hand. The
 * result is checked by `resolveHandOccupancy`, so a two-handed main-hand item cannot swap.
 */
export function swapHeldItems(
  held: readonly HeldItem[]
): { readonly held: readonly HeldItem[] } | { readonly conflict: HandConflictCode } {
  const swapped = held.map((item) => ({
    ...item,
    slot: item.slot === 'MAIN_HAND' ? ('OFF_HAND' as const) : ('MAIN_HAND' as const)
  }))
  const [conflict] = resolveHandOccupancy(swapped).conflicts
  return conflict ? { conflict: conflict.code } : { held: swapped }
}
