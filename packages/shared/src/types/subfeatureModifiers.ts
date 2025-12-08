import type { Damage, Prerequisite, UsesPerLevel } from './shared'

/*
──────────────────────────────────────────────────────────────────────────────
MODIFIER TARGETS — DEFINITION OF WHAT THE MODIFIER APPLIES TO
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Specifies which systems, entities, or mechanics this modifier affects.
Each property represents a potential target domain (e.g., skills, spells,
ranges, charges, or ability scores).

Structure:
----------
• Core statistics (abilityIds, skillIds, saveAbilityIds)
• Combat values (damageTypeIds, conditionIds)
• Geometry/time (rangeId, shapeId, durationId)
• Resource controls (chargeLimitId, chargeResetId)
──────────────────────────────────────────────────────────────────────────────
*/
export interface ModifierTargets {
  // --- Core mechanics ---
  abilityIds: string[] | null // FK → system_abilities.id[]
  skillIds: string[] | null // FK → system_skills.id[]
  saveAbilityIds: string[] | null // FK → system_abilities.id[]
  featureId: string | null // FK → features.id

  // --- Spells and attacks ---
  spellId: string | null // FK → spells.id
  spellCategoryId: string | null // FK → system_spell_categories.id
  damageTypeIds: string[] | null // FK → system_damage_types.id[]
  conditionIds: string[] | null // FK → system_conditions.id[]
  speedIds: string[] | null // FK → system_speeds.id[]

  // --- Spatial & temporal adjustments ---
  rangeId: string | null // FK → system_ranges.id
  shapeId: string | null // FK → system_shapes.id
  durationId: string | null // FK → system_durations.id

  // --- Charge resource modifications ---
  chargeLimitId: string | null // FK → system_charge_limits.id (e.g., per_day)
  chargeResetId: string | null // FK → system_charge_resets.id (e.g., long_rest)
}

/*
──────────────────────────────────────────────────────────────────────────────
MODIFIER EFFECT — DESCRIPTION OF THE NUMERIC OR QUALITATIVE CHANGE
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Encapsulates the *magnitude*, *method*, and *behavior* of a modifier.
Supports static numbers, dice expressions, scaling per level, or direct
set/multiply operations. This applies to any numeric system (damage, range,
duration, charges, etc.).

Structure:
----------
• `setAmount` — Overrides the value completely.
• `addAmount` — Adds to an existing value.
• `multiplier` — Scales multiplicatively (e.g. ×2 range or duration).
• `minAmount` / `maxAmount` — Bounds for dice or scaling values.
• `distance` / `unitId` — Physical modifiers for geometry.
• `usesPerLevel` — Charge- or feature-scaling by level.
• `abilityId` — Optional override ability used for scaling.
──────────────────────────────────────────────────────────────────────────────
*/
export interface ModifierEffects {
  // --- Numeric modifiers ---
  minAmount: number | null // Lower bound for variable modifiers
  maxAmount: number | null // Upper bound for variable modifiers
  setAmount: number | null // Absolute value (overrides all others)
  addAmount: number | null // Additive value (+1, +5 ft, etc.)
  multiplier: number | null // e.g. 2 → double; 0.5 → halve
  dieConfig: string | null // Dice string, e.g. "2d6"
  scalePerLevel: ModifierScalePerLevel[] | null
  damage: Damage | null // Optional: attach unified damage config

  // --- Physical and temporal adjustments ---
  distance: number | null // e.g. “+30 ft range” or “radius 10 ft”
  unitId: string | null // FK → system_measurements.id
  amount: number | null // e.g. duration amount (+1 round)

  // --- Charge and resource scaling ---
  usesPerLevel: UsesPerLevel[] | null // Level-based scaling (for charges/resources)
  abilityId: string | null // Override ability for scaling behavior
  size: number | null // size for the shape override
}

/*
──────────────────────────────────────────────────────────────────────────────
MODIFIER SCALE PER LEVEL — UNIFIED DIE / STATIC VALUES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines level-based scaling for modifiers. Each record specifies either a
die configuration (variable) or a static amount (fixed). Used by both
damage and non-damage effects.

Example:
--------
[
  { level: 1, dieConfig: "1d6" },
  { level: 5, dieConfig: "2d6" },
  { level: 11, setAmount: 10 }
]
──────────────────────────────────────────────────────────────────────────────
*/
export interface ModifierScalePerLevel {
  level: number // int — level threshold
  dieConfig: string | null // Optional dice string
  setAmount: number | null // Optional flat amount
}

/*
──────────────────────────────────────────────────────────────────────────────
SUBFEATURE MODIFIER — UNIVERSAL MECHANICAL ADJUSTMENT
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines any mechanical adjustment that alters how a feature, spell, item, or
character behaves. A modifier describes *what* it affects (targets) and
*how* it changes that target (effect).

Examples:
---------
• “+1 to melee attack rolls.”
• “Add 30 ft to the range of spells you cast.”
• “Your Arcane Recovery regains on a Short Rest instead of a Long Rest.”
• “Your Breath Weapon deals 2d6 fire damage at level 5.”

Normalization:
--------------
• Stored in `subfeatureModifiers`.
• Nested arrays normalized into:
  - `modifier_targets`
  - `modifier_effects`
  - `modifier_scale_per_level`
• Aggregated through `vw_modifiers_agg`.

Structure:
----------
• `categoryId` → High-level scope (Attack, AC, Spell, Charges, etc.)
• `typeId` → Qualitative effect (Bonus, Penalty, Resistance, Set Value, etc.)
• `methodId` → Calculation rule (Set Globally, Per Level, Ability Mod, etc.)
• `targets` → What the modifier applies to.
• `effect` → How it modifies those targets.
──────────────────────────────────────────────────────────────────────────────
*/
export interface SubfeatureModifier {
  id: string
  subtypeId: string | null // FK → class_subtypes.id or null
  categoryId: string | null // FK → system_modifier_categories.id
  typeId: string | null // FK → system_modifier_types.id
  methodId: string | null // FK → system_modifier_methods.id
  methodAbilityId: string | null // FK → system_abilities.id (for scaling)
  methodSkillId: string | null // FK → system_skills.id (for scaling)
  attributeIds: string[] | null // FK → system_attributes.id[]
  selectionCount: number | null // int — how many choices this modifier allows
  prerequisites: Prerequisite[] | null // FK → prerequisites.id

  // --- Linked data groups ---
  targets: ModifierTargets | null // What this modifier applies to
  effects: ModifierEffects | null // How it changes its targets
  position: number | null // int
}
