# D&D 5e 2014 SRD — Rule Ordering

This document is the correctness contract for the repository-owned D&D 5e 2014 rule models in this directory. Ordering and stacking decisions in those models must trace to a rule here. It is not a second evaluator or an application-layer fallback.

---

## 1. Feature Acquisition Order

Acquired feature records are processed in the following source order. Within a source,
features are processed in ascending level order (level 1 first), then by their authored
`order` field.

1. `RACE` — racial traits (e.g. Darkvision, Dwarven Resilience)
2. `SUBRACE` — subrace traits (e.g. High Elf Cantrip, Hill Dwarf HP bonus)
3. `ANCESTRY` — selected ancestry-option features
4. `BACKGROUND` — background feature (e.g. Sage: Researcher)
5. `CLASS` — class features by class level ascending (e.g. Fighting Style at L1, Extra Attack at L5)
6. `SUBCLASS` — subclass features by class level ascending (e.g. Evocation Savant at L2)
7. `FEAT` — feat features in selection order (e.g. Alert, Lucky)
8. `FEATURE` — independently acquired feature records
9. `OPTION` — independently acquired feature-option records
10. `EQUIPMENT` — features granted by equipped items (e.g. magic item attunement features)
11. `MANUAL` — explicit manual grants

**Why this order matters:** Class grants (e.g. proficiencies) must not overwrite racial grants of
the same kind when stacking; processing order determines first-write semantics for exclusive modifiers.

Each snapshot class row represents one base-class progression and may name its selected subclass.
The primary class applies its normal proficiency grants. Later base classes apply only their authored
multiclass proficiencies, while their level-appropriate class and subclass features still apply normally.
The selected subclass is processed immediately after its owning base class and is never added as a
second pseudo-class level row. For multiclass characters, root progression order is therefore base class,
owning subclass, next base class, owning subclass. `CLASS` and `SUBCLASS` must remain adjacent in the
configured source list. The `SUBCLASS` rank still governs acquired feature records whose provenance is
`SUBCLASS`.

---

## 2. Grant Application Order

Within a single feature, grants are applied in this order:

1. `PROFICIENCY_GRANT` — establishes proficiencies (saves, skills, equipment, languages) first
   so they are available when other grant types check proficiency state
2. `SENSE_GRANT` — senses (Darkvision, Tremorsense, Blindsight, Truesight)
3. `MODIFIER_GRANT` — numeric or categorical stat modifiers (bonuses, penalties, set-values)
4. `FEAT_GRANT` — unlocks additional feat features (secondary feature expansion)
5. `SPELL_GRANT` — grants spell access (expanded spell lists, always-prepared spells)

---

## 3. Modifier Stacking Rules

Stacking is determined by `modifierKind`. The engine applies rules per kind regardless of
which value domain the modifier targets.

| Modifier Kind                     | Stacking Rule | Notes                                          |
| --------------------------------- | ------------- | ---------------------------------------------- |
| `BONUS`                           | additive      | Untyped bonuses always stack in 5e 2014        |
| `PENALTY`                         | additive      | Penalties stack (e.g. exhaustion stacks)       |
| `SET_VALUE`                       | last          | Explicit overrides; last processed wins        |
| `ADD_BONUS_DIE`                   | additive      | Multiple bonus dice stack                      |
| `REPLACE_DAMAGE_TYPE`             | last          | Last replacement wins                          |
| `ADVANTAGE`                       | boolean       | Advantage is binary — any source grants it     |
| `DISADVANTAGE`                    | boolean       | Disadvantage is binary — any source grants it  |
| `ADD_OPTION`                      | additive      | Set membership — each entry is distinct        |
| `REMOVE_OPTION`                   | additive      | Set removal — each entry is distinct           |
| `REPLACE_RANGE_KIND`              | last          | Last replacement wins                          |
| `REPLACE_DURATION_KIND`           | last          | Last replacement wins                          |
| `REPLACE_SHAPE_KIND`              | last          | Last replacement wins                          |
| `REPLACE_CHARGE_RESET_KIND`       | last          | Last replacement wins                          |
| `MODIFY_CHARGE_LIMIT`             | additive      | Charge limit deltas stack                      |
| `OPTIONAL_ABILITY_MODIFIER_BONUS` | additive      | Adds to the pool of eligible ability modifiers |

**Note on ENHANCEMENT bonuses:** The 5e 2014 rule that "enhancement bonuses don't stack" is
modeled through `scope` on the modifier grant (`MODIFIER_SCOPE_KIND`), not the modifier kind
itself. The current policy treats all BONUS as additive. Scope-based capping requires its own explicit typed rule contract and fixtures.

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

4. **Total character level computed** — sum of all base-class snapshot levels

5. **Proficiency bonus computed** — `floor((totalLevel - 1) / 4) + 2`

6. **Saving throws** — apply any saving-throw proficiency override, then for each ability:
   `abilityModifier + (proficiencyBonus × scaling)` where scaling:
   - FULL = 1× PB (full proficiency)
   - HALF = 0.5× PB rounded down (half proficiency, e.g. Bard Jack of All Trades)
   - DOUBLE = 2× PB (expertise, not on saves in 5e 2014 base rules)
   - Not proficient = 0

7. **Skill bonuses** — apply any governing-ability and proficiency overrides, then for each skill:
   `abilityModifier(governingAbility) + (proficiencyBonus × scaling)`
   Same scaling as saving throws.

8. **Passive checks** — `10 + effectiveSkillBonus`, followed by a target-specific passive override.

9. **Movement** — resolve authored speeds and speed modifiers, then apply typed speed overrides.
   `AUTO` displays walking when available and otherwise the first backend-ordered available speed.
   An explicit preference is used only while that speed remains available.

10. **Hit points** — sum the ordered per-level HP values, apply the difference between the authored
    and adjusted Constitution modifier once per level, then apply maximum-HP modifiers. Each ordered
    row already stores character level, class identity, class level, and its authored HP value.

11. **Armor class** — resolve eligible equipped armor/shields and their modifiers, otherwise use
    `10 + DEX modifier`; then apply remaining `ARMOR_CLASS` domain modifiers.

12. **Initiative** — `DEX modifier` + sum of `INITIATIVE` domain modifiers

13. **Spell save DC** — present only if the character has a spellcasting class in the registry:
    `8 + proficiencyBonus + spellcastingAbilityModifier`

14. **Spell attack bonus** — present only if the character has a spellcasting class:
    `proficiencyBonus + spellcastingAbilityModifier`

Per-source spell mechanics replace that class-wide default with a spell grant's authored casting
ability when present. This applies to race and subrace grants even when the character has no
spellcasting class.

---

## 5. Sheet Adjustment Precedence

For every supported target, resolution follows this order:

1. Start with the Builder-authored base value.
2. Apply authored, feature, equipment, and other engine contributions using their normal stacking rule.
3. Apply typed manual additive adjustments.
4. Apply the target's absolute override last.

An absolute override suppresses, but does not delete, earlier contributions in the calculation breakdown.
Removing it recalculates from current inputs. Adjusted upstream values feed downstream calculations unless
the downstream target has its own absolute override. Labels, notes, actors, permissions, and presentation
semantics never enter engine input.

Spell adjustments are keyed by spell-source identity. Item and companion adjustments are keyed by their
owned-instance UUID. Derived totals and calculation breakdowns are output only and are never persisted.

---

## 6. Effect Resolution

Character evaluation projects typed action availability and static mechanics. Encounter action resolution accepts an explicit action, validated targets, current state, and application-owned dice evidence, then returns a typed proposed outcome. TypeScript validates and applies that outcome transactionally; it does not recalculate the mechanic. `CLOSED_RULE`, `MANUAL_ADJUDICATION`, and effect kinds without a registered resolver remain fail-closed/manual.

---

## 7. Out of Scope for This Implementation

- Automatic target selection, reactions, and general action-economy enforcement
- Encounter turn and renderer sequencing
- Blanket execution of closed or manually adjudicated effects
- Mechanical condition consequences and stacking
- Per-scope ENHANCEMENT bonus capping
