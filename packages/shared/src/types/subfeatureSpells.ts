import type { Charge, Prerequisite } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE SPELL export interface — SPELL GRANTING & SELECTION LOGIC
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines how a Feature, Feat, Item, or other entity grants access to spells,
and the behavioral rules that control selection, filtering, and usage.

Distinction:
------------
This export interface does **not** describe the Spell itself (that’s in `Spell`),
but rather the *relationship* between a Feature and one or more spells
it grants, prepares, or modifies.

Structure Overview:
-------------------
• `spellIds` — Directly granted or selectable spells.
• `spellsByLevel` — Level-based granting structure (e.g. Paladin or Domain spells).
• `filters` — Restricts *which spells* are available for selection.
• `attributeSettingIds` — Behavioral flags (UUIDs from `SystemAttribute` with
  tag `FEATURE_SPELLS`) that tell the system *how* this feature behaves
  (e.g. "Always Prepared", "Cast at Level", "Limit Use").
• `abilityId` — Optional override for spellcasting ability (e.g. a subclass
  feature that uses CHA instead of WIS).
• `spellLevel` — Fixed or enforced casting level for the granted spells.
• `selectionCount` — How many spells the player may choose from the pool.
• `prerequisiteIds` — Conditions that must be met for this grant to apply.
• `charges` — Optional Charge block defining limited uses or rest-based resets.

Behavioral Toggles (`attributeSettingIds`):
-------------------------------------------
Each value in this array references a `SystemAttribute` record tagged
with `FEATURE_SPELLS`. These control both **builder UI rendering** and
**character engine logic**. Examples include:

• **Limit By Attribute** — Restricts selectable spells to those whose
  `Spell.attributeIds` contain at least one of the specified filters.
  (e.g. only “Requires Concentration” spells)

• **Limit By Level** — Restricts selectable spells by `Spell.level`.

• **Cast At Level** — Locks the granted spell to a fixed cast level.

• **Always Prepared** — Marks the granted spell(s) as always prepared.

• **Limit Use** — Enables a `Charge` block for usage limits.

• **Add Spells By Level** — Enables the `spellsByLevel` structure, granting
  new spells automatically as the character gains levels.

• **Self Only** — Restricts targeting logic to the caster.

These are *data-driven* flags — adding new attributes to the system registry
immediately enables new behaviors without schema changes.

Frontend Usage:
---------------
• The builder loads all system attributes tagged `FEATURE_SPELLS`.
• When one is selected, the form dynamically exposes the relevant inputs
  (e.g. filters, spell level, charge settings).
• Filters determine *which* spells appear in the dropdown.
• Attribute settings determine *how* the granted spells behave.

Storage:
--------
• Stored in the `subfeatureSpells` table.
• Aggregated into JSON via `vw_subfeatureSpells_agg`.
• One row per feature → aggregated into array on parent entity.

──────────────────────────────────────────────────────────────────────────────
*/
export interface SubfeatureSpell {
  id: string
  spellIds: string[] | null
  spellsByLevel: SpellsByLevel[] | null
  filters: FeatureSpellFilters | null
  attributeIds: string[] | null
  selectionCount: number | null
  abilityId: string | null
  spellLevel: number | null
  subtypeId: string | null
  prerequisites: Prerequisite[] | null
  charges: Charge | null
  position: number | null // int
}

/*
Defines filters that restrict which spells are available for selection.
Used in conjunction with `Limit By Level` or `Limit By Attribute` behaviors.
*/
export interface FeatureSpellFilters {
  classIds: string[] | null
  levels: number[] | null
  attributeIds: string[] | null
}

/*
Level-based spell grant configuration.
Used when a feature automatically grants new spells as levels increase.
*/
export interface SpellsByLevel {
  spellIds: string[]
  level: number
  spellLevel: number | null
}
