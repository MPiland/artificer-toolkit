/* ============================================================================
CHARACTER DATA MODEL — OFFLINE-FIRST, FRONTEND-FRIENDLY
===============================================================================

Purpose
-------
Represents a player character’s *state* and *choices* while referencing
canonical system content (features, feats, spells, equipment, etc.) by ID.
This model is optimized for offline computation: the client resolves
content by ID from a cached registry, applies grants/modifiers, and derives
stats without server round-trips.

Design Principles
-----------------
• Reference content, store state:
  - Canonical content is NOT denormalized into the character.
  - Character stores only grants, choices, and local overrides.

• Clear provenance:
  - Every grant includes a CharacterSourceRef indicating *where it came from*
    (class, feature, feat, background, race/ancestry, equipment, etc.)
    and a stable uiKey used by the builder.

• SQL-friendly:
  - Separate FK columns (classId, featureId, featId, etc.) preserve joins.
  - Frontend uses the same IDs and does not need composite keys.

• No derived fields persisted:
  - Values like AC, passive Perception, save DCs, attack bonuses are computed.

• Arrays per concern:
  - Senses, proficiencies, expertise, modifiers, feats, and spells are each in
    their own array for straightforward UI rendering and data access.

Notes
-----
• `// int` indicates integer semantics for your TS→SQL mapping.
• Types referenced from your shared model (e.g., saveDc, Damage) are used by ID.
• Spell slot math, HP calc, and other derived rules happen client-side, using
  cached system and content definitions.

============================================================================ */

/* --------------------------------------------------------------------------
 Shared: Source provenance for any grant/subfeature attached to the character.
--------------------------------------------------------------------------- */
export interface CharacterGrantRef {
  featureId: string | null // FK → Feature.id
  classId: string | null // FK → Class.id
  raceId: string | null // FK → Race.id
  ancestryId: string | null // FK → RaceAncestry.id (if chosen)
  equipmentId: string | null // FK → Equipment.id
  backgroundId: string | null // FK → Background.id
  featId: string | null // FK → Feat.id
  subfeatureOptionId: string | null // FK → FeatureOption.id (if from an option)
  uiKey: string | null // Stable, deterministic UI key ("typename-parent-sIndex-i")
  grantedAtLevel: number | null // int — level of the parent class/feature when granted
}

/* --------------------------------------------------------------------------
 Features the character has "enrolled". Used to show source-level features,
 their chosen options, and the grant-level when taken.
--------------------------------------------------------------------------- */
export interface CharacterFeatureOptionRef {
  subfeatureOptionId: string // FK → FeatureOption.id
  uiKey: string // deterministic index key used in UI
  featureLevel: number // int — when this option was selected
}

export interface CharacterFeatureRef extends CharacterGrantRef {
  featureId: string // FK → Feature.id (required here)
  options: CharacterFeatureOptionRef[] | null
  level: number | null // int — for features that are level-gated or retroactive
}

/* --------------------------------------------------------------------------
 Modifiers — final, resolved links to subfeature modifiers granted to the PC.
 Use IDs to the canonical SubfeatureModifier; apply logic on the client.
--------------------------------------------------------------------------- */
export interface CharacterModifier extends CharacterGrantRef {
  subfeatureModifierId: string // FK → SubfeatureModifier.id
  featureLevel: number | null // int — convenience for UI display/filtering
}

/* --------------------------------------------------------------------------
 Senses — grants of system-defined senses (darkvision, tremorsense, etc.).
--------------------------------------------------------------------------- */
export interface CharacterSense extends CharacterGrantRef {
  subfeatureSenseId: string // FK → SubfeatureSense.id
  senseId: string // FK → SystemSense.id
  featureLevel: number | null // int
}

/* --------------------------------------------------------------------------
 Feats — feats granted/selected by this character (not their definitions).
--------------------------------------------------------------------------- */
export interface CharacterFeat extends CharacterGrantRef {
  subfeatureFeatId: string // FK → SubfeatureFeat.id (the grant), not Feat.id
  featureLevel: number | null // int
}

/* --------------------------------------------------------------------------
 Proficiencies — skill, tool, language, save, or equipment proficiency grants.
 Only one of the specific target IDs should be set per record.
--------------------------------------------------------------------------- */
export interface CharacterProficiency extends CharacterGrantRef {
  subfeatureProficiencyId: string // FK → SubfeatureProficiency.id
  // Target (one-of)
  skillId: string | null
  languageId: string | null
  saveAbilityId: string | null
  propertyId: string | null // e.g., weapon category/property
  equipmentId: string | null // specific equipment proficiency
  featureLevel: number | null // int
}

/* --------------------------------------------------------------------------
 Expertise — same target space as Proficiencies but at the expertise level.
--------------------------------------------------------------------------- */
export interface CharacterExpertise extends CharacterGrantRef {
  subfeatureExpertiseId: string // FK → SubfeatureExpertise.id
  // Target (one-of)
  skillId: string
  languageId: string | null
  saveAbilityId: string | null
  propertyId: string | null
  equipmentId: string | null
  featureLevel: number | null // int
}

/* --------------------------------------------------------------------------
 Spell grants — what this character knows/prepared/always-prepared/etc.
 "additional" class-independent adds can use CharacterSpell directly.
--------------------------------------------------------------------------- */
export interface CharacterSpellGrantFlags {
  isRitual: boolean | null
  countAsKnown: boolean | null
  usesSlot: boolean | null
  alwaysPrepared: boolean | null
  castAtLevel: boolean | null
  requiresConcentration: boolean | null
  optionalAbility: boolean | null
}

export interface CharacterSpell extends CharacterGrantRef, CharacterSpellGrantFlags {
  subfeatureSpellId: string // FK → SubfeatureSpell.id (the grant), not Spell.id
  spellId: string // FK → Spell.id
  level: number // int — spell *slot* level when granted/recorded (not class level)
  featureLevel: number | null // int
}

/* --------------------------------------------------------------------------
 Ability generation record — capture the method + working state for builder.
--------------------------------------------------------------------------- */
export interface DieRoll {
  die: number // int
  value: number // int
  id: string | null
}

export interface AbilityRollGroup {
  score: number // int (raw total before mods)
  abilityId: string | null
  rolling: boolean | null
  applied: boolean | null
  rolled: DieRoll[]
  kept: DieRoll[] | null
}

export interface ManualAbility {
  abilityId: string
  score: number | null // int
}

export interface ManualRolled {
  configuration: string | null // e.g., "4d6dl1"
  rollGroups: AbilityRollGroup[][] | null // rows of rolls (UI history)
  manual: ManualAbility[] | null
}

export interface DistributedPoint {
  ability: string | null
  id: string
}

export interface PointBuyState {
  pointsLeft: number | null // int
  distributed: DistributedPoint[]
}

export interface StandardArrayPick {
  ability: string | null
  score: string | null
}

export interface AbilityScoreRow {
  abilityId: string | null // FK → system_abilities.id
  baseScore: number | null // int — user input or array score
  raceScore: number | null // int — from race/ancestry features
  classScore: number | null // int — from class features
  calculatedScore: number | null // int — final
  modifierScore: number | null // int — final modifier
}

export interface CharacterAbilities {
  manualRolled: ManualRolled | null
  pointBuy: PointBuyState | null
  standardArray: StandardArrayPick[] | null
  selectedSystem: string | null // FK → System.rule for ability generation
  scores: AbilityScoreRow[] | null // resolved per ability, recomputed client-side
}

/* --------------------------------------------------------------------------
 Spellcasting state — keeps prepared/known maps and slot usage.
--------------------------------------------------------------------------- */
export interface ClassSpellGrant extends CharacterSpellGrantFlags {
  spellId: string
  classId: string
  abilityId: string | null
}

export interface ClassSpellListByLevel {
  level: number // int — character level for this list bucket
  spells: ClassSpellGrant[] | null
}

export interface CharacterSpellSlots {
  level: number // int — slot level (1..9), not class level
  used: number // int — how many used at this slot level
  classId: string
}

export interface CharacterSpellcasting {
  prepared: ClassSpellListByLevel[] | null
  known: ClassSpellListByLevel[] | null
  additional: CharacterSpell[] | null // non-class-sourced “bonus” spells
  spellSlots: CharacterSpellSlots[] | null // per-class usage
}

/* --------------------------------------------------------------------------
 Classes, subclasses, levels.
--------------------------------------------------------------------------- */
export interface CharacterSubclassRef {
  id: string // FK → Feature.id or Subtype.id (depending on your binding)
  subtype: string | null // FK → Subtype.id if you keep both
}

export interface CharacterClassRef {
  id: string // FK → Class.id
  subclass: CharacterSubclassRef | null
  level: number // int — class level
}

/* --------------------------------------------------------------------------
 Equipment & currencies — owned and equipped/attuned.
--------------------------------------------------------------------------- */
export enum StartingEquipmentSource {
  CLASS,
  BACKGROUND,
}
export interface CharacterStartingEquipmentItem {
  id: string // character-owned row id
  selectionId: string | null // which system selection spawned it
  quantity: number // int
}

export interface CharacterStartingEquipmentGroup {
  optionId: string
  groupId: string
  equipment: CharacterStartingEquipmentItem[]
}

export interface StartingEquipmentState {
  option: string // FK → ClassStartingEquipment.optionId
  goldOption: string // FK → gold choice id
  totalGold: number // int
  equipmentGroups: CharacterStartingEquipmentGroup[] | null
  addedToCharacter: boolean | null
  source: StartingEquipmentSource
}

export interface CharacterCurrency {
  id: string // FK → Currency.id
  amount: number // int
}

export interface CurrencyGroup {
  currencies: CharacterCurrency[]
  container: string // FK → equipment container id (optional)
}

export interface CharacterEquipmentItem {
  id: string // character-owned row id
  equipmentId: string // FK → Equipment.id
  quantity: number // int
  containerId: string | null // FK → container in inventory
  containerPath: string | null
  customName: string | null
  notes: string | null
}

export interface CharacterEquipmentState {
  equipped: string[] | null // character item ids (from inventory)
  attuned: string[] | null // character item ids (from inventory)
  inventory: CharacterEquipmentItem[]
}

/* --------------------------------------------------------------------------
 Hit points — supports both fixed and rolled workflows.
--------------------------------------------------------------------------- */
export interface HitpointRollValue {
  level: number // int — class level the roll applied to
  value: number // int — result kept
}

export interface HitpointRollState {
  values: HitpointRollValue[]
  total: number | null // int — computed client-side
  current: number | null // int
}

export interface HitpointFixedState {
  current: number | null // int
  total: number | null // int
}

export interface CharacterHitpoint {
  method: string // FK → system_hp_calc_mthds.id
  bases: number | null // int — derived from class hit die × level, stored for UX
  maxOverride: number | null // int — manual override if used
  maxHitpoints: number | null // int — snapshot for UI; recompute client-side
  temp: number | null // int
  bonus: number | null // int — from features/equipment; derive client-side ideally
  rolled: HitpointRollState | null
  fixed: HitpointFixedState | null
}

/* --------------------------------------------------------------------------
 Character root — minimal persisted state with rich, resolvable references.
--------------------------------------------------------------------------- */
export interface Character {
  id: string
  label: string
  description: string | null

  // Progression & core identity
  advancementId: string | null // FK → CharacterSetting.advancementMethods
  expId: string | null // FK → experience tracker config (if used)
  raceId: string | null
  ancestryId: string | null
  backgroundId: string | null
  classes: CharacterClassRef[]

  // Core subsystems
  hitpoint: CharacterHitpoint | null
  abilities: CharacterAbilities | null
  spellcasting: CharacterSpellcasting | null

  // Equipment & currency
  startingEquipment: StartingEquipmentState[] | null
  equipment: CharacterEquipmentState | null
  currencyGroups: CurrencyGroup[] | null

  // Feature “enrollments” (source-level tracking)
  features: CharacterFeatureRef[] | null

  // Subfeature grants (resolved, actionable)
  feats: CharacterFeat[] | null
  proficiencies: CharacterProficiency[] | null
  expertise: CharacterExpertise[] | null
  modifiers: CharacterModifier[] | null
  senses: CharacterSense[] | null

  // Ownership
  userId: string
  systemId: string
}
