/*
──────────────────────────────────────────────────────────────────────────────
PREREQUISITE export interface — DATA CONTRACT & DESIGN INTENT
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
The `Prerequisite` export interface defines a single rule or filter condition that must be
met before a Feature, Option, Feat, Class, Race, Background, or Equipment entry
can be chosen or applied to a Character.

Each parent (Feature, Option, etc.) may contain multiple prerequisites, stored
as an **array of Prerequisite objects**. Each object represents exactly one
rule instance (e.g., "Has Equipped Shield", "Not Equipped Heavy Armor",
"DEX ≥ 13").

Structure:
----------
- `categoryId` references a row in `system_prerequisites`, which defines
  the master rule export interface (e.g., "Has Equipped", "Skill Proficiency", "Ability Score").
  This acts as both the rule's export interface identifier and its metadata source (label,
  role, uiGroup, tags, etc.).

- All other fields within the object (equipmentIds, skillIds, abilityScore, etc.)
  provide the **parameters** for that rule instance.

- Each prerequisite can reference one or more foreign keys that identify what
  the rule applies to — skills, equipment, spells, features, etc.

Normalization & Storage:
------------------------
• In the database, each `Prerequisite` object corresponds to one row in the
  `prerequisites` table, linked to its parent entity via FK columns
  (`feature_id`, `option_id`, `feat_id`, etc.).

• Nested data (equipmentIds, skillIds, etc.) is stored in typed junction tables:
  `prerequisite_field_equipment`, `prerequisite_field_skills`, etc.

• Aggregation views (e.g., `vw_prerequisites_agg`) reconstruct this JSON shape
  by joining those subtype tables and grouping their values by prerequisite string.

Evaluation:
-----------
• At runtime, only prerequisites whose `role` in the system definition is "gate"
  or "both" are evaluated by the character rules engine.

• Prerequisites with `role = filter` are used solely for the authoring UI —
  they hide or disable certain options, but are not persisted or evaluated as
  gameplay restrictions.

Frontend Behavior:
------------------
• The builder UI loads all available prerequisite kinds from `system_prerequisites`
  (via the system's master JSON). It filters them by their `tags` to show only
  the ones applicable to the current parent export interface (Feature, Option, etc.).

• When a user adds a prerequisite, they choose a rule kind (systemOptionId),
  and the UI dynamically renders the input fields required by that rule
  (equipment selectors, skill dropdowns, ability score, etc.).

• Multiple prerequisite rules can be added — each becomes a separate object
  within the parent's `prerequisites` array.

Consistency & Naming:
---------------------
• All FK or reference fields use the "string" or "Ids" suffix to clearly denote
  that they contain UUID references rather than expanded objects.

• This ensures future compatibility if you later decide to include expanded
  versions of those entities (e.g., `skillIds` vs. `skills`).

Summary:
--------
- Each Prerequisite = one logical or UI rule.
- Stored and aggregated independently.
- Linked to its master definition via `systemOptionId`.
- Evaluated or filtered based on the `role` of its system definition.
- Designed for full extensibility and schema stability.
- Fills array property on parent

──────────────────────────────────────────────────────────────────────────────
*/
export enum PrerequisiteRole {
  GATE = 'GATE',
  FILTER = 'FILTER',
  BOTH = 'BOTH'
}

export interface Prerequisite {
  id: string
  categoryId: string
  role: PrerequisiteRole
  equipment: EquipPrerequisite[] | null
  skillIds: string[] | null
  sizeIds: string[] | null
  featureIds: string[] | null
  subfeatureOptionIds: string[] | null
  spellIds: string[] | null
  abilityScore: AbilityScore | null
  position: number // int
}

export interface EquipPrerequisite {
  equipCategoryId: string
  propertyIds: string[] | null
  equipmentIds: string[] | null
  numberEquipped: number | null // int
}

export interface AbilityScore {
  abilityIds: string[]
  score: number | null // int
}
