# Phase 4 Normalization Audit

## Summary

This audit reviews all persisted authored-data schema before serious SRD seed population, broader repository expansion, or long-term Kysely query work proceeds.

This is not a "fully normalize everything no matter what" exercise. The normalization standard for this repo is:

- normalize until ownership, cardinality, and meaning are clear
- allow finite polymorphic tables when they remain explicit and understandable
- avoid generic catch-all columns
- prefer columns that map to real authored/domain concepts
- allow multiple concrete nullable columns in one table when they represent a real discriminated or correlated payload clearly

This audit covers all persisted authored data, including character persistence. It does not cover pure engine-derived runtime values unless they are currently being persisted.

## Decision Rules

Each table group must receive one of these verdicts:

- `Keep`
- `Keep with adjustments`
- `Refactor before seed`
- `Defer safely`

Use these rules consistently:

- owned authored children should look owned in persistence
- many-to-many bridges should only exist when the relationship is truly relational, not when the child is authored content owned by the parent
- subtype/discriminated data may share a table if the discriminator is explicit and the columns remain concrete
- nullable columns are acceptable for finite variants; they are not acceptable when they hide a missing subtype split
- no generic `entity_type/entity_id` style persistence unless there is a very strong reason and the table still preserves meaning
- denormalization is allowed only if it is intentional, documented, and does not create conflicting sources of truth
- the schema should hydrate back into authored/domain shapes without compiler-like reconstruction hacks

## Character Rule

Character persistence must be reviewed using this split:

- `Intent`
  - authoritative record of creation, progression, and player choice history
  - examples: race/background/class choices, ancestry selections, ability generation choices, feature acquisitions, spell selections, resource grants, starting equipment decisions

- `State`
  - authoritative record of mutable current play state
  - examples: inventory, equipped or attuned items, currency amounts, current HP or temp HP, hit dice usage, prepared or known spell state where it is player-managed, resource usage

- `Derived`
  - should not be persisted by default
  - examples: resolved modifiers, final AC, derived movement, resolved spell DC, computed granted features, other recomputable engine output

Character tables must therefore be classified as:

- persisting intent correctly
- persisting mutable state correctly
- incorrectly persisting derived data
- mixing intent and state in one place

## Audit Order

### 1. Shared authored infrastructure

- `shared/tables/facets.sql`
- `shared/tables/charges.sql`
- `shared/tables/starting_equipment.sql`
- `shared/tables/characteristics.sql`
- `shared/tables/saving_throws.sql`
- `shared/tables/details.sql`

### 2. Correlated and polymorphic grant structures

- `grants/tables/modifiers.sql`
- `grants/tables/feats.sql`
- `grants/tables/spells.sql`
- `grants/tables/senses.sql`
- `grants/tables/proficiencies.sql`

### 3. Features and options

- `features/tables/features.sql`
- `features/tables/options.sql`

### 4. Subject roots and owned authored trees

- `subjects/tables/backgrounds.sql`
- `subjects/tables/classes.sql`
- `subjects/tables/equipment.sql`
- `subjects/tables/feats.sql`
- `subjects/tables/races.sql`
- `subjects/tables/spells.sql`
- `subjects/tables/systems.sql`

### 5. Effects

- `effects/tables/effects.sql`
- `effects/tables/damages.sql`
- `effects/tables/conditions.sql`
- `effects/tables/moments/*`

### 6. Character persistence

- `subjects/upserts/character.sql`
- every table defined there must be classified as `intent`, `state`, `derived`, or `mixed`

## Known Hotspots

The audit must give explicit written verdicts on:

- `modifier_grant_payloads`
  - acceptable correlated payload table or too many impossible states
- `modifier_grant_domain_params`
  - good finite parameter table or needs clearer subtype split
- facet selection and predicate payload tables
  - valid one-of polymorphism or too diffuse
- class-owned subtrees
  - right level of normalization vs over-fragmentation
- equipment structure
  - right ownership split vs over or under normalization
- character tables
  - whether any current tables persist derived engine values that should not be stored

## Deliverables

1. Review every authored-data table group under `packages/db/src/domains/*/tables`
2. Record a verdict for every group in this file
3. For any `Refactor before seed` item, document:
   - current issue
   - target table shape
   - why the target is semantically clearer
   - whether the change must happen before SRD seed work
4. Update `PHASE_4_DB_SUBPLAN.md` and `REBUILD_PLAN.md` when audit verdicts materially change Phase 4 sequencing

## Acceptance Criteria

This audit is complete only when:

- all persisted authored-data tables are reviewed, not just bootstrap or FK structure
- character persistence is explicitly evaluated using the `intent vs state vs derived` rule
- every polymorphic or correlated table has a written verdict
- every mixed or null-heavy table is either justified or marked for refactor
- the audit leaves no schema-shape decisions to the implementer before serious seed work

## Current Status

- Audit complete for all persisted authored-data table groups
- Serious SRD seed population remains gated on resolution of all `Refactor before seed` items
- SQL refactor pass is now in progress
- Kysely-first write migration is now part of the Phase 4 execution path; `.sql` files are being reduced to schema/bootstrap only
- First refactor tranche landed for:
  - `grants/tables/modifiers.sql`
  - `grants/tables/proficiencies.sql`
- Character persistence has started that migration:
  - legacy SQL `upsert_character*` functions were removed from `subjects/upserts/character.sql`
  - the table layer is being reshaped toward `intent` and mutable `state`
- Next execution step is to continue the SQL refactor pass with features/options and then subject roots, followed by bootstrap regeneration and empty-db verification

## Handoff Note

This audit is a Phase 4 gate, not optional cleanup. Do not begin broad SRD content population just because the bootstrap path and wrapper layer exist. The schema must first be confirmed semantically correct for authored persistence.

## Verdicts

### 1. Shared authored infrastructure

#### `shared/tables/details.sql`

- Verdict: `Keep`
- Rationale: simple standalone authored object with clear ownership and no hidden subtype behavior.

#### `shared/tables/saving_throws.sql`

- Verdict: `Keep with adjustments`
- Rationale: shape is close to `SavingThrowAuthored`, but DB checks should enforce the `FIXED_VALUE` vs `SPELL_SAVE_DC` discriminator more tightly.

#### `shared/tables/characteristics.sql`

- Verdict: `Keep with adjustments`
- Rationale: split across range/duration/shape is semantically clear, but check constraints should align more exactly with the authored unions for `RangeAuthored`, `DurationAuthored`, and `ShapeAuthored`.

#### `shared/tables/facets.sql`

- Verdict: `Keep with adjustments`
- Rationale: the explicit one-of payload tables are acceptable and clearer than generic JSONB, but this area still needs stricter correlation checks and careful review of a few null-heavy payload surfaces as the subject/effect audit progresses.

#### `shared/tables/charges.sql`

- Verdict: `Refactor before seed`
- Current issue: persistence still reflects older source-level assumptions (`class_id`, `spell_id`, `multiplier` on root limit rows) rather than the current `ChargeAuthored` model, which is based on `limitKind`, `scalingKind`, fixed/per-level amounts, and bonus rows.
- Target shape: reshape `charge_limits` and related tables around the current authored discriminated union so DB rows hydrate back to `ChargeAuthored` without source-specific hacks.
- Why clearer: charge semantics become authored-first again instead of mixing old source-driven persistence with new scaling contracts.
- Must happen before seed: yes.

#### `shared/tables/starting_equipment.sql`

- Verdict: `Refactor before seed`
- Current issue: decomposition is close, but ownership semantics and payload columns still behave too much like a reusable helper entity rather than an owned subtree under classes/backgrounds, and several item-level unions are only partially enforced.
- Target shape: keep the decomposed set/group/option/item structure, but tighten the ownership model so every subtree has a clear parent chain and adjust item payload checks to match `StartingEquipmentAuthored`.
- Why clearer: this preserves authored ownership and avoids seeding data into a helper model that looks more reusable than it really is.
- Must happen before seed: yes.

### 2. Correlated and polymorphic grant structures

#### `grants/tables/modifiers.sql`

- Verdict: `Refactor before seed`
- Current issue: `modifier_grant_domain_params` and `modifier_grant_payloads` contain too many stale or over-broad nullable columns (`class_id`, `spell_id`, movement/attribute text placeholders, mixed value/payload slots) and allow too many impossible states relative to `ModifierGrantAuthored`.
- Target shape: split domain-parameter concerns from modifier-payload concerns more cleanly, remove stale source-specific columns that are not part of the current authored contract, and keep only finite, explicit correlated payload tables/columns that hydrate directly back into `ModifierGrantAuthored`.
- Why clearer: modifier grants are the highest-risk polymorphic area and need explicit, authored-aligned persistence rather than a catch-all sparse table.
- Must happen before seed: yes.

#### `grants/tables/feats.sql`

- Verdict: `Keep with adjustments`
- Rationale: root/scaling-level decomposition aligns well with `FeatGrantAuthored`, but it still needs tighter discriminator checks around `selection_kind`, `authoring_mode_kind`, `selection_count`, and `scaling_source`.

#### `grants/tables/spells.sql`

- Verdict: `Keep with adjustments`
- Rationale: overall shape tracks `SpellGrantAuthored` well enough, including filters and per-level payloads, but it needs stricter authored-invariant checks and a review of whether `charge_id` should stay required when charges are optional in the authored contract.

#### `grants/tables/senses.sql`

- Verdict: `Keep with adjustments`
- Rationale: structure is close to `SenseGrantAuthored`, but it shares the same discriminator/check issues as the other scaling grants and should verify whether its owned `charge_id` is truly optional in storage.

#### `grants/tables/proficiencies.sql`

- Verdict: `Refactor before seed`
- Current issue: current payload tables do not fully represent `ProficiencyGrantAuthored`, especially the equipment/equipment-property variants with category/property correlation and selectable payload behavior; there is also at least one schema typo (`skillId` in a primary key) and several missing authored invariants.
- Target shape: keep per-surface payload tables, but explicitly model equipment-category/property filters and selection payload semantics so rows hydrate back into `ProficiencyGrantAuthored` without inferred behavior.
- Why clearer: proficiency grants are finite and should stay finite, but they need authored-complete payload coverage before seeding.
- Must happen before seed: yes.

### 3. Features and options

#### `features/tables/features.sql`

- Verdict: `Refactor before seed`
- Current issue: root table is missing authored fields such as `attributes`, and it currently collapses the feature shape into a partial subset that does not fully round-trip `FeatureAuthored`.
- Target shape: preserve owned bridges for effects/grants/options, but add the missing authored-root persistence surfaces and tighten option-level tables to reflect `optionsPerLevel` exactly.
- Why clearer: features are central authored containers and should persist the full authored root, not a partial approximation.
- Must happen before seed: yes.

#### `features/tables/options.sql`

- Verdict: `Refactor before seed`
- Current issue: `OptionAuthored` is feature-base-shaped, but the current table only stores a subset of that root and inherits the same missing-root-field problem as features.
- Target shape: keep owned bridges/effects/grants, but persist the full feature-base authored surface for options, including any missing attributes-level root data.
- Why clearer: options should normalize exactly like owned feature-base children, not like a trimmed parallel schema.
- Must happen before seed: yes.

### 4. Subject roots and owned authored trees

#### `subjects/tables/backgrounds.sql`

- Verdict: `Keep with adjustments`
- Rationale: root ownership is broadly correct for details, proficiencies, features, and starting equipment, but this table still depends on the `starting_equipment` refactor and should tighten a few authored invariants/cleanup assumptions around optional owned children.

#### `subjects/tables/classes.sql`

- Verdict: `Refactor before seed`
- Current issue: class persistence is close structurally, but it does not yet fully persist the current authored surface, especially class/subclass attributes and parts of the spellcasting prepare-limit model such as per-level values.
- Target shape: keep the owned-subtree approach for spellcasting, multiclass, starting equipment, and related helpers, but add the missing authored-root/subtree fields and tighten category-specific invariants for base classes vs subclasses.
- Why clearer: classes are one of the richest authored roots, so partial persistence here would force hydration hacks immediately.
- Must happen before seed: yes.

#### `subjects/tables/equipment.sql`

- Verdict: `Refactor before seed`
- Current issue: the ownership breakdown is promising, but the root table does not yet round-trip the full authored equipment model cleanly, including root attributes, variant-specific invariants, and some helper-payload constraints like optional capacity.
- Target shape: preserve the decomposed ownership pattern for effects/modifiers/features/contains, but add the missing authored-root data and enforce base-vs-variant rules explicitly.
- Why clearer: equipment is a large authored surface and should persist as a semantically exact root, not a partially inferred one.
- Must happen before seed: yes.

#### `subjects/tables/feats.sql`

- Verdict: `Refactor before seed`
- Current issue: this table is carrying stale root fields such as restrictions/traits that do not match the current `FeatAuthored` surface, while also omitting a cleaner authored-root contract.
- Target shape: align feat persistence exactly to `FeatAuthored`, keeping owned bridges for effects/grants/features but removing or replacing stale root assumptions that are no longer authored.
- Why clearer: feats should hydrate directly from persistence without inheriting leftover feature-like fields that no longer belong.
- Must happen before seed: yes.

#### `subjects/tables/races.sql`

- Verdict: `Keep with adjustments`
- Rationale: the base/subrace split, ancestry subtree, details, features, and speeds align reasonably well with `RaceAuthored`, but it still needs stronger category-specific checks and a review of whether extra root trait storage is still intentional.

#### `subjects/tables/spells.sql`

- Verdict: `Refactor before seed`
- Current issue: spell persistence is missing parts of the current authored root such as spell attributes while still carrying stale root assumptions like `concentration_type` that are not represented directly in `SpellAuthored`.
- Target shape: keep the spell root plus owned effects/classes structure, but align the root columns to the current authored spell contract and move any non-authored semantics behind explicit helper surfaces only if they are still needed.
- Why clearer: spells are canonical seed content and should not require special-case hydration logic to reconcile stale root columns.
- Must happen before seed: yes.

### 5. Effects

#### `effects/tables/effects.sql`

- Verdict: `Keep with adjustments`
- Rationale: the effect root is intentionally thin and works as an owned container, but it depends on the invocation/moment tables for authored completeness and should be reviewed together with those tables as a single subtree.

#### `effects/tables/invocations.sql`

- Verdict: `Keep with adjustments`
- Rationale: it captures the key authored invocation pieces (`triggerCode`, activation, range, optional shape, optional saving throw), but the field/check names still reflect older terminology and should be tightened to the current authored union semantics.

#### `effects/tables/damages.sql`

- Verdict: `Keep with adjustments`
- Rationale: the fixed/dice/pool split and scaling tables are broadly compatible with `DamageAuthored`, but this table still carries older source-specific columns (`class_id`, `spell_id`) and should tighten its scaling-source invariants before seed.

#### `effects/tables/conditions.sql`

- Verdict: `Keep`
- Rationale: simple, semantically clear authored payload table with no ambiguous ownership.

#### `effects/tables/moments/*`

- Verdict: `Keep with adjustments`
- Rationale: direct vs roll-table specialization is explicit and clearer than a generic payload blob, but the composite-key container model and duration cleanup semantics should be reviewed as one subtree to ensure they round-trip `MomentAuthored` cleanly.

### 6. Character persistence

#### `subjects/upserts/character.sql`

- Verdict: `Refactor before seed`
- Current issue: the current character schema mixes intent, mutable current state, and clearly derived/runtime projection tables in one persistence layer. It also references older content-model names (`subfeature_*`, `character_feature_options`, `character_spells`, etc.) that do not match the current `CharacterIntent` and `CharacterState` contracts.
- Target shape: split the character persistence model into:
  - `intent` tables for creation/progression/player-choice history
  - `state` tables for mutable current play state
  - no default persistence for derived engine output
  and then remove or redesign stale projection tables that persist recomputable feature/modifier/spell structures.
- Why clearer: character persistence should answer `what was chosen` and `what is currently mutable`, while the engine answers `what does that mean`.
- Must happen before seed: yes.

Character-specific classification guidance from the current SQL:

- likely `intent`-aligned:
  - `characters`
  - `character_race`
  - `character_classes`
  - ability-generation choice tables
  - starting-equipment choice/session tables

- likely `state`-aligned:
  - `character_equipment`
  - `character_equipped`
  - `character_attuned`
  - `character_currency_groups`
  - `character_currencies`
  - `character_spell_slots`
  - `character_resources`
  - parts of hitpoint usage state

- likely `derived` or `mixed` and should not survive unchanged:
  - `character_features`
  - `character_subfeature_*`
  - `character_abilities_scores`
  - any table persisting resolved/recomputed feature or modifier surfaces rather than player-authored choices or mutable usage state

## Refactor Order

Resolve `Refactor before seed` items in this order:

1. Shared helpers
  - `shared/tables/charges.sql`
  - `shared/tables/starting_equipment.sql`

2. Grant and feature surfaces
  - `grants/tables/modifiers.sql`
  - `grants/tables/proficiencies.sql`
  - `features/tables/features.sql`
  - `features/tables/options.sql`

3. Subject roots
  - `subjects/tables/classes.sql`
  - `subjects/tables/equipment.sql`
  - `subjects/tables/feats.sql`
  - `subjects/tables/spells.sql`

4. Character persistence
  - `subjects/upserts/character.sql`
