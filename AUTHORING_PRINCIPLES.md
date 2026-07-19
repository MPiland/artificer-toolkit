# Authoring Principles

> **Document status:** Historical/working principles. Vocabulary and data-layer boundaries are canonical in [ADR 0003](docs/adr/0003-vocabulary-authored-compiled-engine-data.md); node-map ownership is canonical in [ADR 0004](docs/adr/0004-backend-resolved-node-maps.md). Use [CONTEXT.md](CONTEXT.md) for current terminology.

## Authored Object ID Uniqueness

Every authored object — feature, grant, facet, option — has a **unique ID that belongs to exactly one parent**.

Authored objects are never shared. If two parents (races, classes, backgrounds) have semantically identical content, each gets its own row with its own ID. This ensures:

- A homebrewer can fork one parent's feature (e.g., extend Tiefling's Darkvision to 120 ft) without affecting any other parent.
- Each authored object can be independently versioned, overridden, or deleted.
- DB normalization is clean: every row has exactly one owner.

### ID helpers

Use a deterministic ID helper scoped to the parent type:

| Context | Helper | Example |
|---|---|---|
| Race features | `raceFeatureId(raceIndex, group, entry)` | `raceFeatureId(9, 1, 1)` = Tiefling Darkvision feature |
| Class features | `classRowId(classIndex, group, entry)` | `classRowId(W, 1, 1)` = Warlock Otherworldly Patron |
| Background features | `bgId(bgIndex, group, entry)` | `bgId(12, 1, 1)` = Sage Researcher feature |

## Vocabulary vs. Authored Objects

**Vocabulary objects** (senses, skills, languages, damage types, magic schools, etc.) are **system-owned** and referenced by ID. They are not authored — they are the shared dictionary that authored content refers to.

- `SRD_DARKVISION_SENSE_ID` — a vocabulary reference, used in sense grants across races and creatures
- A Tiefling Darkvision sense grant — an authored object, unique to Tiefling

When authoring a sense grant, reference the sense by its vocabulary ID (`senseIds: [SRD_DARKVISION_SENSE_ID]`). The grant itself (and its range, charges, etc.) is authored and gets a unique ID via the parent's ID helper.

## Physical File Organization

File organization is flexible. Features may be defined inline in their parent file or in a dedicated file — what matters is that IDs are unique per parent. All content is normalized into DB tables at seed time regardless of source file organization.

- ✅ Tiefling features defined as `const tieflingDarkvision` in `races.ts`, referenced directly from the Tiefling race object
- ✅ Warlock features defined inline via `classRowId()` in `classes.ts`
- ❌ A shared `srdFeatures` pool where multiple parents filter by shared IDs

## UI-Authorable Authored Contracts

Authored types are user-authoring contracts first. They must make sense to a human creating or editing content in the UI.

This means:

- authored discriminators must reflect user-understandable choices
- persistence structure stays below the authored surface
- authored payloads should read like forms a content author can fill out, not normalized database rows
- if the SRD only provides partial information for a record, the authored contract must allow that partial record instead of forcing invented fields

Examples:

- ✅ a creature author chooses between a `STAT_BLOCK` and `LOGISTICS` record kind
- ✅ a character-owned mount is represented as an owned creature instance with a role, custom name, notes, and equipment assignments
- ✅ a vehicle row from the SRD can omit unsupported combat/object fields if the SRD only gives cost and speed
- ❌ exposing join-table semantics or persistence-only flags in authored content
- ❌ forcing non-SRD filler values just to satisfy a storage shape

Vocabulary is still system-owned and referenced by ID, but authored records should remain natural to read and edit.

## Creature Proficiency Rule

Creature authoring should not maintain a second proficiency shape.

Use the same proficiency-grant model used by classes, backgrounds, features, and other subjects:

- plain creature skill knowledge -> proficiency grant
- plain creature save proficiency -> proficiency grant
- plain fixed creature language knowledge -> proficiency grant

Qualified communication semantics stay in features instead of inventing creature-only root fields.

Examples:

- `Telepathy 120 ft.` -> feature text
- `understands Common but can't speak` -> feature text, plus language proficiency grant when real language knowledge is implied
- `any two languages` -> feature text, not fake seeded vocabulary
- `the languages it knew in life` -> feature text, not fake seeded vocabulary

This keeps the authored surface unified while preserving the SRD's communication caveats honestly.

## Complete Before Seed

Seeded baseline data must be complete in its authored contract.

This means:

- a record is not complete just because it has an id and descriptive prose
- if the SRD exposes structured mechanics that belong in the authored contract, those mechanics should be populated structurally
- if the current authored contract is too weak to represent the SRD honestly, strengthen the contract first and only then continue seeding
- temporary audit placeholders are acceptable during implementation, but they should not be treated as finished baseline seed data

Examples:

- ✅ a spell whose mechanics live in capabilities, with range/shape on invocation and duration on branches/outcomes
- ✅ a class feature that grants spells via authored spell-grant structures instead of prose-only notes
- ❌ marking a spell "done" when its SRD mechanics are still trapped only in description text

## Capability / Outcome Separation

Activated or triggered mechanics should be modeled as reusable capabilities, not as duplicated subject-root summaries.

Use these rules:

- capability invocation owns delivery semantics like activation, trigger, range, and shape
- branches own explicit resolution paths
- outcomes own what actually happens
- duration belongs on branches/outcomes, not on subject roots
- for spells, `activation` and `castingTime` are separate layers:
  - `activation` is the action-economy cost to begin the cast
  - `castingTime` is the elapsed duration of the casting process

Additional rule:

- `saveResolution`-style shortcut fields are not the target model; save fail/success, hit/miss, and similar result paths should be authored as explicit branches
- passive or always-on changes still belong in grants

This means:

- spells, active features, active feats, and active equipment powers should author capabilities
- option-derived active mechanics should be owned by the selected option's feature instead of duplicated at the subject root
- direct class, subclass, race, feat, or equipment actions should be owned by the granting feature/item rather than introducing a second action framework
- use subclass `specialization` only for lasting subclass identity branches that later mechanics can key off; do not use it as a generic bucket for normal feature options
- `Circle of the Land` terrain is a subclass specialization, while Ranger-style favored-terrain selections remain ordinary feature choices
- when a subclass specialization changes later granted spells or benefits, prefer one feature with multiple specialization-restricted grants and progressive unlock levels over duplicating each specialization/tier as separate pseudo-features
- grants remain the right home for passive bonuses, senses, proficiencies, and persistent access
- temporary buffs/debuffs should be represented as applying typed grants through outcomes rather than inventing ad hoc subject-root fields
- magic gear stays inside equipment: use `EQUIPMENT_PROPERTY_CODE.MAGIC` for enchanted items, and use `EquipmentVariantAuthored` with `parentEquipmentId` for upgrades like `+1` gear instead of inventing a separate magic-item subject or treating the variant as a base record
- do not invent equipment prices when the source does not provide one; authored `cost` may be omitted for SRD magic gear that lacks a listed purchase price
- when a magic variant grants a numeric bonus (`+1/+2/+3`), author the mechanical bonus as passive modifier grants; do not rely on `maxBonus` metadata alone as the complete mechanic
- passive equipment such as holy symbols, druidic foci, and most tools should stay metadata-only unless they truly grant a persistent mechanic; do not add fake `RULE` capabilities just to acknowledge that a player may attempt an action with the item
- bundle and container records should use `contains` when the SRD defines a concrete included-item bundle
- composite inventory records should remain decomposable where useful: for example, a quiver bundle with arrows should be representable as the quiver item, the arrow item, and the bundled record that contains them
- shields remain `EQUIPMENT_CATEGORY_CODE.SHIELD`, not armor, so shield-specific proficiency and material/property rules can stay distinct

Constrained fallback:

- `RULE` outcomes are allowed only when a mechanic still cannot be represented by a better typed outcome family
- each retained `RULE` should be treated as one of:
  - valid constrained `RULE`
  - convertible with the current model
  - blocked by a named model/runtime gap
- source-data should prefer shared targeting constants over raw targeting string literals
- they are not the default path for SRD implementation
- authored spell-grant restrictions are part of the canonical contract and must survive compilation/resolution; do not route specialization- or facet-bound spell packages only through prose or feature duplication

## Phase 7.7 Master-Data Anchor

Phase 7.7 is not just a seed-file completion phase.

Its product purpose is to establish the baseline SRD master data that every new user can rely on immediately after signup.

That means:

- SRD content should be modeled as shared baseline content, not disposable test fixtures
- authored contracts need to support both honest SRD representation and future UI authoring
- grants, capabilities, outcomes, manifests, range, shape, and duration decisions are all part of the same master-data modeling problem
- a content family should not be considered "done" just because the files exist if the mechanics still cannot support the baseline user experience structurally

## Deferred Post-7.7 Cleanup

Two correctness cleanups are intentionally deferred until after the current 7.7 master-data convergence:

- capability/effect naming cleanup
  - `CapabilityAuthored` is currently the intended public concept, but it still aliases the older `effects/*` artifact family internally
  - after 7.7 convergence, do one repo-wide naming cleanup so public naming and internal naming match
- engine ruleset-boundary cleanup
  - `engine/dnd5e2014` currently contains real ruleset-specific logic and should stay for now
  - after 7.7 convergence, revisit that area so generic engine code depends on contracts/rules-system interfaces while the ruleset-specific implementation has a clearer long-term boundary
