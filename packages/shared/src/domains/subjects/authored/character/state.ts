import type { CreatureOriginKindCode, CreatureRelationshipKindCode, EquippedSlotCode } from '#core'
import type { SpeedAuthored } from '#authored'

export interface CharacterEquipmentItemState {
  /** Character-owned item id */
  id: string
  /** System equipment id */
  equipmentId: string
  quantity: number
  containerId?: string
  customName?: string
  notes?: string
  /** Server-owned raw acquired rules and source identities; travels with this held item. */
  retainedRulesJson?: string
  /** The corrosion penalty play has put on this item; derived from the Sheet play overlay, never stored. */
  degradation?: number
}

/** An equipped inventory item and where it sits (D107). An item not listed is carried. */
export interface CharacterEquippedItemState {
  itemId: string
  slot: EquippedSlotCode
}

export interface CharacterEquipmentState {
  inventory: CharacterEquipmentItemState[]
  equipped: CharacterEquippedItemState[]
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
  kind: 'RULESET' | 'CAMPAIGN'
  campaignCurrencySystemId?: string
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
  /** Extra slots of this key a feature created; a long rest removes them with the usage. */
  created?: number
}

export interface CharacterConditionState {
  conditionTypeId: string
  notes?: string
}

export interface CharacterExhaustionState {
  level: number
  notes?: string
}

/**
 * A consequence table row the GM accepted for this Character, such as a lingering injury (ATTACK-15).
 * It keeps the row's text as rolled and lasts until the GM removes it.
 */
export interface CharacterConsequenceState {
  /** The resolve command that recorded it. */
  id: string
  definitionId: string
  rowId: string
  tableLabel: string
  label: string
  effect: string
  healing: string
  recordedAt: string
}

/**
 * The stat block values a summon cast resolved against its caster (D190), never the plan's
 * expressions. A Sheet summon and an Encounter summon's Run actor both keep them.
 */
export interface SpellSummonStatBlockValues {
  spellId: string
  summonOutcomeId: string
  label: string
  concentration: boolean
  size?: string
  armorClass: number | null
  abilityScores?: Record<string, number>
  speeds?: SpeedAuthored[]
  passivePerception?: number
  /** The attacks the spell lets its caster make with the summon. */
  actions?: { id: string; label: string; description?: string }[]
}

/** A creature a Sheet spell cast conjured outside an Encounter (D190). */
export interface CharacterSpellSummonState extends SpellSummonStatBlockValues {
  id: string
  /** Absent with `currentHitPoints` for a stat block with no hit points: no pool, never ends at 0. */
  maximumHitPoints?: number
  currentHitPoints?: number
  tempHitPoints?: number
  customName?: string
  notes?: string
  /** For a summon of a chosen form: the System Creature it is, and the Creature Type picked for it. */
  form?: { creatureId: string; creatureTypeId?: string }
  /** The summon has no duration: it stays until it is dismissed or falls, through a long rest. */
  untimed?: true
  castAt: string
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

export interface CharacterDeathSavesState {
  successes: number
  failures: number
  stable: boolean
}

export interface CharacterHitpointsState {
  current: number
  temp: number
  tempSourceEffectId?: string
  /** Fraction of the maximum a condition holds, resolved on write (SPELLS-10.T1b). */
  maximumFraction?: { numerator: number; denominator: number }
  hitDice: CharacterHitDiceUsageState[]
  deathSaves: CharacterDeathSavesState
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
  consequences?: CharacterConsequenceState[]
  spellSummons?: CharacterSpellSummonState[]
  noteGroups?: CharacterNoteGroupState[]
  notes?: CharacterNoteState[]
  creatures?: CharacterOwnedCreatureState[]
  vehicles?: CharacterOwnedVehicleState[]
  creatureEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
  vehicleEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
}
