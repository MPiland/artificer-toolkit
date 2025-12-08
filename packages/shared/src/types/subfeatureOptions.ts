import type { Actions, Charge, Damage, Prerequisite, SaveDc, Shape, Range } from './shared'
import type { SubfeatureExpertise } from './subfeatureExpertise'
import type { SubfeatureFeat } from './subfeatureFeats'
import type { SubfeatureModifier } from './subfeatureModifiers'
import type { SubfeatureProficiency } from './subfeatureProficiencies'
import type { SubfeatureSense } from './subfeatureSenses'
import type { SubfeatureSpell } from './subfeatureSpells'

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE OPTION export interface — SUBFEATURE VARIANT DEFINITIONS
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines a selectable or granted *variant* of a Feature.
Each FeatureOption represents one branch or subfeature that a player can
choose (or be granted automatically) as part of a Feature, Class ability,
Race trait, or other modular element.

A Feature may have many options (e.g., Fighting Styles, Metamagic choices,
Domain options, etc.). Each option can itself include nested mechanics such as
damage, charges, spells, proficiencies, and more.

Structure:
----------
• `label` / `description` / `detail` — Presentation fields for UI and exports.
• `categoryId` — Used for tagging or logical grouping within the Feature.
• `attributeIds` — Controls option behavior (e.g., "Provides Options",
  "All Options").

• Subfeature fields mirror other feature-level definitions:
  - `actions` → How this option uses an action (ActionGroup)
  - `damage` → Damage configuration (Damage)
  - `charges` → Usage and reset rules (Charge)
  - `range`, `shape` → Positional / AoE definitions
  - `targets` → Max number of targets affected

• Nested relationships:
  - `feats` → Grants or allows Feat choices (SubfeatureFeat)
  - `modifiers` → Grants attribute or rule modifications (SubfeatureModifier)
  - `proficiencies` → Grants skill/equipment proficiencies (SubfeatureProficiency)
  - `expertise` → Grants advanced proficiencies (SubfeatureExpertise)
  - `senses` → Adds or modifies senses (SubfeatureSense)
  - `spells` → Grants or modifies spell access (SubfeatureSpell)
  - `prerequisites` → Rules that must be met to unlock or select this option
  - `saveDc` → Defines DC formula for any saving throw effects

• `levelAvailable` — The minimum character level required to unlock this option.

Behavior:
---------
Options can be either:
• *Selectable*: Player chooses one or more based on Feature attributes.
• *Granted*: Automatically applied if no "Provides Options" flag is set.
• *Chained*: Nested under another option to create hierarchical feature trees.

Storage:
--------
• Stored in the `subfeature_options` table.
• Aggregated into JSON via `vw_subfeature_options_agg`.
• One row per feature → aggregated into array on parent entity.

──────────────────────────────────────────────────────────────────────────────
*/
export interface SubfeatureOption {
  id: string
  label: string | null
  description: string | null
  detail: string | null
  categoryId: string
  attributeIds: string[] | null
  actions: Actions | null
  damage: Damage | null
  charges: Charge | null
  range: Range | null
  shape: Shape | null
  targets: number | null // int
  feats: SubfeatureFeat[] | null
  modifiers: SubfeatureModifier[] | null
  proficiencies: SubfeatureProficiency[] | null
  expertise: SubfeatureExpertise[] | null
  senses: SubfeatureSense[] | null
  spells: SubfeatureSpell[] | null
  prerequisites: Prerequisite[] | null
  saveDc: SaveDc | null
  position: number | null // int
}
