import type { Actions, Damage, SaveDc, Range, Shape, Duration } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
SPELL export interface — MAGIC ABILITY DEFINITIONS & CASTING BEHAVIOR
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines a spell within a game system, describing how it is cast,
what it affects, and how it scales. Each spell may be granted by a
Class, Feature, Feat, or Race.

Structure:
----------
• `label` / `description`
  - Core presentation fields for display and export.

• `castingTime`
  - Uses a `CastingTime` object defining the base action and optional
    duration of that action (e.g., Action, Reaction, 1 Minute).

• `level`
  - Spell level (0–9 in standard 5e).
  - Used for filtering, spell slot calculation, and upcasting.

• `schoolId`
  - FK reference to a `SystemSchool` record (e.g., Evocation, Illusion).

• `classIds`
  - Array of Class IDs that can normally prepare or learn this spell.

• `attributeIds`
  - Additional behavioral tags (e.g., Concentration, Ritual, Requires Attack Roll).
  - These IDs map to entries in `system_attributes` tagged as `SPELLS`.

• `upcast`
  - Optional nested structure defining scaling changes when the spell is
    cast at higher levels (damage dice, range, duration, etc.).

• `actions`
  - References special actions or triggers tied to the spell (for spells that
    also consume an action or bonus action beyond casting).

• `targets`
  - Number of valid targets this spell can affect.

• `saveDc`
  - Save Difficulty Class formula that determines how hard it is to resist
    the spell (e.g., Spell Save DC = 8 + Prof + CHA).

• `conditionIds`
  - References system-defined conditions applied by the spell (e.g. Charmed).

• `requirementIds`
  - References spell requirements (e.g., Verbal, Somatic, Material).

• `range`, `shape`, `duration`
  - Define how far, wide, or long the spell’s effects reach.
  - Each uses a shared structural export interface for consistency.

• `damage`
  - Damage configuration for the spell, including dice, modifiers, and scaling.

• `materialDescription`
  - Human-readable string describing the material component (if any).

• `systemId` — Sets which ttrpg system this belongs to.
• `userId` — Sets the user that created the content if not master data.
• `masterId` — Used to determine is_master boolean column in table. If not null/empty, then false, else true.

Normalization:
--------------
• Stored in `spells`.
• `school_id` → FK to `system_schools`.
• `spells.class_ids` stored via junction table `spell_classes`.
• Aggregated into JSON through `vw_spells_agg`.

──────────────────────────────────────────────────────────────────────────────
*/
export interface UpcastLevel {
  level: number // int
  damage: Damage | null
  duration: Duration | null
  range: Range | null
  shape: Shape | null
  targets: number | null // int
}

export interface Upcast {
  attributeIds: string[] | null
  levels: UpcastLevel[]
}

export interface CastingTime {
  id: string
  actionId: string
  amount: number | null // int
}

export interface Spell {
  id: string
  label: string
  description: string
  level: number // int
  schoolId: string
  classIds: string[]
  attributeIds: string[] | null
  upcast: Upcast | null
  actions: Actions
  targets: number | null // int
  saveDc: SaveDc | null
  conditionIds: string[] | null
  requirementIds: string[]
  range: Range
  shape: Shape | null
  duration: Duration
  damage: Damage | null
  materialDescription: string | null
  userId: string
  systemId: string
}

export interface SpellListItem {
  id: string
  label: string
  description: string
  userId: string
  systemId: string
}

type SpellMetaObject = {
  spellIds: string[] | null
  id: string
}

type SpellActionMetaObject = {
  spellIds: string[] | null
  id: string
  amount: number | null // int
}

type SpellLevelObject = {
  spellIds: string[] | null
  id: number // int
}

type SpellRangeMetaObject = {
  rangeId: string
  spellIds: string[] | null
  unitId: string | null
  minRange: number | null
  maxRange: number | null
  distance: number | null
}

type SpellDurationMetaObject = {
  durationId: string
  spellIds: string[] | null
  amount: number | null // int
}

type SpellShapeMetaObject = {
  shapeId: string
  spellIds: string[] | null
  size: number | null // float
  unitId: string | null
}

export interface SpellMeta {
  attributes: SpellMetaObject[]
  primaryDamages: SpellMetaObject[]
  secondaryDamages: SpellMetaObject[]
  primaryActions: SpellActionMetaObject[]
  secondaryActions: SpellActionMetaObject[]
  conditions: SpellMetaObject[]
  classes: SpellMetaObject[]
  durations: SpellDurationMetaObject[]
  ranges: SpellRangeMetaObject[]
  shapes: SpellShapeMetaObject[]
  schools: SpellMetaObject[]
  levels: SpellLevelObject[]
  saveAbilities: SpellMetaObject[]
  requirements: SpellMetaObject[]
}
