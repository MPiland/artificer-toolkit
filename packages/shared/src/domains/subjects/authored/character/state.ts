import type { CreatureOriginKindCode, CreatureRelationshipKindCode } from '#core'

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

export interface CharacterOwnedCreatureHitDiceState {
  die: number
  total: number
  used: number
}

export interface CharacterOwnedCreatureState {
  id: string
  creatureId: string
  relationshipKind: CreatureRelationshipKindCode
  originKind: CreatureOriginKindCode
  customName?: string
  notes?: string
  isActive?: boolean
  currentHitPoints?: number
  tempHitPoints?: number
  hitDice?: CharacterOwnedCreatureHitDiceState[]
}

export interface CharacterOwnedVehicleState {
  id: string
  vehicleId: string
  customName?: string
  notes?: string
  isActive?: boolean
  currentHitPoints?: number
}

export interface CharacterRosterEquipmentAssignmentState {
  equipmentItemId: string
}

export interface CharacterCurrencyAmountState {
  currencyId: string
  amount: number
}

export interface CharacterCurrencyGroupState {
  id: string
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

export type CharacterNoteGroupKind = 'SESSION' | 'LOOT' | 'CHARACTERS' | 'PLACES' | 'CUSTOM'

export interface CharacterNoteGroupState {
  id: string
  label: string
  sortOrder: number
  kind: CharacterNoteGroupKind
}

export interface CharacterNoteState {
  id: string
  title: string
  body?: string
  groupId: string
  pinned?: boolean
  createdAt: string
  updatedAt: string
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
}

export interface CharacterState {
  equipment: CharacterEquipmentState
  currency: CharacterCurrencyGroupState[]
  hitpoints: CharacterHitpointsState
  inspiration?: boolean
  classes?: CharacterClassState[]
  resources?: CharacterResourceUsageState[]
  spellSlots?: CharacterSpellSlotUsageState[]
  conditions?: CharacterConditionState[]
  exhaustion?: CharacterExhaustionState
  noteGroups?: CharacterNoteGroupState[]
  notes?: CharacterNoteState[]
  creatures?: CharacterOwnedCreatureState[]
  vehicles?: CharacterOwnedVehicleState[]
  creatureEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
  vehicleEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
}
