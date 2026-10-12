import type {
  CharacterClassState,
  CharacterCurrencyGroupState,
  CharacterEquipmentItemState,
  CharacterEquipmentState,
  CharacterEquippedItemState,
  CharacterHitDiceUsageState,
  CharacterHitpointsState,
  CharacterOwnedCreatureState,
  CharacterOwnedVehicleState,
  CharacterResourceUsageState,
  CharacterRosterEquipmentAssignmentState,
  CharacterState
} from '#authored'

export type CompiledCharacterState = {
  equipment: CompiledCharacterEquipmentState
  currency: CompiledCurrencyGroup[]

  hitpoints: CompiledCharacterHitpointState

  /**
   * Optional: class-scoped mutable state (spells prepared/learned, etc.)
   * You can omit this entirely if you decide to store spell state elsewhere.
   */
  classes?: CompiledCharacterClassState[]

  /**
   * Resource usage by grant id (the "used" side).
   * Grants live on intent; state references them by resourceGrantId.
   */
  resources?: CompiledCharacterResourceUsageState[]
  creatures?: CompiledOwnedCreatureState[]
  vehicles?: CompiledOwnedVehicleState[]
  creatureEquipment?: Record<string, CompiledRosterEquipmentAssignmentState[]>
  vehicleEquipment?: Record<string, CompiledRosterEquipmentAssignmentState[]>
}

/* ──────────────────────────────────────────────────────────────
 * Hit points
 * ────────────────────────────────────────────────────────────── */

export type CompiledHitDieUsage = CharacterHitDiceUsageState

export type CompiledCharacterHitpointState = {
  current: number
  temp?: number
  hitDice: CompiledHitDieUsage[]
  deathSaves: CharacterHitpointsState['deathSaves']
}

export function compileHitpointState(
  authored: CharacterHitpointsState
): CompiledCharacterHitpointState {
  return {
    current: authored.current,
    temp: authored.temp,
    hitDice: authored.hitDice,
    deathSaves: authored.deathSaves
  }
}

/* ──────────────────────────────────────────────────────────────
 * Resource grants + usage
 * ────────────────────────────────────────────────────────────── */
export type CompiledCharacterResourceUsageState = CharacterResourceUsageState

export function compileResourceState(
  authored: CharacterResourceUsageState
): CompiledCharacterResourceUsageState {
  return authored
}

/* ──────────────────────────────────────────────────────────────
 * Equipment + currency (state)
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterEquipmentItem = CharacterEquipmentItemState

export type CompiledCharacterEquipmentState = {
  inventory: CompiledCharacterEquipmentItem[]
  equipped: CharacterEquippedItemState[]
  attuned: string[]
}

export type CompiledCurrencyGroup = CharacterCurrencyGroupState

export function compileEquipmentState(
  authored: CharacterEquipmentState
): CompiledCharacterEquipmentState {
  return {
    inventory: authored.inventory,
    equipped: authored.equipped,
    attuned: authored.attuned
  }
}

export function compileCurrencyGroups(
  authored: CharacterCurrencyGroupState[]
): CompiledCurrencyGroup[] {
  // Keep as-is; if you later want to prune empty currencies, do it here.
  return authored
}

export type CompiledOwnedCreatureState = CharacterOwnedCreatureState
export type CompiledOwnedVehicleState = CharacterOwnedVehicleState
export type CompiledRosterEquipmentAssignmentState = CharacterRosterEquipmentAssignmentState

/* ──────────────────────────────────────────────────────────────
 * Class mutable state (optional)
 * ────────────────────────────────────────────────────────────── */

export type CompiledCharacterClassState = CharacterClassState

export function compileClassState(authored: CharacterClassState): CompiledCharacterClassState {
  const learned =
    authored.spells?.learned && authored.spells.learned.length ? authored.spells.learned : undefined
  const prepared =
    authored.spells?.prepared && authored.spells.prepared.length
      ? authored.spells.prepared
      : undefined

  const spells = learned || prepared ? { learned, prepared } : undefined

  return {
    classId: authored.classId,
    spells
  }
}

export function compileCharacterState(authored: CharacterState): CompiledCharacterState {
  const classes =
    authored.classes && authored.classes.length
      ? authored.classes.map(compileClassState)
      : undefined

  const resources =
    authored.resources && authored.resources.length
      ? authored.resources.map(compileResourceState)
      : undefined

  return {
    equipment: compileEquipmentState(authored.equipment),
    currency: compileCurrencyGroups(authored.currency),
    hitpoints: compileHitpointState(authored.hitpoints),
    classes,
    resources,
    creatures: authored.creatures?.length ? authored.creatures : undefined,
    vehicles: authored.vehicles?.length ? authored.vehicles : undefined,
    creatureEquipment:
      authored.creatureEquipment && Object.keys(authored.creatureEquipment).length
        ? authored.creatureEquipment
        : undefined,
    vehicleEquipment:
      authored.vehicleEquipment && Object.keys(authored.vehicleEquipment).length
        ? authored.vehicleEquipment
        : undefined
  }
}
