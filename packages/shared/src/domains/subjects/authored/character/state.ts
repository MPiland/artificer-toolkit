export interface CharacterEquipmentItemState {
  /** Character-owned item id */
  id: string
  /** System equipment id */
  equipmentId: string
  quantity: number
  containerId?: string
  customName?: string
  notes?: string
}

export interface CharacterEquipmentState {
  inventory: CharacterEquipmentItemState[]
  equipped: string[] // character item IDs
  attuned: string[] // character item IDs
}

export interface CharacterOwnedCreatureState {
  id: string
  creatureId: string
  relationshipKind: 'MOUNT' | 'COMPANION' | 'OWNED' | 'SUMMONED'
  customName?: string
  notes?: string
  isActive?: boolean
}

export interface CharacterOwnedVehicleState {
  id: string
  vehicleId: string
  customName?: string
  notes?: string
  isActive?: boolean
}

export interface CharacterRosterEquipmentAssignmentState {
  equipmentItemId: string
}

export interface CharacterCurrencyAmountState {
  currencyId: string
  amount: number
}

export interface CharacterCurrencyGroupState {
  containerId?: string
  currencies: CharacterCurrencyAmountState[]
}

/* ──────────────────────────────────────────────
 * Class runtime state (usage only)
 * ────────────────────────────────────────────── */

export interface CharacterClassSpellState {
  learned?: string[]
  prepared?: string[]
}

/**
 * Mutable class-scoped sheet state only.
 * Class progression itself lives in CharacterIntent.
 */
export interface CharacterClassState {
  classId: string
  spells?: CharacterClassSpellState
}

/* ──────────────────────────────────────────────
 * Resource usage state (by grant id)
 * ────────────────────────────────────────────── */

export interface CharacterResourceUsageState {
  resourceGrantId: string
  used: number
}

export interface CharacterSpellSlotUsageState {
  slotKey: string
  used: number
}

export interface CharacterConditionState {
  conditionTypeId: string
  notes?: string
}

export interface CharacterExhaustionState {
  level: number
  notes?: string
}

/* ──────────────────────────────────────────────
 * Character State root
 * ────────────────────────────────────────────── */

export interface CharacterHitDiceUsageState {
  die: number // e.g. 8 for d8
  total: number
  used: number
}

export interface CharacterHitpointsState {
  current: number
  temp?: number
  hitDice: CharacterHitDiceUsageState[]
  maxOverride?: number
}

export interface CharacterState {
  equipment: CharacterEquipmentState
  currency: CharacterCurrencyGroupState[]
  hitpoints: CharacterHitpointsState
  classes?: CharacterClassState[]
  resources?: CharacterResourceUsageState[]
  spellSlots?: CharacterSpellSlotUsageState[]
  conditions?: CharacterConditionState[]
  exhaustion?: CharacterExhaustionState
  creatures?: CharacterOwnedCreatureState[]
  vehicles?: CharacterOwnedVehicleState[]
  creatureEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
  vehicleEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
}
