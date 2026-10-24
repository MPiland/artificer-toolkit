import type { CreatureOriginKindCode, CreatureRelationshipKindCode, EquippedSlotCode } from '#core'
import type { SummonStatBlockAuthored } from '#authored'

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
}

export interface CharacterConditionState {
  conditionTypeId: string
  notes?: string
}

export interface CharacterExhaustionState {
  level: number
  notes?: string
}

type SummonAbilityScores = NonNullable<SummonStatBlockAuthored['abilityScores']>

/**
 * The summon plan's stat block as play state snapshots it. The schema parses numeric expressions as
 * `unknown` and size as an identifier, so the snapshot keeps those fields as loose as the parse.
 */
export type CharacterSpellSummonStatBlockState = Omit<
  SummonStatBlockAuthored,
  'size' | 'armorClass' | 'hitPoints' | 'passivePerception' | 'abilityScores'
> & {
  size?: string
  armorClass?: unknown
  hitPoints?: unknown
  passivePerception?: unknown
  abilityScores?: { [Ability in keyof SummonAbilityScores]?: unknown }
}

/** A creature a Sheet spell cast conjured outside an Encounter (D190). */
export interface CharacterSpellSummonState {
  id: string
  spellId: string
  summonOutcomeId: string
  label: string
  concentration: boolean
  statBlock: CharacterSpellSummonStatBlockState
  armorClass: number | null
  maximumHitPoints: number
  currentHitPoints: number
  tempHitPoints?: number
  customName?: string
  notes?: string
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
  spellSummons?: CharacterSpellSummonState[]
  noteGroups?: CharacterNoteGroupState[]
  notes?: CharacterNoteState[]
  creatures?: CharacterOwnedCreatureState[]
  vehicles?: CharacterOwnedVehicleState[]
  creatureEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
  vehicleEquipment?: Record<string, CharacterRosterEquipmentAssignmentState[]>
}
