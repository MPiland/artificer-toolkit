import type { Prerequisite } from './shared/prerequisites'

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE EXPERTISE export interface — PROFICIENCY ENHANCEMENT LOGIC
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines expertise (enhanced proficiency) granted by a Feature, Feat,
Class, or Background. Unlike normal proficiency, expertise doubles the
applicable proficiency bonus and typically requires the character to
already be proficient in the chosen skill, tool, or save.

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
• `categoryId` — References a SystemProficiencyCategory (Skills, Tools, Weapons, etc.).
• `selectionCount` — How many proficiencies can be upgraded to expertise.
• `saveAbilityIds`, `skillIds`, `languageIds` — Lists of affected abilities or skills.
• `properties` — Equipment categories or property filters this expertise applies to.
• `equipment` — Specific equipment items that gain expertise.
• `prerequisites` — Conditional rules that must be met (e.g., must already have proficiency).

Storage:
--------
• Stored in the `subfeatureExpertise` table.
• Aggregated into JSON via `vw_feature_expertise_agg`.
• One row per feature → aggregated into array on parent entity.

──────────────────────────────────────────────────────────────────────────────
*/
export interface ExpertiseProperties {
  equipCategoryId: string
  equipmentIds: string[] | null
  propertyIds: string[] | null
}

export interface SubfeatureExpertise {
  id: string
  subtypeId: string | null
  attributeIds: string[] | null
  selectionCount: number | null // int
  categoryId: string
  saveAbilityIds: string[] | null
  skillIds: string[] | null
  languageIds: string[] | null
  properties: ExpertiseProperties | null
  equipment: ExpertiseProperties | null
  prerequisites: Prerequisite[] | null
  position: number | null // int
}
