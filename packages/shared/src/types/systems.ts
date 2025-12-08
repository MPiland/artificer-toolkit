/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM export interface — MASTER GAME DEFINITION BLUEPRINT
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines the complete configuration and master data for a tabletop or
RPG rule system (e.g., D&D 5e, Pathfinder 2e, custom homebrew rulesets).
Each System acts as the top-level container for all entity registries
— abilities, actions, measurements, modifiers, etc. — used by content.

Structure Overview:
-------------------
• `label`, `description` — Metadata identifying the ruleset.
• `abilities`, `actions`, `alignments`, `attributes`, `categories`
  - Canonical option lists used across the schema.
• `charges` — Master reset and limit definitions for the Charge system.
• `equipment`, `proficiencies`, `spells`, `modifiers`
  - Subsystems defining domain-specific registries.
• `rules` — Defines global system rules (measurements, ability generation, etc.).
• `prerequisites` — Registry of prerequisite rule kinds.
• `userId`, `masterId` — Identify canonical (“master”) vs. user-defined systems.

Normalization:
--------------
• Stored in `systems`.
• Aggregated in JSON via `vw_systems_agg`.
• Each sub-collection (equipment, proficiency, modifiers, etc.)
  is stored in its own child table with `system_id` FK.

──────────────────────────────────────────────────────────────────────────────
*/
export interface System {
  id: string
  label: string
  description: string | null
  abilities: GenericOption[]
  actions: SystemAction[]
  alignments: GenericOption[]
  attributes: SystemAttribute[]
  categories: SystemCategory[]
  characterSettings: CharacterSettings
  charges: SystemCharges
  conditions: GenericOption[]
  currencies: Currency[]
  damageTypes: GenericOption[]
  equipment: EquipmentOptions
  languages: GenericOption[]
  modifiers: SystemModifiers
  passives: GenericOption[]
  prerequisites: SystemPrerequisite[]
  proficiencies: SystemProficiency
  ranges: GenericOption[]
  rules: SystemRules
  senses: SystemSense[]
  sizes: GenericOption[]
  skills: SystemSkill[]
  speeds: GenericOption[]
  spells: SystemSpell
  tags: TagsEnum[]
  terrains: GenericOption[]
  userId: string
}

/*
──────────────────────────────────────────────────────────────────────────────
GENERIC OPTION export interface — BASE STRUCTURE
──────────────────────────────────────────────────────────────────────────────

Used throughout the system for simple enumerations such as abilities,
categories, damage types, etc.
*/
export interface GenericOption {
  id: string
  label: string
  description: string | null
  tooltip: string | null
  short: string | null
  code: string
}

/*
──────────────────────────────────────────────────────────────────────────────
CURRENCY — BASE STRUCTURE
──────────────────────────────────────────────────────────────────────────────

Used throughout the system for simple enumerations such as abilities,
categories, damage types, etc.
*/

export interface CurrencyConversion {
  copper: number // float
  silver: number // float
  gold: number // float
  electrum: number // float
  platinum: number // float
}

export interface Currency {
  id: string
  label: string
  description: string | null
  abbreviation: string
  conversions: CurrencyConversion
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM RULES — MEASUREMENTS & ABILITY GENERATION
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines unit measurement systems and ability generation methods for
character creation and mechanical scaling.

Structure:
----------
• `measurementSystem` — Enum indicating which global measurement set to use.
• `amounts`, `rounding` — Lists of available numeric scales and rounding rules.
• `weights`, `volumes`, `lengths` — Generic option lists representing units.
• `abilityGenerateMethods` — Rules for generating ability scores (e.g. 4d6 drop lowest).

Normalization:
--------------
• Stored in `system_meas`.
• Measurement definitions stored in `system_meas_opts`.
• Linked to a System record by `system_id`.
*/
export enum MeasurementSystemEnum {
  IMPERIAL = 'IMPERIAL',
  METRIC = 'METRIC'
}

export enum MeasurementTypeEnum {
  VOLUME = 'VOLUME',
  WEIGHT = 'WEIGHT',
  LENGTH = 'LENGTH'
}

export interface SystemRules {
  measureUnits: MeasurementOption[]
  measureAmounts: GenericOption[]
  measureRounding: GenericOption[]
  abilityGenerateMethods: AbilityGenerateMethod[]
}

export interface MeasurementOption {
  id: string
  label: string
  description: string | null
  tooltip: string | null
  short: string | null
  measurementSystem: MeasurementSystemEnum
  types: MeasurementTypeEnum[]
  code: string
}

export interface AbilityGenerateMethod {
  id: string
  label: string
  total: number | null // int
  options: GenerateOption[]
  code: string
}

export interface GenerateOption {
  id: string
  label: string
  reduce: number | null // int
  code: string
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM CHARGES — RESET & LIMIT DEFINITIONS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines the master catalog of reset and usage limit rules available to a
System. These govern how abilities and resources refresh or scale.
*/

export interface ChargeOption {
  id: string
  label: string
  description: string | null
  tags: TagsEnum[]
  code: string
}

export interface SystemCharges {
  resets: ChargeOption[]
  limits: ChargeOption[]
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM EQUIPMENT — CATEGORY, PROPERTY, & RARITY REGISTRIES
──────────────────────────────────────────────────────────────────────────────
*/
export interface EquipmentCategoryProperty {
  propertyId: string
  categoryId: string
}

export interface EquipmentOptions {
  categories: GenericOption[]
  properties: GenericOption[]
  categoryProperties: EquipmentCategoryProperty[]
  rarities: GenericOption[]
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM MODIFIERS — CATEGORIES, TYPES, & METHODS
──────────────────────────────────────────────────────────────────────────────
*/
export interface ModifierCategoryType {
  typeId: string
  categoryId: string
}

export interface ModifierTypeMethod {
  typeId: string
  methodId: string
}

export interface ModifierCategoryTypeMethod {
  methodId: string
  typeId: string
  categoryId: string
}

export interface SystemModifiers {
  categories: GenericOption[]
  types: GenericOption[]
  methods: GenericOption[]
  spellCategories: GenericOption[]
  categoryTypes: ModifierCategoryType[]
  typeMethods: ModifierTypeMethod[]
  categoryMethods: ModifierCategoryTypeMethod[]
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM PROFICIENCY — LEVELS & CATEGORIES
──────────────────────────────────────────────────────────────────────────────
*/
export interface ProficiencyLevel {
  id: string
  label: string
  multiplier: number // float
  code: string
}

export interface SystemProficiency {
  levels: ProficiencyLevel[]
  categories: GenericOption[]
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM SPELL — SCHOOLS, SHAPES, & RANGE DATA
──────────────────────────────────────────────────────────────────────────────
*/
export interface SystemSpell {
  categories: GenericOption[]
  durations: GenericOption[]
  schools: GenericOption[]
  shapes: GenericOption[]
  requirements: GenericOption[]
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM PREREQUISITES — RULE TEMPLATE REGISTRY
──────────────────────────────────────────────────────────────────────────────
*/

export interface SystemPrerequisite {
  id: string
  label: string
  tags: TagsEnum[]
  description: string | null
  code: string
}

/*
──────────────────────────────────────────────────────────────────────────────
SYSTEM ACTIONS, ATTRIBUTES, & SUPPORTING TYPES
──────────────────────────────────────────────────────────────────────────────
*/
export enum TagsEnum {
  FEATURES = 'FEATURES',
  FEATURE_SPELLS = 'FEATURE_SPELLS',
  DAMAGE = 'DAMAGE',
  FEATS = 'FEATS',
  SECTIONS = 'SECTIONS',
  SPELLS = 'SPELLS',
  EQUIPMENT = 'EQUIPMENT',
  CLASSES = 'CLASSES',
  CLASS_EQUIPMENT = 'CLASS_EQUIPMENT',
  SAVE_DC = 'SAVE_DC',
  OPTIONS = 'OPTIONS',
  MAIN = 'MAIN',
  POOL = 'POOL',
  BONUS = 'BONUS',
  UPCAST = 'UPCAST',
  SUBCLASSES = 'SUBCLASSES',
  SHIELDS = 'SHIELDS',
  ADVENTURING_GEAR = 'ADVENTURING_GEAR',
  WEAPONS = 'WEAPONS',
  ARMOR = 'ARMOR',
  TOOL = 'TOOL',
  BACKGROUNDS = 'BACKGROUNDS',
  BACKGROUND_EQUIPMENT = 'BACKGROUND_EQUIPMENT',
  SPELLCASTERS = 'SPELLCASTERS',
  BASE = 'BASE',
  RESOURCES = 'RESOURCES',
  PREPARE_LIMIT = 'PREPARE_LIMIT',
  RACES = 'RACES',
  MONSTERS = 'MONSTERS',
  CREATURES = 'CREATURES'
}

export interface SystemAction {
  id: string
  label: string
  tags: TagsEnum[]
  description: string | null
  code: string
}

export interface SystemAttribute {
  id: string
  label: string
  tags: TagsEnum[]
  code: string
}

export interface SystemCategory {
  id: string
  label: string
  tags: TagsEnum[]
  code: string
}

export interface SystemSense {
  id: string
  label: string
  creatureDescription: string | null
  monsterDescription: string | null
  tags: string[]
  code: string
}

export interface SystemSkill {
  id: string
  label: string
  description: string | null
  abilityId: string
  code: string
}

/*
──────────────────────────────────────────────────────────────────────────────
CHARACTER SETTINGS — GLOBAL CREATION OPTIONS
──────────────────────────────────────────────────────────────────────────────
*/
export interface CharacterSettings {
  hitpointCalcMethods: GenericOption[]
  advancementMethods: GenericOption[]
  spellPointCalcMethods: GenericOption[]
  startingEquipmentOptions: GenericOption[]
}

/*
──────────────────────────────────────────────────────────────────────────────
LIST & CONNECTION TYPES — PAGINATION SUPPORT
──────────────────────────────────────────────────────────────────────────────
*/
export interface SystemListItem {
  id: string
  label: string
  description: string | null
  userId: string
}
