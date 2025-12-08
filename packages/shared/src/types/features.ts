import type { Actions, Charge, Damage, Prerequisite, SaveDc, Range, Shape } from './shared'
import type { SubfeatureExpertise } from './subfeatureExpertise'
import type { SubfeatureFeat } from './subfeatureFeats'
import type { SubfeatureModifier } from './subfeatureModifiers'
import type { SubfeatureOption } from './subfeatureOptions'
import type { SubfeatureProficiency } from './subfeatureProficiencies'
import type { SubfeatureSense } from './subfeatureSenses'
import type { SubfeatureSpell } from './subfeatureSpells'

/*
──────────────────────────────────────────────────────────────────────────────
FEATURE export interface — CORE MODULAR ABILITY DEFINITION
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents a single gameplay feature or trait that can be granted by a
Class, Subclass, Race, Ancestry, Background, or Feat.

Each Feature encapsulates a complete rules element — an ability,
passive effect, attack option, or choice tree. Features are the
primary building blocks of the character engine and serve as
containers for nested mechanics such as damage, spells, and proficiencies.

Structure:
----------
• `label` / `description` / `detail`
  - Text fields for display, export, or reference.
  - `detail` is optional extra text, often for flavor or extended rules.

• `categoryId`
  - Groups features by logical or thematic category
    (e.g., “Class Feature”, “Racial Trait”, “Passive Ability”).

• `attributeIds`
  - Behavioral modifiers (tags) determining feature behavior or visibility.
  - Examples: "Provides Options", "All Options", "Hidden in Builder".

• `actions`, `damage`, `charges`
  - One-to-one mechanic objects defining how the feature is used, what it does,
    and how often it can be used.

• `optionsByLevel`
  - Optional scaling table that defines how many feature options become available
    at specific character levels. Used for feature trees such as Invocations
    or Fighting Styles.

• `range`, `shape`, `targets`
  - Spatial and targeting parameters for action-based or spell-like features.

• Nested collections of subfeatures:
  - `feats` → Grants or allows Feat selections.
  - `modifiers` → Alters derived statistics, attributes, or abilities.
  - `proficiencies` → Grants proficiency in skills or equipment.
  - `expertise` → Grants double proficiency or enhanced proficiency.
  - `senses` → Adds or upgrades sensory capabilities.
  - `spells` → Grants spellcasting or specific spells.
  - `options` → Defines selectable or variant subfeatures.

• `prerequisites`
  - Gatekeeping rules determining whether a character is eligible to gain
    or select the feature.

• `saveDc`
  - Optional save-difficulty formula for effects that require saving throws.

• `levelAvailable`
  - The level at which this feature first becomes available to a character.

Behavior:
---------
Features can:
• Be granted automatically at a specific level.
• Offer options that players choose at creation or level-up.
• Contain nested mechanics that modify rules, stats, or resources.
• Scale with level or external attributes.

Storage:
--------
• Stored in `features` (core table).
• Related entities (modifiers, proficiencies, etc.) stored in typed sub-tables
  (`subfeatureModifiers`, `subfeatureSpells`, etc.) and connected with bridges (`feature_subfeatureModifiers`, `feature_subfeatureSpells`, etc).
• Aggregated back into JSON through `vw_features_agg`.

──────────────────────────────────────────────────────────────────────────────
*/
export interface OptionsByLevel {
  level: number // int
  count: number // int
  replaceCount: number | null // int
}

export interface Feature {
  id: string
  label: string | null
  description: string | null
  detail: string | null
  categoryId: string
  attributeIds: string[] | null
  actions: Actions | null
  damage: Damage | null
  charges: Charge | null
  optionsByLevel: OptionsByLevel[] | null
  range: Range | null
  shape: Shape | null
  targets: number | null // int
  feats: SubfeatureFeat[] | null
  modifiers: SubfeatureModifier[] | null
  proficiencies: SubfeatureProficiency[] | null
  expertise: SubfeatureExpertise[] | null
  senses: SubfeatureSense[] | null
  spells: SubfeatureSpell[] | null
  options: SubfeatureOption[] | null
  prerequisites: Prerequisite[] | null
  saveDc: SaveDc | null
  levelAvailable: string
  position: number | null // int
}

export interface FeatureListItem {
  id: string
  label: string
  description: string | null
  detail: string
}
