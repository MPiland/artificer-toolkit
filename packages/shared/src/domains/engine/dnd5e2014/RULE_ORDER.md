# D&D 5e 2014 SRD — Rule Ordering Document

This document is the correctness contract for the `dnd5e2014` character engine implementation.
All ordering and stacking decisions in the engine code must trace back to a rule here.
It also serves as the template for future system implementations.

---

## 1. Feature Acquisition Order

Features are processed in the following source order. Within a source, features are
processed in ascending level order (level 1 first), then by their authored `order` field.

1. `RACE` — racial traits (e.g. Darkvision, Dwarven Resilience)
2. `SUBRACE` — subrace traits (e.g. High Elf Cantrip, Hill Dwarf HP bonus)
3. `BACKGROUND` — background feature (e.g. Sage: Researcher)
4. `CLASS` — class features by class level ascending (e.g. Fighting Style at L1, Extra Attack at L5)
5. `SUBCLASS` — subclass features by class level ascending (e.g. Evocation Savant at L2)
6. `FEAT` — feat features in selection order (e.g. Alert, Lucky)
7. `EQUIPMENT` — features granted by equipped items (e.g. magic item attunement features)

Sources `ANCESTRY`, `FEATURE`, `OPTION`, and `MANUAL` are treated as `RACE` order for
acquisition purposes — they originate from racial or manual decisions.

**Why this order matters:** Class grants (e.g. proficiencies) must not overwrite racial grants of
the same kind when stacking; processing order determines first-write semantics for exclusive modifiers.

---

## 2. Grant Application Order

Within a single feature, grants are applied in this order:

1. `PROFICIENCY_GRANT` — establishes proficiencies (saves, skills, equipment, languages) first
   so they are available when other grant types check proficiency state
2. `SENSE_GRANT` — sensory capabilities (Darkvision, Tremorsense, Blindsight, Truesight)
3. `MODIFIER_GRANT` — numeric or categorical stat modifiers (bonuses, penalties, set-values)
4. `FEAT_GRANT` — unlocks additional feat features (secondary feature expansion)
5. `SPELL_GRANT` — grants spell access (expanded spell lists, always-prepared spells)

---

## 3. Modifier Stacking Rules

Stacking is determined by `modifierKind`. The engine applies rules per kind regardless of
which value domain the modifier targets.

| Modifier Kind         | Stacking Rule | Notes |
|---|---|---|
| `BONUS`               | additive      | Untyped bonuses always stack in 5e 2014 |
| `PENALTY`             | additive      | Penalties stack (e.g. exhaustion stacks) |
| `SET_VALUE`           | last          | Explicit overrides; last processed wins |
| `ADD_BONUS_DIE`       | additive      | Multiple bonus dice stack |
| `REPLACE_DAMAGE_TYPE` | last          | Last replacement wins |
| `ADVANTAGE`           | boolean       | Advantage is binary — any source grants it |
| `DISADVANTAGE`        | boolean       | Disadvantage is binary — any source grants it |
| `ADD_OPTION`          | additive      | Set membership — each entry is distinct |
| `REMOVE_OPTION`       | additive      | Set removal — each entry is distinct |
| `REPLACE_RANGE_KIND`  | last          | Last replacement wins |
| `REPLACE_DURATION_KIND` | last        | Last replacement wins |
| `REPLACE_SHAPE_KIND`  | last          | Last replacement wins |
| `REPLACE_CHARGE_RESET_KIND` | last    | Last replacement wins |
| `MODIFY_CHARGE_LIMIT` | additive      | Charge limit deltas stack |
| `OPTIONAL_ABILITY_MODIFIER` | additive | Adds to the pool of eligible ability modifiers |

**Note on ENHANCEMENT bonuses:** The 5e 2014 rule that "enhancement bonuses don't stack" is
modeled through `scope` on the modifier grant (`MODIFIER_SCOPE_KIND`), not the modifier kind
itself. The engine MVP treats all BONUS as additive. Scope-based capping is a Phase 7 refinement.

---

## 4. Derived Stat Calculation Precedence

Stats are calculated in this exact order. Each step may depend on the result of earlier steps.

1. **Base ability scores** — resolved from `snapshot.intent.abilities` assignments
   - STANDARD_ARRAY: `option` is a string score (e.g. `'15'`) assigned to an ability
   - POINT_BUY: `option` is a string score assigned to an ability
   - MANUAL_ROLLED: `assignments` array of `{ ability, score }` pairs

2. **Ability score modifiers applied** — `ABILITY_SCORE` domain modifier grants are summed
   per ability and added to base scores

3. **Ability modifiers computed** — `floor((finalScore - 10) / 2)` for each ability

4. **Total character level computed** — sum of all `snapshot.intent.classes[].classLevel`

5. **Proficiency bonus computed** — `floor((totalLevel - 1) / 4) + 2`

6. **Saving throws** — for each ability:
   `abilityModifier + (proficiencyBonus × scaling)` where scaling:
   - FULL = 1× PB (full proficiency)
   - HALF = 0.5× PB rounded down (half proficiency, e.g. Bard Jack of All Trades)
   - DOUBLE = 2× PB (expertise, not on saves in 5e 2014 base rules)
   - Not proficient = 0

7. **Skill bonuses** — for each skill:
   `abilityModifier(governingAbility) + (proficiencyBonus × scaling)`
   Same scaling as saving throws.

8. **Hit points** — sum of `snapshot.intent.hitpoints.levels[].value` which already stores
   per-level HP values (computed during character creation UX, includes CON modifier)
   Note: this is the already-computed HP total from the character's level entries.

9. **Armor class** — `10 + DEX modifier` (base unarmored; equipped armor calculation is Phase 7)
   Apply `ARMOR_CLASS` domain modifiers on top.

10. **Initiative** — `DEX modifier` + sum of `INITIATIVE_BONUS` domain modifiers

11. **Spell save DC** — present only if the character has a spellcasting class in the registry:
    `8 + proficiencyBonus + spellcastingAbilityModifier`

12. **Spell attack bonus** — present only if the character has a spellcasting class:
    `proficiencyBonus + spellcastingAbilityModifier`

---

## 5. Effect Resolution

Effect resolution (damage dice, healing, condition application, moment triggers) is
**deferred to Phase 7**. The engine does not process effects in Phase 6.

---

## 6. Out of Scope for This Implementation (Phase 7+)

- Armor class from equipped armor / shield
- Damage/attack roll simulation
- Condition tracking and stacking
- Spell slot depletion and multi-class fusion
- Feat prerequisite validation at engine time
- Per-scope ENHANCEMENT bonus capping
