# Phase 7.7 - SRD CC 5.1 Content Completion Plus Creature, Vehicle, Character, and Facet Integration

## Status: In progress

## Context

Phase 7.6 is complete. Phase 7.7 is the first phase that must treat the local SRD PDF as both the legal boundary and the implementation boundary.

This phase is not just "write a lot of seed files." It also has to land the supporting model and persistence work needed so SRD mounts, animals, monsters, companions, vehicles, and character-owned rosters can be represented honestly without inventing impossible relations.

Phase 7.7 also exists for a direct product reason: SRD content is baseline master data. A brand-new user should be able to sign up and immediately build a usable SRD character from preloaded content without first authoring their own baseline classes, races, feats, spells, equipment, creatures, or vehicles.

That means 7.7 is doing two jobs at once:

1. producing the legal SRD CC 5.1 master-data baseline
2. proving that the grants/capabilities/outcomes/manifests model is strong enough to represent that baseline honestly

The dedicated mechanics audit for that question now lives in:

- [`PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md`](c:/Users/pilan/Desktop/artificer-toolkit/PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md)

That audit is no longer just a framework note. It now includes first-pass repo-backed findings for:

- spell source-tree mechanics drift
- grant-heavy race/background content
- prose-heavy class/feat content
- metadata-heavy equipment content
- current creature stat-block vs shared-capability boundary questions
- first-pass spell, class/feature, and equipment audit buckets
- a prioritized audit sequence for the next record-by-record classification passes
- a concrete anchor-record set covering spells, class features, race/background/feat cases, and equipment/creature boundary examples
- explicit current-model support verdicts for those anchor records (`strongly supported`, `partially supported`, `awkward`, `not yet`)
- an explicit missing-model requirements section derived from the current shared authored types
- the first post-audit mechanics slice has now landed richer invocation targeting support in shared/schema for self, single-target, chosen-creatures, and area-contents cases
- the next post-audit mechanics slice has now landed structured save-success damage semantics in shared/schema/compiler (`NONE` / `HALF`) so common SRD "half damage on a successful save" patterns no longer require fake spell-root summaries
- the next follow-through slice has now landed a generic activated-feature path in shared/schema:
  - `TRIGGER.ACTIVATED`
  - `BRANCH.ON_USE`
  - heal bonus support for mixed expressions like `1d10 + fighter level`
- the DB effect upsert layer now fails loudly for non-`DAMAGE`/non-`CONDITION` outcomes instead of incorrectly persisting broader outcome kinds as conditions while the persistence redesign is still pending

The only legal source for SRD master data in this phase is:

- [`packages/db/src/source-data/srd/SRD_CC_v5.1.pdf`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/source-data/srd/SRD_CC_v5.1.pdf)

## Scope Lock

Phase 7.7 includes both:

1. full SRD CC 5.1 source-data audit and completion
2. the model, persistence, compiler, resolver, query, assembler, upsert, and facet changes required to support that source data correctly

This phase explicitly does not split `monster`, `mount`, `animal`, or `companion` into separate top-level subjects.

## Architectural Decisions

### One Creature Subject

- `creature` remains the umbrella subject for monsters, NPCs, beasts, mounts, companions, and summons
- those roles are modeled through creature record kind, creature category, and optional profiles
- `vehicle` remains a separate subject
- `equipment` remains the source of tack, barding, saddles, harnesses, feed, packs, and vehicle gear

### Creature Branching

`CreatureAuthored` now supports two branches:

- `STAT_BLOCK`
- `LOGISTICS`

This allows SRD creatures to stay within one subject stack while supporting entries that do not need the full combat grammar.

### Character Ownership Model

Characters do not own copied creature or vehicle stat blocks directly.

Instead:

- `character_creatures` points at master `creature_id`
- `character_vehicles` points at master `vehicle_id`
- character-owned equipment assignment tables point at owned roster entries

Current relationship kinds on owned creature rows:

- `MOUNT`
- `COMPANION`
- `OWNED`
- `SUMMONED`

### Facet Model

Facet core now treats these as first-class node subjects:

- `CREATURE`
- `VEHICLE`

The following stay creature semantics, not standalone subjects:

- `monster`
- `mount`
- `animal`
- `companion`

## SRD Content Scope

The canonical target inventory must be derived from the local SRD PDF and `ids.ts`, not from generic 5e assumptions.

Current locked scope:

- Classes: 12 base classes
- Subclasses: only the detailed SRD subclasses permitted by the PDF-backed manifest
- Races and subraces: the narrow SRD set already represented in `ids.ts`
- Backgrounds: SRD-only
- Feats: SRD-only
- Spells: SRD-only spell inventory from `SPELL_IDS`, after reconciling count drift
- Equipment: SRD equipment, including magic gear modeled as equipment variants with the `MAGIC` property
- equipment prices should only be authored when the SRD actually supplies one; magic gear without a listed purchase price should omit `cost`
- magic `+1/+2/+3` variants must include passive modifier grants for their mechanical bonuses; metadata fields like `maxBonus` are helpful but not sufficient by themselves
- passive equipment such as holy symbols, druidic foci, and most tools should remain metadata-only unless they actually provide a persistent modifier/grant or a real active mechanic
- use `contains` for concrete SRD bundles and supplied containers
- keep composite inventory bundles decomposable into real component records where useful, such as quivers, arrows, and bundled arrow-filled quivers
- Creatures: SRD creature entries only, including mount/animal entries represented through the creature model
- Vehicles: SRD vehicle entries only

Hard exclusions:

- no standalone magic-item subject; magic gear remains equipment and uses `VARIANT` children with the `MAGIC` property when the SRD item is a magical upgrade of a base item
- no collapsing shields into armor; shields remain their own equipment category so shield proficiency and wood/metal property distinctions stay available
- no non-SRD classes, subclasses, races, backgrounds, feats, spells, creatures, vehicles, or equipment

## Implementation Workstreams

### 1. SRD Audit and Manifest Lock

- audit every file under `packages/db/src/source-data/srd`
- classify each file as:
  - valid and complete
  - valid but incomplete
  - structurally correct but containing non-SRD content
  - missing despite being in the canonical manifest
- reconcile `SPELL_IDS` and any inventory-count drift before content completion continues

### 2. Creature, Vehicle, and Character Model Integration

- keep a single `creatures` root subject
- support `recordKind: 'STAT_BLOCK' | 'LOGISTICS'`
- persist character-owned creature and vehicle rosters
- persist creature/vehicle equipment assignments owned by the character
- enforce impossible-relation checks in write paths

### 3. Compilers, Queries, Resolvers, Assemblers, and Upserts

- `compileCreature` handles both creature branches
- character state/compiler includes owned creatures, owned vehicles, and assignment state
- creature repository/upsert supports both creature branches
- vehicle repository/upsert supports ownership integration
- character repository/upsert supports roster and assignment tables
- runtime resolution can see owned creatures, owned vehicles, and assigned equipment

### 4. Facet Core and Filtering

Facet support must be accurate enough to prevent contradictory graph semantics.

Current target facet additions:

- node subjects:
  - `CREATURE`
  - `VEHICLE`
- relations:
  - `CHARACTER -> CREATURE`
  - `CHARACTER -> VEHICLE`
- creature predicates:
  - `CREATURE_RECORD_KIND`
  - `CREATURE_CATEGORY`
  - `CREATURE_TYPE`
  - `CREATURE_SIZE`
  - `CREATURE_IS_MOUNT`
  - `CREATURE_IS_COMPANION`
- vehicle predicates:
  - `VEHICLE_CATEGORY`
  - `VEHICLE_SIZE`

### 5. SRD Source-Data Completion

Content completion happens in multiple passes:

1. structurally complete files with stable ids
2. cross-reference completion
3. legal-scope and completeness audit

This is required because spells, classes, subclasses, features, and equipment reference each other across subject boundaries.

## Progress Snapshot

## Master-Data Purpose

The SRD source tree in this repo is not just test data.

It is the baseline master-data layer intended to be available to every user.

That means this phase should only be called complete when:

- the SRD baseline is legally correct
- the authored/runtime model can represent the SRD mechanics honestly
- a new user can immediately create and manage a usable SRD character from preloaded content

This is why 7.7 now includes a broader mechanics audit across grants, capabilities, outcomes, manifests, range/shape/duration placement, and cross-subject consistency rather than a spell-only pass.

## Current Mechanics Modeling Rule

Mechanic-bearing SRD content is now under an explicit model-first gate.

- subject roots should not own duplicated action summaries like spell-root `range`, `duration`, or `atHigherLevels`
- activated or triggered mechanics should live in reusable capabilities
- capability invocation owns `range` and `shape`
- branches/outcomes own `duration`
- passive or always-on mechanics stay in grants
- do not treat manifest coverage as equal to mechanical completeness

### Capability / Outcome Direction Landed

The first shared/schema slice of the redesign is now in repo:

- `CapabilityAuthored` now exists as the first-class action/capability concept layered over the previous effect structure
- outcome support has been expanded beyond `DAMAGE` and `CONDITION` to include:
  - `HEAL`
  - `APPLY_GRANT`
  - `TELEPORT`
  - `MANIFEST`
  - constrained `RULE`
- temp HP groundwork has started via a dedicated `TEMPORARY_HIT_POINTS` value domain
- shared subject compilers for spells, feats, equipment, and features now compile `capabilities` first and only fall back to legacy `effects`
- shared node maps now expose `capabilities` instead of root spell `range` / `duration` / `atHigherLevels`
- schema DTOs now accept capability-driven spell/feature/feat/equipment payloads and the new outcome families
- damage outcomes now also accept structured save-success semantics in shared/schema/compiler, though DB persistence for that additional metadata is still pending
- first anchor-file spell retrofits have started on:
  - `Burning Hands`
  - `Lightning Bolt`
  using invocation-owned targeting plus the new structured save-success damage semantics on the legacy `effects` compatibility surface
- that same save-for-half cleanup pattern is now also landed on:
  - `Fireball`
  - `Cone of Cold`
- and on:
  - `Shatter`
  - `Hellish Rebuke`
- the next distinct anchor gap after these spells is still race-feature capability modeling, with `Dragonborn -> Breath Weapon` remaining the clearest example
- that feature-side anchor tranche is now underway:
  - `Second Wind` is modeled as a fighter feature capability using `ACTIVATED -> ON_USE -> HEAL`
  - `Dragonborn Breath Weapon` is modeled as an ancestry-option-owned feature using explicit fail/success branches, ancestry-derived damage/shape/save semantics, and limited-use charges
- shared/schema now carry explicit target save ability on `SOURCE_SAVE_DC`, with optional `sourceAbility` for feature-owned source DCs; DB persistence still lags that richer shape and intentionally drops those extra fields until the later shared/DB convergence pass
- spell completion has resumed as the highest-priority content tranche now that the first feature-side anchors proved the model:
  - `Misty Step`, `Cure Wounds`, `Healing Word`, `Mass Healing Word`, `Mass Cure Wounds`, `Heal`, and `Mass Heal` now use first-class `capabilities`
  - `Shield` and `Shield of Faith` now use `APPLY_GRANT`
  - `Fog Cloud` now uses `MANIFEST`
  - `Thunderwave` and `Sacred Flame` now use direct capability-owned branches
  - spell timing is now explicitly split:
    - `activation` is action economy to begin using a capability
    - `castingTime` is elapsed casting duration on the spell root
    - long-cast spells still retain capability `activation`; they simply also carry a longer elapsed `castingTime`
  - `Find Familiar`, `Alarm`, `Prayer of Healing`, `Identify`, and `Teleportation Circle` are no longer treated as timing-model blockers under this split and can now be authored with both layers honestly
  - the same split-timing pattern is now also being applied to utility and divination spells such as `Detect Magic` and `Augury`, using explicit capability timing plus constrained `RULE` outcomes where the current model is still intentionally narrow
  - additional utility/divination conversions are now following that same path:
    - `Comprehend Languages`
    - `Locate Object`
    - `Divination`
    - `Detect Thoughts`
  - `RULE` is now under explicit spell-audit review:
    - some `RULE` uses remain valid for narrative or information-heavy mechanics
    - some should be moved into existing typed paths like `APPLY_GRANT`
    - some are blocked by named model/runtime gaps, such as ongoing restriction evaluation for `Mage Armor`
  - spell targeting cleanup is also active:
    - source-data should prefer shared targeting constants over raw targeting string literals

### Important Correction to Earlier Notes

Previous 7.7 notes that claimed spell-wide `range`, `duration`, and `atHigherLevels` were the intended authored contract are now stale.

Those fields were implementation drift, not the target model.

Current status:

- legacy spell-root fields still exist in some authored/runtime/DB paths for compatibility while the wider retrofit is underway
- the new canonical direction is capability-owned invocation/branch mechanics
- the SRD content itself still needs the broader retrofit and audit pass before spell/feature/equipment mechanics can be considered complete under this corrected model
- the repo now has a dedicated phase audit for that work:
  - [`PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md`](c:/Users/pilan/Desktop/artificer-toolkit/PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md)

### Landed in this phase so far

- `CreatureAuthored` is now a discriminated union with `STAT_BLOCK` and `LOGISTICS`
- `VehicleAuthored` now allows SRD-table-only vehicle rows to omit unsupported combat/object fields instead of forcing invented values
- character authored/runtime state now supports owned creatures, owned vehicles, and roster equipment assignment maps
- creature compiler and schema now support both creature branches
- creature DB writes and hydration support both branches
- character DB writes support `character_creatures`, `character_vehicles`, `character_creature_equipment`, and `character_vehicle_equipment`
- facet core now includes:
  - `CREATURE`
  - `VEHICLE`
  - `CHARACTER -> CREATURE`
  - `CHARACTER -> VEHICLE`
  - creature and vehicle predicate payload support in shared + DB facet persistence/hydration
- creature repository hydration now returns:
  - `damageVulnerabilities`
  - `damageResistances`
  - `damageImmunities`
  - `conditionImmunities`
- `AUTHORING_PRINCIPLES.md` now explicitly treats authored contracts as UI-authoring contracts first
- `AUTHORING_PRINCIPLES.md` now also explicitly locks the complete-before-seed rule for baseline SRD data
- SRD vehicle seed coverage now includes all 11 manifest vehicles using only SRD-backed fields where the PDF does not provide fuller object stats
- spell/shared range modeling now supports `SPECIAL` as a first-class non-distance `RANGE_KIND`
- first retrofit batch landed on existing spell seed files:
  - `Burning Hands`
  - `Lightning Bolt`
  - `Lesser Restoration`
  - `Revivify`
  - `See Invisibility`
  - `Shield`
- second retrofit batch landed on existing spell seed files:
  - `Acid Splash`
  - `Fire Bolt`
  - `Message`
  - `Ray of Frost`
  - `Sanctuary`
  - `Shatter`
- third retrofit batch landed on existing spell seed files:
  - `Detect Magic`
  - `Guidance`
  - `Guiding Bolt`
  - `Hellish Rebuke`
  - `Magic Missile`
  - `Scorching Ray`
- fourth retrofit batch landed on existing spell seed files:
  - `Chill Touch`
  - `Cone of Cold`
  - `Fireball`
  - `Poison Spray`
- fifth retrofit batch landed on existing spell seed files:
  - `Blight`
  - `Disintegrate`
  - `Harm`
  - `Inflict Wounds`
  - `Ray of Enfeeblement`
- sixth retrofit batch landed on existing spell seed files:
  - `Invisibility`
  - `Levitate`
  - `Major Image`
  - `Protection from Energy`
- seventh retrofit batch landed on existing spell seed files:
  - `Fly`
  - `Fog Cloud`
  - `Protection from Evil and Good`
  - `Remove Curse`
- eighth retrofit batch landed on existing spell seed files:
  - `Locate Animals or Plants`
  - `Scrying`
  - `Sending`
- ninth retrofit batch landed on existing spell seed files:
  - `Clairvoyance`
  - `Detect Evil and Good`
  - `Detect Thoughts`
  - `Find the Path`
- tenth retrofit batch landed on existing spell seed files:
  - `Hex`
  - `Hold Person`
  - `Spider Climb`
  - `Suggestion`
- eleventh retrofit batch landed on existing spell seed files:
  - `Alter Self`
  - `Enhance Ability`
  - `Expeditious Retreat`
  - `True Strike`
- twelfth retrofit batch landed on existing spell seed files:
  - `Arcane Eye`
  - `Arcane Hand`
  - `Arcane Sword`
  - `Silent Image`

### What Still Remains

This 7.7 slice did not finish the full persistence/runtime/content retrofit.

Still pending:

- DB persistence and repository redesign for non-damage/non-condition outcomes
- the broader SRD mechanics audit across features, feats, equipment, creature action-like content
- full record-by-record classification of grants vs capabilities vs manifests vs constrained `RULE` across the SRD baseline
- explicit master-data readiness verification for the new-user baseline character-creation experience
- manifest-specific authored/runtime linkage for things like summons, zones, sensors, and commanded constructs
- post-spell review of retained `RULE` cases and remaining typed-outcome/model gaps exposed by the now-converted spell corpus
  - `Silent Image`
- thirteenth retrofit batch landed on existing spell seed files:
  - `Bane`
  - `Bless`
  - `Blur`
  - `Darkness`
- first missing-file spell batch landed on newly added spell seed files:
  - `Jump`
  - `Light`
  - `Produce Flame`
  - `Sacred Flame`
  - `Shield of Faith`
  - `Shillelagh`
  - `Shocking Grasp`
  - `Spare the Dying`
  - `Speak with Animals`
  - `Zone of Truth`
- second missing-file spell batch landed on newly added spell seed files:
  - `Silence`
  - `Sleep`
  - `Speak with Dead`
  - `Thunderwave`
  - `Tongues`
  - `Water Breathing`
  - `Water Walk`
  - `Web`
  - `Wrathful Smite`
- third missing-file spell batch landed on newly added spell seed files:
  - `Freedom of Movement`
  - `Legend Lore`
  - `Mirror Image`
  - `Moonbeam`
  - `Pass without Trace`
  - `Rope Trick`
- current spell retrofit rule:
  - do not add spell-root `range` / `duration` / `atHigherLevels` as the destination model
  - prefer capability-owned invocation / branch / outcome structures whenever the current model can represent the SRD mechanic honestly
  - use explicit branches instead of shortcut save/hit/miss result fields
  - leave only genuinely unsupported semantics in prose until the model grows
  - leave unsupported rider effects, such as anti-healing or advantage-granting follow-up clauses, in prose until the effect model can represent them structurally
  - leave unsupported mixed dice-plus-flat damage semantics, such as `Disintegrate`, in prose until the effect model can represent them structurally
  - model special-case range semantics structurally with `RANGE_KIND.SPECIAL` when the spell text genuinely uses special range rules
- spell seed coverage now includes a PDF-verified `D` / `F` batch:
  - `Dispel Magic`
  - `Disintegrate`
  - `Dispel Evil and Good`
  - `Fire Storm`
  - `Flame Blade`
  - `Flaming Sphere`
  - `Flesh to Stone`
  - `Floating Disk`
  - `Fly`
  - `Fog Cloud`
  - `Forbiddance`
- spell seed coverage now also includes a PDF-verified `I` / `K` / `L` / `M` batch:
  - `Invisibility`
  - `Knock`
  - `Levitate`
  - `Lesser Restoration`
  - `Lightning Bolt`
  - `Major Image`
- spell seed coverage now also includes a PDF-verified utility/restoration batch:
  - `Locate Animals or Plants`
  - `Mass Healing Word`
  - `Mending`
  - `Message`
  - `Protection from Poison`
- spell seed coverage now also includes a PDF-verified protection/recovery batch:
  - `Protection from Evil and Good`
  - `Protection from Energy`
  - `Purify Food and Drink`
  - `Raise Dead`
  - `Ray of Enfeeblement`
  - `Revivify`
  - `Sanctuary`
  - `See Invisibility`
- spell seed coverage now also includes a PDF-verified communication/reversal batch:
  - `Ray of Frost`
  - `Remove Curse`
  - `Resistance`
  - `Resurrection`
  - `Reverse Gravity`
  - `Scrying`
  - `Sending`
  - `Shield`

### Verified

- `npx tsc -p packages/shared/tsconfig.build.json --noEmit`
- `npx tsc -p packages/schema/tsconfig.build.json --noEmit`
- `npx tsc -p packages/db/tsconfig.build.json --noEmit`
- `npx tsc -p packages/functions/tsconfig.build.json --noEmit`
- `npx tsc -p apps/apis/tsconfig.build.json --noEmit`
- `npx vitest run packages/db/src/__tests__/facet-owner-roundtrip.test.ts packages/db/src/__tests__/creature-repository.test.ts packages/db/src/__tests__/character-upsert.test.ts`
- `npx vitest run packages/db/src/__tests__/srd-manifest.test.ts packages/db/src/__tests__/vehicle-repository.test.ts packages/db/src/__tests__/facet-owner-roundtrip.test.ts packages/db/src/__tests__/creature-repository.test.ts packages/db/src/__tests__/character-upsert.test.ts`

### Current Source Tree Snapshot

- backgrounds: 1
- classes: 24
- creatures: 22
- equipment: 2
- feats: 1
- races: 17
- spells: 324
- vehicles: 11

### Manifest Snapshot

- `CLASS_IDS`: 12
- `SUBCLASS_IDS`: 12
- `RACE_IDS`: 9
- `SUBRACE_IDS`: 8
- `BACKGROUND_IDS`: 1
- `SPELL_IDS`: 324
- `CREATURE_IDS`: 22
- `VEHICLE_IDS`: 11

### Guardrails Added

- added [`srd-manifest.test.ts`](c:/Users/pilan/Desktop/artificer-toolkit/packages/db/src/__tests__/srd-manifest.test.ts)
- completed-bundle regression coverage now locks:
  - classes + subclasses
  - races + subraces
  - backgrounds
  - feats
  - creatures
  - vehicles
- spell manifest drift has been corrected: ten non-SRD spell ids were removed from `SPELL_IDS` after auditing against the local SRD text (`Phantasmal Force`, `Power Word Heal`, `Ray of Sickness`, `Staggering Smite`, `Swift Quiver`, `Telepathy`, `Thorn Whip`, `Thunderous Smite`, `Tsunami`, `Witch Bolt`)
- current spell bundle count is 324 / 324 against the corrected SRD spell manifest
- the spell source-data retrofit is now structurally complete on the locked 7.7 model:
  - all `324 / 324` spell records now use `capabilities`
  - no spell files still use top-level legacy `effects`
  - spell completion work has moved from raw record conversion to retained-`RULE` review and broader model-gap follow-through
- the equipment pass is now underway as the next large master-data tranche:
  - SRD equipment source constants were normalized to shared category/property/measurement registries
  - equipment DB round-trips now prefer authored `capabilities`
  - first capability-bearing item anchors are in source data: `Net`, `Potion of Healing`, `Healer's Kit`, `Holy Water`, `Manacles`, `Acid`, `Alchemist's Fire`, and `Antitoxin`
- the duration model now includes `UNTIL_DISPELLED`, and the shared/schema package builds were refreshed so `packages/db` consumes the updated authored/schema declarations instead of stale dist output
- the latest missing-file fill batches added `Meld into Stone`, `Nondetection`, `Passwall`, `Sleet Storm`, `Speak with Plants`, `Stone Shape`, `Teleportation Circle`, `Vicious Mockery`, `Wall of Force`, `Warding Bond`, `Forcecage`, `Maze`, `Private Sanctum`, `Project Image`, `Resilient Sphere`, `Secret Chest`, `Mind Blank`, `Mislead`, `Modify Memory`, `Phantom Steed`, `Seeming`, `Plane Shift`, `True Seeing`, `Vampiric Touch`, `Plant Growth`, `Wall of Stone`, `Wind Wall`, `Stoneskin`, `Tiny Hut`, `Wall of Ice`, `Word of Recall`, `Circle of Death`, `Foresight`, `Freezing Sphere`, `Mass Suggestion`, `Programmed Illusion`, `Sequester`, `Time Stop`, and `Wish`
- the final spell completion pass also added `Irresistible Dance`, `Mass Cure Wounds`, `Mass Heal`, `Meteor Swarm`, `Phantasmal Killer`, `Polymorph`, `Power Word Kill`, `Power Word Stun`, `Prayer of Healing`, `Prismatic Spray`, `Regenerate`, `Reincarnate`, `Shapechange`, `Simulacrum`, `Slow`, `Spike Growth`, `Spirit Guardians`, `Spiritual Weapon`, `Storm of Vengeance`, `Sunbeam`, `Sunburst`, `Symbol`, `Telekinesis`, `Teleport`, `True Polymorph`, `True Resurrection`, `Wall of Thorns`, `Weird`, and `Wind Walk`

## Remaining Work

### High Priority

- audit the current SRD source tree against the PDF-backed manifest
- complete the broader mechanics audit in [`PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md`](c:/Users/pilan/Desktop/artificer-toolkit/PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md)
- continue the equipment retrofit from the initial item anchor set into the remaining special-use items, area hazards, and passive/state items
- continue the first non-spell anchor tranche after `Second Wind` and `Dragonborn Breath Weapon`
- keep the DB/runtime persistence boundary explicit while shared/schema move ahead of DB for richer capability/outcome semantics

### Branch Refactor Direction

Phase 7.7 now explicitly treats `branch`, not `moment`, as the canonical authored resolution concept.

That means:

- `trigger` identifies the resolution process
- `branch` identifies the result path
- `outcomes` describe what happens on that branch

This update also retires the temporary `saveResolution` experiment. Common SRD patterns such as "half damage on a successful save" should now be authored through explicit `ON_SAVE_FAIL` and `ON_SAVE_SUCCESS` branches instead of damage-local shortcut fields.

This branch decision strengthens the broader Phase 7.7 master-data goal rather than narrowing it. The SRD baseline still needs to support creatures, vehicles, roster ownership, facets, spells, features, feats, equipment, and other mechanic-bearing content with one coherent model.

The same unified model now also covers generic activated class and race features:

- option-derived active mechanics belong on the selected option's feature
- direct class actions belong on the granting feature itself
- update `PHASE_7_7` inventory expectations away from broad non-SRD counts
- finish SRD vehicle seed coverage beyond the currently landed subset
- complete missing SRD content across classes, subclasses, races, backgrounds, feats, spells, equipment, creatures, and vehicles
- resolve all cross-subject references once the missing content files exist

### Follow-through

- regenerate DB types after the final schema shape settles
- apply/additive migration follow-through for any new schema tables used by this phase
- extend full E2E seed verification to the completed SRD baseline
- update [`REBUILD_PLAN.md`](c:/Users/pilan/Desktop/artificer-toolkit/REBUILD_PLAN.md) when Phase 7.7 is actually complete

## Test Plan

- inventory tests:
  - every manifest item has a source file
  - no out-of-scope source file exists
- authored-shape tests:
  - every SRD file satisfies its authored contract
  - both creature branches round-trip correctly
- persistence tests:
  - creature, vehicle, and character roster round-trips
  - creature/vehicle equipment assignment round-trips
- impossible-relation tests:
  - non-mount creatures cannot be assigned mount relationships
  - non-companion creatures cannot be assigned companion relationships
  - equipment assignments must belong to the same character
- facet tests:
  - `CREATURE` and `VEHICLE` selections hydrate correctly
  - creature/vehicle predicates hydrate correctly
  - `CHARACTER -> CREATURE` and `CHARACTER -> VEHICLE` exists relations hydrate correctly
- seed E2E tests:
  - full SRD baseline imports into an empty DB
  - counts match the canonical manifest
  - representative cross-linked scenarios resolve correctly

## Handoff Notes

- treat this file as the legal and modeling guardrail for future 7.7 passes
- treat [`PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md`](c:/Users/pilan/Desktop/artificer-toolkit/PHASE_7_7_MECHANICS_MASTER_DATA_AUDIT.md) as the current mechanics and master-data readiness audit source of truth
- do not add non-SRD content even if it feels "standard 5e"
- do not split mounts or monsters into separate top-level subjects
- do not infer compatibility or bundled loadouts unless the SRD says so explicitly
- after 7.7 convergence, do not forget the explicit deferred cleanup items:
  - retire the misleading `capability` alias over `effects/*` with one repo-wide naming cleanup
  - revisit `engine/dnd5e2014` as a clearer ruleset boundary before the later multi-ruleset monorepo work
