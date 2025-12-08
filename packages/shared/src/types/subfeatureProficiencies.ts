import type { Prerequisite } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE PROFICIENCY export interface — GRANTED PROFICIENCIES & SELECTION LOGIC
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines all proficiency types a Feature, Feat, Class, or Background grants
to a character — including skills, saving throws, tools, weapons, armor,
languages, and equipment categories.

Behavioral Attributes (`attributeIds`):
---------------------------------------
Each value in `attributeIds` references a `SystemAttribute` tagged with
`FEATURE_EXPERTISE` or `FEATURE_PROFICIENCIES`. These attributes define
*how* the expertise is granted — not what it applies to. Examples include:

• **Provides Options** — User may choose which skills or tools to gain expertise in.
• **All Options** — Automatically grants expertise in all listed proficiencies.

These are data-driven behavioral flags that control UI rendering and logic,
not mechanical or numerical modifiers.

Structure:
----------
• `categoryId` — References a SystemProficiencyCategory (e.g. Skills, Weapons).
• `levelId` — References the proficiency level (Normal, Half, Double, etc.).
• `roundingId` — Optional rounding behavior for derived proficiency bonuses.
• `attributeIds` — Behavioral attributes that determine how the proficiency
  behaves in the builder or engine (e.g. "Choose N", "Grants Expertise").
• `selectionCount` — How many proficiencies can be chosen by the player.
• `saveAbilityIds`, `skillIds`, `languageIds` — Arrays of IDs granting direct
  proficiency in those areas.
• `properties` — Grants proficiency for *any equipment* that matches the
  listed property IDs (e.g., “Thrown”, “Versatile”).
• `equipment` — Grants proficiency for specific equipment items.
• `prerequisites` — Array of conditional rules that must be met to gain the proficiency.

Usage Examples:
---------------
• A Fighter gains proficiency with all martial weapons:
  - `categoryId`: "Weapons"
  - `properties`: { categoryId: "Weapons", propertyIds: ["Martial"] }

• A Wizard gains proficiency with daggers:
  - `equipment`: { equipmentIds: ["dagger"] }

• A Rogue can choose 4 skills:
  - `categoryId`: "Skills"
  - `selectionCount`: 4

Storage:
--------
• Stored in the `subfeatureProficiencies` table.
• Aggregated into JSON via `vw_subfeatureProficiencies_agg`.
• One row per feature → aggregated into array on parent entity.

──────────────────────────────────────────────────────────────────────────────
*/
export interface ProficiencyProperties {
  equipCategoryId: string
  equipmentIds: string[] | null
  propertyIds: string[] | null
}

export interface SubfeatureProficiency {
  id: string
  subtypeId: string | null
  attributeIds: string[] | null
  selectionCount: number | null // int
  categoryId: string
  levelId: string
  roundingId: string | null
  saveAbilityIds: string[] | null
  skillIds: string[] | null
  languageIds: string[] | null
  properties: ProficiencyProperties | null
  equipment: ProficiencyProperties | null
  prerequisites: Prerequisite[] | null
  position: number | null // int
}
