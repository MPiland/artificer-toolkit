import { z, lazySchema } from '../zod.js'
import { characterStateDtoSchema } from '../subjects/characterState.js'
import { characterSheetStateSchema } from './characterSheetState.js'

/**
 * The Character fields that change during play, split from the Builder-owned structure so a play
 * write touches one small record (ADR 0035 Amendment 12). Exactly these fields are what the room
 * holds and checkpoints for a Character:
 * - hit points (current, temporary, hit dice), inspiration, class and other resources, spell slots,
 *   conditions, exhaustion, recorded consequences (such as lingering injuries) and the creatures
 *   spells cast from the Sheet conjured, from `state`;
 * - the equipped and attuned item ids (item-use state), from `state.equipment`;
 * - resource usage and party visibility, from the Sheet state.
 * Everything else stays in the Character document and Sheet state.
 */
export const characterPlayStateSchema = lazySchema(() => {
  const {
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    consequences,
    spellSummons,
    equipment
  } = characterStateDtoSchema.shape
  const { resourceUsage, itemUsage, itemDegradation, partyVisibility } =
    characterSheetStateSchema.shape
  return z.strictObject({
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    consequences,
    spellSummons,
    equipped: equipment.shape.equipped,
    attuned: equipment.shape.attuned,
    resourceUsage,
    itemUsage,
    itemDegradation,
    partyVisibility
  })
})

/** The Character `state` without its play fields. */
export const characterStructureStateSchema = lazySchema(() =>
  z.extend(
    z.omit(characterStateDtoSchema, {
      hitpoints: true,
      inspiration: true,
      resources: true,
      spellSlots: true,
      conditions: true,
      exhaustion: true,
      consequences: true,
      spellSummons: true,
      equipment: true
    }),
    {
      equipment: z.omit(characterStateDtoSchema.shape.equipment, { equipped: true, attuned: true })
    }
  )
)

/** The Sheet state without its play fields. */
export const characterSheetStructureSchema = lazySchema(() =>
  z.omit(characterSheetStateSchema, {
    resourceUsage: true,
    itemUsage: true,
    itemDegradation: true,
    partyVisibility: true
  })
)

export type CharacterPlayState = z.infer<typeof characterPlayStateSchema>
type CharacterStructureState = z.infer<typeof characterStructureStateSchema>
export type CharacterSheetStructure = z.infer<typeof characterSheetStructureSchema>
type CharacterState = z.infer<typeof characterStateDtoSchema>
type CharacterSheetState = z.infer<typeof characterSheetStateSchema>

/** The play-bearing state of one Character, as the Sheet and the rules read it. */
export interface CharacterPersistedState {
  state: CharacterState
  sheetState: CharacterSheetState
}

/** The same state divided into its Builder-owned structure and its play record. */
interface CharacterSplitState {
  structure: { state: CharacterStructureState; sheetState: CharacterSheetStructure }
  play: CharacterPlayState
}

/** The play fields that live in the Character `state`. */
type CharacterStatePlay = Omit<
  CharacterPlayState,
  'resourceUsage' | 'itemUsage' | 'itemDegradation' | 'partyVisibility'
>
/** The play fields that live in the Sheet state. */
type CharacterSheetStatePlay = Pick<
  CharacterPlayState,
  'resourceUsage' | 'itemUsage' | 'itemDegradation' | 'partyVisibility'
>
type CharacterInventory = CharacterState['equipment']['inventory']
type CharacterEquipped = CharacterState['equipment']['equipped']
type ItemUsage = CharacterPlayState['itemUsage']
type ItemDegradation = CharacterPlayState['itemDegradation']

const usedById = (itemUsage: ItemUsage) =>
  new Map(itemUsage.map((usage) => [usage.itemInstanceId, usage.used]))

/**
 * The inventory a reader sees: each stored row less what play has used up, carrying the corrosion
 * play has put on it. A row with none left is hidden from every reader. Pure.
 */
export function effectiveInventory(
  inventory: CharacterInventory,
  itemUsage: ItemUsage,
  itemDegradation: ItemDegradation = []
): CharacterInventory {
  const used = usedById(itemUsage)
  const degradation = new Map(
    itemDegradation.map(({ itemInstanceId, penalty }) => [itemInstanceId, penalty])
  )
  return inventory.flatMap((item) => {
    const quantity = item.quantity - (used.get(item.id) ?? 0)
    const penalty = degradation.get(item.id)
    return quantity > 0
      ? [{ ...item, quantity, ...(penalty === undefined ? {} : { degradation: penalty }) }]
      : []
  })
}

/**
 * The equipped or attuned ids a reader sees: those of rows `effectiveInventory` still shows. A
 * used-up row is not worn, wielded or attuned to. Pure.
 */
export function effectiveItemIds(ids: readonly string[], effective: CharacterInventory): string[] {
  const visible = new Set(effective.map((item) => item.id))
  return ids.filter((id) => visible.has(id))
}

/** The equipped entries a reader sees: `effectiveItemIds` for slot-bearing entries. Pure. */
export function effectiveEquippedItems(
  equipped: CharacterEquipped,
  effective: CharacterInventory
): CharacterEquipped {
  const visible = new Set(effective.map((item) => item.id))
  return equipped.filter(({ itemId }) => visible.has(itemId))
}

/**
 * The inverse of `effectiveInventory` for a structural edit. `edited` is the effective inventory a
 * structural editor changed; `base` is the stored inventory and usage it was read from. Stored
 * quantity is the edited quantity plus what was used, rows hidden because none were left are kept
 * where they were, and usage of rows no longer stored is dropped. Pure.
 */
export function storeInventory(
  edited: CharacterInventory,
  itemUsage: ItemUsage,
  base: { inventory: CharacterInventory; itemUsage: ItemUsage } | null
): { inventory: CharacterInventory; itemUsage: ItemUsage } {
  const baseUsed = usedById(base?.itemUsage ?? [])
  const editedIds = new Set(edited.map((item) => item.id))
  const inventory = edited.map(({ degradation: _derived, ...item }) => ({
    ...item,
    quantity: item.quantity + (baseUsed.get(item.id) ?? 0)
  }))
  const baseInventory = base?.inventory ?? []
  baseInventory.forEach((item, index) => {
    if (editedIds.has(item.id) || (baseUsed.get(item.id) ?? 0) < item.quantity) return
    // Reinsert the hidden row after the nearest earlier base row that is still stored.
    const stored = new Set(inventory.map((row) => row.id))
    const anchor = baseInventory
      .slice(0, index)
      .reverse()
      .find((earlier) => stored.has(earlier.id))
    inventory.splice(anchor ? inventory.findIndex((row) => row.id === anchor.id) + 1 : 0, 0, item)
  })
  const storedIds = new Set(inventory.map((item) => item.id))
  return {
    inventory,
    itemUsage: itemUsage.filter((usage) => storedIds.has(usage.itemInstanceId))
  }
}

/** Divides a Character `state` into its structure and the play fields it carries. Pure. */
export function splitCharacterStatePlay(state: CharacterState): {
  structure: CharacterStructureState
  play: CharacterStatePlay
} {
  const {
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    consequences,
    spellSummons,
    equipment,
    ...structure
  } = state
  const { equipped, attuned, ...structureEquipment } = equipment
  return {
    structure: { ...structure, equipment: structureEquipment },
    // Absent optional fields stay absent: canonical JSON has no `undefined`.
    play: {
      hitpoints,
      ...(inspiration === undefined ? {} : { inspiration }),
      ...(resources === undefined ? {} : { resources }),
      ...(spellSlots === undefined ? {} : { spellSlots }),
      ...(conditions === undefined ? {} : { conditions }),
      ...(exhaustion === undefined ? {} : { exhaustion }),
      ...(consequences === undefined ? {} : { consequences }),
      ...(spellSummons === undefined ? {} : { spellSummons }),
      equipped,
      attuned
    }
  }
}

/** The inverse of `splitCharacterStatePlay`: the Character `state` from its structure and play. */
export function mergeCharacterStatePlay(
  structure: CharacterStructureState,
  play: CharacterStatePlay
): CharacterState {
  const {
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    consequences,
    spellSummons,
    equipped,
    attuned
  } = play
  // Named, not spread: a caller may hold the whole play record, whose Sheet fields are not state.
  return {
    ...structure,
    hitpoints,
    ...(inspiration === undefined ? {} : { inspiration }),
    ...(resources === undefined ? {} : { resources }),
    ...(spellSlots === undefined ? {} : { spellSlots }),
    ...(conditions === undefined ? {} : { conditions }),
    ...(exhaustion === undefined ? {} : { exhaustion }),
    ...(consequences === undefined ? {} : { consequences }),
    ...(spellSummons === undefined ? {} : { spellSummons }),
    equipment: { ...structure.equipment, equipped, attuned }
  }
}

/** Divides a Sheet state into its structure and its play fields. Pure. */
function splitCharacterSheetStatePlay(sheetState: CharacterSheetState): {
  structure: CharacterSheetStructure
  play: CharacterSheetStatePlay
} {
  const { resourceUsage, itemUsage, itemDegradation, partyVisibility, ...structure } = sheetState
  return { structure, play: { resourceUsage, itemUsage, itemDegradation, partyVisibility } }
}

/** The inverse of `splitCharacterSheetStatePlay`: the Sheet state from its structure and play. */
export function mergeCharacterSheetStatePlay(
  structure: CharacterSheetStructure,
  play: CharacterSheetStatePlay
): CharacterSheetState {
  return {
    ...structure,
    resourceUsage: play.resourceUsage,
    itemUsage: play.itemUsage,
    itemDegradation: play.itemDegradation,
    partyVisibility: play.partyVisibility
  }
}

/**
 * Divides a Character's state and Sheet state into structure and play. The state's inventory is the
 * effective one readers see; `base` is the stored inventory and usage it was read from, which turns
 * it back into stored quantities (see `storeInventory`). Pure.
 */
export function splitCharacterPlayState(
  { state, sheetState }: CharacterPersistedState,
  base: {
    inventory: CharacterInventory
    itemUsage: ItemUsage
    equipped: CharacterEquipped
    attuned: readonly string[]
  } | null = null
): CharacterSplitState {
  const statePart = splitCharacterStatePlay(state)
  if (base) {
    // Readers never see a used-up row as worn; storage keeps its ids so an undo restores them.
    const visible = new Set(effectiveInventory(base.inventory, base.itemUsage).map(({ id }) => id))
    const hidden = new Set(base.inventory.map(({ id }) => id).filter((id) => !visible.has(id)))
    const keep = (ids: string[], baseIds: readonly string[]) => [
      ...ids,
      ...baseIds.filter((id) => hidden.has(id) && !ids.includes(id))
    ]
    statePart.play.equipped = [
      ...statePart.play.equipped,
      ...base.equipped.filter(
        ({ itemId }) =>
          hidden.has(itemId) && !statePart.play.equipped.some((entry) => entry.itemId === itemId)
      )
    ]
    statePart.play.attuned = keep(statePart.play.attuned, base.attuned)
  }
  const sheetPart = splitCharacterSheetStatePlay(sheetState)
  const stored = storeInventory(state.equipment.inventory, sheetState.itemUsage, base)
  return {
    structure: {
      state: {
        ...statePart.structure,
        equipment: { ...statePart.structure.equipment, inventory: stored.inventory }
      },
      sheetState: sheetPart.structure
    },
    play: { ...statePart.play, ...sheetPart.play, itemUsage: stored.itemUsage }
  }
}
