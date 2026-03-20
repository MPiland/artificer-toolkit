# Phase 7.7 Mechanics and Master-Data Audit

## Status: In progress

## Purpose

Phase 7.7 exists to make the SRD CC 5.1 baseline usable as shared master data.

That means:

- SRD content is not just seed content for testing
- SRD content is baseline master data available to every user
- a brand-new user should be able to sign up and immediately build a usable SRD character without authoring their own classes, spells, equipment, feats, races, creatures, or vehicles first

This audit exists because content completeness and model completeness are coupled.

If the authored/runtime model cannot represent the SRD honestly, then the baseline master data will be:

- incomplete
- misleading
- overly prose-driven
- or full of technical debt that later homebrew content will inherit

So this audit is the decision gate for whether Phase 7.7 can actually produce the master-data experience the product needs.

## Scope

This is not a spell-only audit.

This audit covers the full mechanics picture across all SRD mechanic-bearing content:

- grants
- capabilities
- branches
- outcomes
- manifests
- invocation semantics
- range placement
- shape placement
- duration placement
- passive vs active boundaries
- cross-subject consistency

The audit applies to:

- spells
- class features
- subclass features
- race and subrace features
- background features
- feats
- equipment mechanics
- creature action-like mechanics where they inform shared modeling
- vehicle mechanics if they introduce reusable activation semantics

## Current Repo Truth

The repo is no longer at the earlier "spell-root range/duration/atHigherLevels" assumption.

Current shared/schema direction:

- subject roots should not own duplicated action-summary fields
- `capabilities` are now the preferred authored surface for active mechanics
- legacy `effects` still exist as compatibility shims in some authored/compiler/schema paths
- invocation owns `range` and `shape`
- branches/outcomes own `duration`
- outcome support now extends beyond `DAMAGE` and `CONDITION`
- the shared model now includes first-pass support for:
  - `HEAL`
  - `APPLY_GRANT`
  - `TELEPORT`
  - `MANIFEST`
  - constrained `RULE`
- temp HP groundwork has started through the `TEMPORARY_HIT_POINTS` value domain
- richer invocation targeting is now landed in shared/schema for:
  - `SELF`
  - `SINGLE_TARGET`
  - `CHOSEN_CREATURES`
  - `AREA_CONTENTS`
- generic activated feature/action support is now landed in shared/schema through:
  - `TRIGGER.ACTIVATED`
  - `BRANCH.ON_USE`
  - heal bonus support for mixed expressions like `1d10 + fighter level`
- the temporary `saveResolution` experiment has been retired
- explicit result branches are now the canonical direction for save/hit/miss/crit handling:
  - `ON_SAVE_FAIL`
  - `ON_SAVE_SUCCESS`
  - `ON_HIT`
  - `ON_MISS`
  - `ON_CRIT`
- this is more honest to SRD mechanics than a damage-only shortcut field and keeps the model reusable across spells, features, feats, equipment, creatures, and manifests

Current DB/runtime boundary:

- DB effect persistence still truthfully supports only `DAMAGE` and `CONDITION` outcomes
- unsupported authored outcomes such as `HEAL`, `APPLY_GRANT`, `TELEPORT`, `MANIFEST`, and constrained `RULE` now fail loudly in DB upserts instead of being misrouted through condition persistence
- this is intentional until the broader persistence redesign catches up to the expanded shared/schema model
- the branch refactor is not yet fully reflected in the DB persistence layer; broader branch/outcome persistence remains part of the pending redesign
- saving-throw persistence still lags the richer shared/schema authored shape:
  - shared/schema now carry explicit target save `ability` on `SOURCE_SAVE_DC`
  - shared/schema can also carry optional `sourceAbility` for feature-owned source DCs
  - DB persistence still stores `SOURCE_SAVE_DC` rows without those richer fields until the later shared/DB convergence pass

What is not yet proven:

- whether this direction fully covers the SRD corpus
- whether the current typed outcomes are enough
- whether `MANIFEST` needs richer substructure
- whether legacy `effects` should remain as a compatibility alias or be retired later
- whether all passive vs active mechanics are landing in the right abstraction consistently

## Current Source-Data Findings

This section records the current repo-backed audit facts from the SRD source tree, not just the intended destination model.

### Spell source tree findings

Current spell source tree snapshot against the corrected `SPELL_IDS` manifest:

- `324` spell source files exist
- `324` spell files now contain structured `capabilities`
- `0` spell files still rely on legacy top-level `effects`
- remaining spell-root mechanic fields have been retired from spell records as authored-source requirements
- the active spell audit focus has therefore shifted from raw record conversion to:
  - validating retained `RULE` cases
  - validating cross-subject consistency with features, feats, equipment, creatures, and manifests
  - identifying the remaining typed-outcome/model gaps exposed by the converted corpus

Current spell verdict:

- inventory completeness is strong
- the spell source tree is now structurally aligned to the 7.7 capability/branch direction
- the remaining spell-level work is no longer record conversion; it is model-gap review and post-spell follow-through
- the active-mechanics retrofit has moved the spell bundle out of the raw-conversion blocker category and into the “validate structured semantics and close broader model gaps” category

Immediate implication:

- the spell corpus is now a real structured baseline for the current 7.7 model
- capabilities/outcomes are no longer just a target direction in spell source data; they are the authored reality
- the audit must now review whether retained `RULE` cases and typed-outcome boundaries are actually the right final semantics

Current anchor retrofit status:

- first real source-data anchor retrofits have started on `Burning Hands` and `Lightning Bolt`
- those files now use invocation-owned targeting semantics instead of leaning only on root summaries
- those files now use explicit `ON_SAVE_FAIL` and `ON_SAVE_SUCCESS` branches instead of the removed `saveResolution` shortcut
- `Fireball` and `Cone of Cold` now use that same branch-first pattern
- `Shatter` and `Hellish Rebuke` now use that same branch-first pattern as well
- `Misty Step`, `Cure Wounds`, `Healing Word`, `Mass Healing Word`, `Mass Cure Wounds`, `Heal`, and `Mass Heal` are now using first-class `capabilities`
- `Shield` and `Shield of Faith` now use `APPLY_GRANT` capability outcomes instead of root spell summaries
- `Fog Cloud` now uses a first-class `MANIFEST` capability outcome rather than only root spell summary fields
- `Thunderwave` and `Sacred Flame` now use direct capability-owned saving-throw branches instead of root summary fields
- some older anchor spells still sit on the legacy `effects` compatibility surface for now, because the wider spell/runtime persistence stack has not been fully migrated to first-class `capabilities`
- `Find Familiar` is no longer treated as an activation-model blocker
- the current timing rule is now explicit:
  - `activation` is action economy to begin using a capability
  - `castingTime` is elapsed casting duration at the spell root
  - long-cast spells still retain capability `activation`; they simply also carry a longer elapsed `castingTime`
- this timing split is the current 7.7 rule because it preserves future cast-in-progress, cancellation, and interruption support without forcing fake combat-action payloads onto long-form spells

Current race-feature anchor finding:

- `Dragonborn -> Breath Weapon` confirms both the race/feature mechanic shape and the ownership rule
- the SRD mechanic clearly wants a non-spell capability with ancestry-linked shape, damage type, save ability, scaling, and recharge/reset semantics
- the correct ownership point is the selected ancestry option's feature, not the race root
- this ancestry-option-owned feature pattern is now the template for other option-derived active mechanics

### Race and background findings

Current observed source-data counts:

- `9` race/background files contain explicit `grants`
- race files already show strong alignment for passive mechanics like ability score bonuses, senses, and persistent proficiencies
- backgrounds already model persistent proficiencies better than most active mechanic-bearing families

Current race/background verdict:

- these families are directionally closer to master-data readiness than spells
- passive mechanics are often already landing in the correct grant-oriented abstraction
- active race features still need cleanup where they currently remain prose-only

### Class and subclass findings

Current observed source-data counts:

- `22` class/race/background files contain `features`
- only `2` class/feat files currently contain explicit `grants`
- class source files are still heavily feature-description driven

Current class/subclass verdict:

- passive class scaffolding such as spellcasting/proficiencies/progression is partly structured
- feature-level mechanics are still mostly descriptive rather than classified into grants or capabilities
- class and subclass features are a major remaining audit cluster after spells

Immediate implication:

- classes are ahead on passive infrastructure
- classes are behind on feature mechanics
- the eventual master-data baseline will be misleading if class features remain mostly prose

### Feat findings

Current feat source tree:

- the SRD feat bundle is still minimal
- the current feat example, `Grappler`, is prose-only and does not yet classify its passive vs active parts structurally

Current feat verdict:

- feats are not yet structurally complete as master data
- they need direct passive-vs-active classification rather than remaining simple text blocks

### Equipment findings

Current equipment source tree:

- equipment is rich in metadata and static properties
- equipment source constants are now normalized to shared category/property/measurement registries instead of raw string literals
- equipment authoring/persistence now round-trips `capabilities` as the preferred surface, with legacy `effects` still present only as compatibility drift in shared/schema/DB naming
- magic gear remains equipment, not a separate subject; magical upgrades such as `+1` items should be authored as `VARIANT` children of the base item with the `MAGIC` property
- current magic-variant gap: many `+1/+2/+3` equipment variants currently rely on metadata (`maxBonus`) without the equivalent passive modifier grants (`modifiers`) that should drive attack-roll, damage-roll, or AC outcomes at runtime
- equipment `cost` cannot be treated as universally required because the SRD magic-item section frequently omits purchase prices; magic gear should omit cost rather than inventing one
- passive equipment such as holy symbols, druidic foci, and most tools should stay metadata-only unless they truly grant a passive modifier or an active mechanic; `RULE` should not be used just to say an item can be used during play
- bundles and supplied containers should prefer concrete `contains` modeling when the SRD lists included items
- composite ammo/container items should remain decomposable into their component inventory records where that reflects the authored inventory truth
- shields remain their own equipment category rather than collapsing into armor so proficiency/material distinctions remain expressible
- the SRD equipment tree is still mostly category/property/cost/weight/stat metadata, but it is no longer purely metadata-only

Current equipment verdict:

- passive and static equipment modeling is farther along than active equipment modeling
- the first active-item and special-equipment anchors are now present in source data:
  - `Net`
  - `Potion of Healing`
  - `Healer's Kit`
  - `Holy Water`
  - `Manacles`
  - `Acid`
  - `Alchemist's Fire`
  - `Antitoxin`
- equipment activations, special-use mechanics, pack behavior, and loadout semantics still need a dedicated audit pass beyond those anchors
- magic variant correctness is not complete until passive modifier grants are authored for the variant bonus itself; `maxBonus` metadata alone is not a full mechanics representation

Important implementation fact:

- the current SRD equipment tree still skews heavily toward metadata-driven records
- active equipment mechanics are now represented as capabilities in the first anchor slice instead of being entirely absent from source data
- this means the equipment audit is no longer only a boundary-definition task; it is now an active retrofit workstream with passive/state and area-hazard gaps still open

### Creature findings

Current creature source tree:

- creature stat blocks are present and useful for baseline reference/master records
- current creature files are still mostly stat-block shaped rather than capability/outcome shaped
- reusable creature actions and traits have not yet been normalized into the shared capability/outcome model

Current creature verdict:

- creature master records are useful and necessary for baseline play-state and roster ownership
- creature action grammar still needs an explicit boundary decision relative to the shared capability/outcome model

Important implementation fact:

- creature files are currently carrying core stat-block/logistics data, not reusable action structures
- the creature audit must decide what should remain native stat-block grammar versus what should reuse shared capability/outcome modeling

## Spell Family Audit Buckets

The spell corpus is large enough that the audit needs family buckets before record-by-record retrofit.

### Bucket A: direct damage / save / attack spells

Representative files already in tree:

- `Lightning Bolt`
- `Burning Hands`
- `Fireball`
- `Ray of Frost`
- `Inflict Wounds`

Expected modeling:

- capability invocation with range/shape
- damage outcomes on branches
- structured scaling where applicable
- no root summary fields

Current verdict:

- this family is the most structurally approachable
- partial examples already exist
- it should be the template family for the broader spell retrofit

### Bucket B: buff / debuff / protection spells

Representative files in tree:

- `Shield`
- `Bless`
- `Bane`
- `Fly`
- `Protection from Energy`
- `Darkvision`

Expected modeling:

- capability invocation
- `APPLY_GRANT` outcomes for temporary modifiers, senses, movement, protections, or similar typed benefits
- duration on the applied outcome path

Current verdict:

- the direction is clear
- the shared model now points the right way
- the source data is still mostly prose or legacy root-summary fields

### Bucket C: healing / restoration / resurrection spells

Representative files in tree:

- `Cure Wounds`
- `Mass Cure Wounds`
- `Heal`
- `Regenerate`
- `Raise Dead`
- `True Resurrection`

Expected modeling:

- capability invocation
- `HEAL` outcomes where the mechanic is genuinely healing
- additional typed or constrained handling where restoration/resurrection semantics exceed plain healing

Current verdict:

- basic healing clearly belongs in `HEAL`
- restoration/resurrection still need deeper modeling decisions
- this family is one of the main reasons a full audit is required before calling spell master data complete

### Bucket D: teleport / reposition spells

Representative files in tree:

- `Misty Step`
- `Dimension Door`
- `Teleport`
- `Plane Shift`
- `Word of Recall`

Expected modeling:

- capability invocation
- `TELEPORT` outcomes
- additional constrained structure where plane-travel or destination restrictions exceed simple movement

Current verdict:

- first-class teleport support is directionally necessary and correct
- edge-case travel rules still need full audit coverage

### Bucket E: summon / manifest / sensor / wall / zone spells

Representative files in tree:

- `Find Familiar`
- `Phantom Steed`
- `Arcane Hand`
- `Spiritual Weapon`
- `Fog Cloud`
- `Darkness`
- `Wall of Force`
- `Silent Image`

Expected modeling:

- capability invocation
- `MANIFEST` outcomes
- optional child capabilities on the created manifest
- richer manifest linkage for persistent summoned or created entities

Current verdict:

- this is the clearest justification for the manifest family
- it is also one of the least complete areas in current source data
- this family is critical to the long-term correctness of the model

### Bucket F: transformation / state-replacement / complex control spells

Representative files in tree:

- `Polymorph`
- `True Polymorph`
- `Shapechange`
- `Hold Person`
- `Suggestion`
- `Mass Suggestion`

Expected modeling:

- capability invocation
- combinations of condition, apply-grant, manifest, or additional typed outcomes depending on the exact mechanic

Current verdict:

- this family still contains likely model gaps
- it should not be forced into simplistic existing payloads just to mark content "done"

### Bucket G: narrative or edge-case rule spells

Representative files in tree:

- `Wish`
- `Legend Lore`
- `Divination`
- `Commune`
- `Augury`

Expected modeling:

- capability invocation where relevant
- constrained `RULE` only when a better typed outcome does not fit

Current verdict:

- this is where constrained `RULE` is most likely to remain justified
- each retained `RULE` use should be documented explicitly

## Class and Feature Family Audit Buckets

### Bucket A: passive baseline infrastructure

Examples:

- class proficiencies
- spellcasting limits/charges
- passive racial ability-score features
- passive sense access

Expected modeling:

- direct grants
- progression metadata
- passive subject-root authored structures

Current verdict:

- this is the strongest part of the current SRD baseline

### Bucket B: activated class or subclass features

Examples:

- `Bardic Inspiration`
- `Channel Divinity`
- `Breath Weapon`
- `Peerless Skill`
- `Countercharm`

Expected modeling:

- capabilities
- branches and typed outcomes where possible
- grant-application where temporary buffs/debuffs are the result

Current verdict:

- this family is still mostly prose
- it is one of the largest active-mechanics gaps outside spells

Representative examples from current source data:

- `Bardic Inspiration`
- `Channel Divinity`
- `Second Wind`
- `Action Surge`
- `Rage`
- `Breath Weapon`
- `Sneak Attack`

Current implication:

- the current baseline can name these mechanics
- it cannot yet treat them as fully structured master data

### Bucket C: option-driven passive unlocks

Examples:

- eldritch invocation style passive benefits
- subclass-granted persistent proficiencies or modifiers
- racial ancestry option payloads

Expected modeling:

- direct grants or unlocked subject references

Current verdict:

- partially directioned in current repo
- still inconsistent and under-audited

Representative examples from current source data:

- warlock invocation selections
- subclass domain spell and proficiency unlocks
- race ancestry option payloads

### Bucket D: narrative / permission / special-case features

Examples:

- `Shelter of the Faithful`
- similar background permissions
- narrative exemptions or access features

Expected modeling:

- constrained `RULE` unless a stronger typed model emerges later

Current verdict:

- this family may legitimately retain some `RULE`
- but those cases should be explicit rather than accidental prose leftovers

## Equipment Family Audit Buckets

### Bucket A: passive equipment state

Examples:

- armor AC
- weapon categories and properties
- cost, weight, rarity, logistical metadata

Expected modeling:

- subject metadata plus passive rules already represented in equipment structure

Current verdict:

- this is already one of the healthiest source-data families

### Bucket B: active equipment actions

Examples:

- thrown/special-use equipment
- items whose SRD behavior depends on taking an action or special attack pattern
- equipment with rider behavior such as `Net`

Expected modeling:

- capability if the action is something the item itself meaningfully contributes to mechanically

Current verdict:

- largely unaudited today
- needs a clear boundary so we do not over-model ordinary attack usage but also do not lose genuinely special item mechanics

Boundary rule this audit should use:

- do not model every ordinary weapon attack as item-owned capability data just because the item can be used to attack
- do model equipment as capability-bearing when the SRD item itself introduces a special reusable action pattern or special rider that is not already covered by general attack rules

### Bucket C: packs, containment, and assigned logistics

Examples:

- packs
- saddles, harnesses, barding, vehicle gear
- character creature/vehicle equipment assignment

Expected modeling:

- equipment subject metadata plus ownership/assignment structures

Current verdict:

- this remains a separate but related 7.7 workstream
- important for master-data usability because new users need baseline items and pack content to behave coherently

## Prioritized Audit Sequence

The repo now has enough evidence to justify the next audit order.

### 1. Spells

Reason:

- largest active-mechanics family
- largest current drift between desired model and current source data
- highest impact on baseline master-data quality

### 2. Class and subclass features

Reason:

- central to character creation and leveling
- currently too prose-heavy
- strongly affects the baseline user experience after signup

### 3. Feats and race/background active features

Reason:

- smaller scope than classes/spells
- still important for coherent active-vs-passive modeling

### 4. Equipment and creature action boundary

Reason:

- lower immediate impact than spells/classes
- still necessary for longer-term model consistency and baseline roster usability

## Current Boundary Decisions Emerging From the Audit

These are not final close-out decisions yet, but they are the strongest current repo-backed rules.

### 1. Passive-first families are closest to baseline master-data readiness

Races, backgrounds, proficiencies, senses, and other passive grant-heavy families are currently the closest to the model we want.

That does not mean they are fully complete, but it does mean:

- they are the strongest current foundation for baseline master data
- they should not be reworked unnecessarily while solving the active-mechanics problem

### 2. Active-mechanics families are the true 7.7 blocker

The major blockers are not inventory counts anymore. They are active mechanic-bearing records that still live mostly in prose:

- spells
- class and subclass features
- feats
- active race features
- special equipment behaviors

### 3. Equipment needs a narrow action boundary

The audit should not turn every weapon or tool into bespoke capability content.

Working rule:

- ordinary use stays in general item metadata and global combat/system rules
- item-specific special mechanics get capability treatment

This keeps the equipment model honest without creating noise.

### 4. Creature actions need a hybrid decision, not an all-or-nothing rewrite

The current creature master-data value is in stat blocks, ownership, and baseline roster use.

Working rule:

- core creature stat-block grammar should remain first-class
- shared capability/outcome modeling should be reused where it improves cross-subject consistency or where summoned/commanded/linked creature behavior needs it

That means the audit should not force a full creature-action rewrite just to match spells.

### 5. Narrative permissions remain a valid constrained-`RULE` family

Not every SRD mechanic should become a typed grant or typed outcome.

Working rule:

- narrative permissions, special access, and exceptional guidance mechanics may remain constrained `RULE` entries when a richer typed model would be artificial
- but those cases must be explicit and audited, not accidental leftovers

## Current Readiness Matrix

| Family | Inventory completeness | Mechanics structure | Baseline master-data readiness |
|---|---|---|---|
| Spells | High | Low to medium | Not ready |
| Class/subclass spellcasting scaffolding | High | Medium to high | Partially ready |
| Class/subclass active features | Medium | Low | Not ready |
| Race/subrace passive features | Medium to high | Medium to high | Closest to ready |
| Race/subrace active features | Medium | Low | Not ready |
| Backgrounds | Medium | Medium | Partially ready |
| Feats | Low to medium | Low | Not ready |
| Equipment passive metadata | High | High | Closest to ready |
| Equipment special-use mechanics | Low to medium | Low | Not ready |
| Creature master records | Medium | Medium | Partially ready |
| Creature action/capability consistency | Low | Low | Not ready |

## Next Concrete Audit Tasks

The next classification passes should be done in this order:

### 1. Spell record-by-record classification

For each spell:

- assign spell family bucket
- decide primary outcome family
- decide whether `RULE` is justified
- record whether current model covers it fully, awkwardly, or not yet

### 2. Class and subclass feature classification

For each active feature:

- decide passive grant vs capability vs constrained `RULE`
- identify whether spell-grant, modifier-grant, sense-grant, or feat-grant structures already cover the passive part
- identify where active parts need capability modeling

### 3. Feat and race/background feature classification

For each feature:

- split passive from active
- identify whether current grant families already cover the passive pieces
- identify whether current outcome families cover the active pieces

### 4. Equipment and creature boundary decision pass

For each relevant item/creature case:

- decide whether it stays native metadata/stat-block grammar
- or whether it needs shared capability/outcome modeling for consistency

## Priority Anchor Records For The First Implementation Tranche

This section names concrete SRD records that should drive the next modeling and retrofit slices.

These are not the whole audit. They are the highest-signal anchor cases for validating the model against real master-data needs.

### Spell anchors

| Spell | Primary family | Expected primary modeling path | Current source verdict |
|---|---|---|---|
| `Lightning Bolt` | direct damage/save/attack | capability + invocation shape + damage outcome + scaling | partially structured but still uses root summary fields |
| `Shield` | buff/protection | capability + `APPLY_GRANT` for temporary AC protection + constrained handling for `Magic Missile` immunity | prose plus root summary fields |
| `Mass Cure Wounds` | healing | capability + `HEAL` + scaling | prose plus root summary fields |
| `Find Familiar` | summon/manifest | capability + creature-like `MANIFEST` with later linkage expectations | prose only |
| `Fog Cloud` | zone/cloud manifest | capability + zone `MANIFEST` with duration | prose plus root summary fields |
| `Misty Step` | teleport/reposition | capability + `TELEPORT` | likely straightforward once retrofitted |
| `Polymorph` | transformation/state replacement | likely model-gap candidate; may need richer typed support than current outcome families | prose plus root summary fields |
| `Wish` | narrative/edge-case rule | constrained `RULE` with explicit documentation | prose plus root summary fields |

Why these anchors matter:

- together they force the model across damage, healing, apply-grant, teleport, manifest, transformation pressure, and justified `RULE`
- if these records fit cleanly, the rest of the spell audit becomes much easier to execute consistently

### Current model support verdicts for spell anchors

| Spell | Current shared-model verdict | Why |
|---|---|---|
| `Lightning Bolt` | Partially supported and now implemented as an anchor | current damage, shape, range, and scaling fit the branch model cleanly, and the anchor source file now uses explicit `ON_SAVE_FAIL` / `ON_SAVE_SUCCESS` branches |
| `Shield` | Mostly supported, still awkward | temporary AC protection fits `APPLY_GRANT`, but the `Magic Missile` immunity clause still needs constrained `RULE` or richer typed support |
| `Mass Cure Wounds` | Partially supported | `HEAL` and heal scaling exist, but multi-target chosen-creatures-in-an-area semantics still need clearer targeting structure |
| `Find Familiar` | Not yet fully supported | `MANIFEST` exists, but creature-like manifestation linkage, dismissal/resummon behavior, and familiar command semantics are not yet mature |
| `Fog Cloud` | Partially supported | zone-like `MANIFEST` plus duration are directionally right, but cloud-specific visibility rules still likely need constrained `RULE` or richer manifest semantics |
| `Misty Step` | Strongly supported | current `TELEPORT` structure is a good fit for self repositioning within visible/allowed distance semantics |
| `Polymorph` | Not yet supported cleanly | no dedicated transformation/state-replacement outcome exists yet |
| `Wish` | Supported only as constrained fallback | `RULE` can carry it, but that is a conscious fallback, not full typed modeling |

### Class and subclass feature anchors

| Feature | Source | Expected primary modeling path | Current source verdict |
|---|---|---|---|
| `Bardic Inspiration` | Bard | capability with temporary applied benefit structure | prose only |
| `Channel Divinity` | Cleric | capability container with subclass/domain-specific child capabilities | prose only |
| `Second Wind` | Fighter | capability + `HEAL`, linked to existing resource charges | prose plus resource metadata |
| `Action Surge` | Fighter | capability or constrained rule for extra-action grant semantics | prose only |
| `Rage` | Barbarian | capability + applied temporary grants/modifiers, linked to rage charges | prose plus resource metadata |
| `Unarmored Defense` | Barbarian | passive direct grant | already partially structured |
| `Sneak Attack` | Rogue | active conditional damage augmentation; likely capability or a separate attack-modifier model decision | prose only |
| `Disciple of Life` | Life Domain | passive modifier to healing resolution | prose only |

Why these anchors matter:

- they cover charge-backed activations
- they cover passive-vs-active splits inside the same class
- they stress the difference between pure grants, capabilities, and mechanics that may still need additional typed support

### Current model support verdicts for class-feature anchors

| Feature | Current shared-model verdict | Why |
|---|---|---|
| `Bardic Inspiration` | Not yet supported cleanly | current outcomes do not yet model "grant a die that can later modify another roll" as a first-class reusable structure |
| `Channel Divinity` | Not yet supported cleanly | we can model individual capabilities, but the "base channel resource plus domain-specific activated options" pattern is not yet encoded as a mature authored strategy |
| `Second Wind` | Strongly supported | resource-backed activation plus `HEAL` is a good current fit |
| `Action Surge` | Awkward / likely constrained | extra-action semantics do not map naturally to current grant/outcome families yet |
| `Rage` | Partially supported | temporary applied grants and resource usage fit the direction, but rage restrictions, damage resistance, and attack-specific clauses still need more explicit modeling |
| `Sneak Attack` | Not yet supported cleanly | this is conditional attack augmentation, which does not currently fit neatly into the present outcome families |
| `Disciple of Life` | Not yet supported cleanly | passive modification of later healing resolution is not yet first-class in the grant/outcome model |

### Race, background, and feat anchors

| Feature | Source | Expected primary modeling path | Current source verdict |
|---|---|---|---|
| `Dragonborn Ability Score Increase` | Dragonborn | direct modifier grants | already structured |
| `Dragonborn Breath Weapon` | Dragonborn | capability + shape + damage + scaling + recharge/reset semantics | prose only |
| `Shelter of the Faithful` | Acolyte | constrained `RULE` or later richer social-access model | prose feature |
| `Grappler` | Grappler feat | split passive benefit plus active pin capability | prose only |
| `Darkvision`-style racial sense features | Elf/Dwarf/Tiefling/etc. | direct sense grants | already directionally structured |

Why these anchors matter:

- they prove the audit is not spell-only
- they show that some SRD records are already near the right model while others are still far away

### Current model support verdicts for race/background/feat anchors

| Feature | Current shared-model verdict | Why |
|---|---|---|
| `Dragonborn Ability Score Increase` | Strongly supported | direct modifier grants already fit the current grant model well |
| `Dragonborn Breath Weapon` | Partially supported | damage, shape, and scaling are directionally supported, but recharge/reset and half-damage-on-success remain incomplete |
| `Shelter of the Faithful` | Supported as constrained fallback | this is currently a good `RULE` candidate unless a richer social-access model is introduced later |
| `Grappler` | Not yet supported cleanly | it mixes passive conditional advantage with an active restraining pin action, and the current model does not yet express that split elegantly |
| `Darkvision`-style racial sense features | Strongly supported | direct sense grants already fit the current grant model well |

### Equipment and creature anchors

| Record | Source | Expected primary modeling path | Current source verdict |
|---|---|---|---|
| `Net` | Equipment | possible special equipment capability boundary case | metadata only |
| `Shield` item | Equipment | passive item metadata, not to be confused with the `Shield` spell | already correctly passive-oriented |
| `Wolf` | Creature | retain stat-block grammar, then decide whether bite/pack tactics should remain native or map into shared capability vocabulary | stat block only |
| summoned/familiar-like creature linkage | Spell + Creature | manifest outcome linked to creature master data where appropriate | not yet structurally modeled |

Why these anchors matter:

- they keep the audit honest about subject boundaries
- they prevent over-modeling equipment while also preventing under-modeling summon/creature linkage

### Current model support verdicts for equipment/creature anchors

| Record | Current shared-model verdict | Why |
|---|---|---|
| `Net` | Boundary case, not yet decided | the current model can host a capability if needed, but the audit still has to decide whether this belongs in item-level mechanics or broader attack rules |
| `Shield` item | Strongly supported as passive data | it is correctly treated as passive equipment metadata and should not be confused with the spell |
| `Wolf` | Partially supported | the creature subject can already hold the master record, but stat-block action representation versus shared capability reuse remains unresolved |
| familiar/steed linkage | Not yet supported cleanly | manifest -> creature master-data linkage is not yet rich enough for this family |

## Explicit Missing-Model Requirements

This section turns the audit verdicts into concrete model requirements visible from the current shared authored types.

### 1. Richer targeting semantics

Current issue:

- `InvocationAuthored` currently gives us activation, trigger, range, optional shape, and saving-throw metadata
- it does not yet express richer targeting qualifiers clearly enough for many SRD effects

Mechanics affected:

- `Mass Cure Wounds`
- `Bless`
- `Bane`
- many "up to N creatures" spells
- target exclusions such as "no effect on undead or constructs"

Requirement:

- add richer invocation-level target selection and qualification semantics rather than leaving them in prose

Current status:

- first shared/schema targeting support has now landed for:
  - `SELF`
  - `SINGLE_TARGET`
  - `CHOSEN_CREATURES`
  - `AREA_CONTENTS`
- invocation can now also carry:
  - `dispositionKind`
  - `maxTargets`
  - `excludedCreatureTypeIds`
  - freeform supporting `detail`
- this is enough to start representing cases like `Mass Cure Wounds` more honestly, but it does not by itself solve every targeting edge case

### 2. Better alternate save-resolution modeling

Current issue:

- current branches/outcomes can express fail-side effects cleanly
- they do not yet give us a clean compact pattern for "full on fail, half on success" or similar alternate save outcomes

Mechanics affected:

- `Lightning Bolt`
- `Burning Hands`
- `Dragonborn Breath Weapon`
- many SRD save-based damage spells

Requirement:

- add a clearer representation for paired fail/success outcome resolution

### 3. Mixed-value damage support

Current issue:

- `DamageAuthored` supports fixed, dice, or pool payloads
- it does not yet cleanly support a single damage effect that combines dice and flat amounts

Mechanics affected:

- `Disintegrate`
- other mixed-value damage cases

Requirement:

- expand damage modeling so one damage outcome can contain multiple numeric components when the SRD requires it

### 4. Transformation / state-replacement outcome support

Current issue:

- the current typed outcomes do not yet include a dedicated transformation/state-replacement family

Mechanics affected:

- `Polymorph`
- `True Polymorph`
- `Shapechange`

Requirement:

- add a first-class typed outcome for transformation/state replacement instead of forcing these into `RULE` or overloaded manifest logic

### 5. Capability-to-resource linkage ergonomics

Current issue:

- resource records exist
- but the authored/runtime link between a capability and the resource it consumes is not yet explicit enough

Mechanics affected:

- `Second Wind`
- `Rage`
- `Channel Divinity`
- `Bardic Inspiration`

Requirement:

- make capability-to-resource expenditure linkage a first-class part of the authored/runtime story

### 6. Richer manifest lifecycle and linkage semantics

Current issue:

- `ManifestAuthored` can currently express a subtype, label/detail, optional shape, optional `creatureId`, and optional child capabilities
- it does not yet fully express summon lifecycle, linkage, dismissal, persistence, and command semantics

Mechanics affected:

- `Find Familiar`
- `Find Steed`
- `Phantom Steed`
- `Spiritual Weapon`
- `Arcane Hand`
- zone/cloud/wall spells with persistent state

Requirement:

- keep one manifest family, but deepen its lifecycle and linkage semantics before calling summon or zone mechanics complete

### 7. Delayed / borrowed-roll / later-use benefit structures

Current issue:

- the current outcome families do not yet model "create a later-consumable die or later-consumable benefit" especially well

Mechanics affected:

- `Bardic Inspiration`
- similar delayed-use benefits

Requirement:

- add a reusable representation for later-consumable benefits rather than forcing them into plain grants or plain immediate outcomes

### 8. Conditional attack augmentation structures

Current issue:

- some mechanics modify attack resolution conditionally rather than creating a standalone capability outcome

Mechanics affected:

- `Sneak Attack`
- parts of `Rage`
- feat mechanics like `Grappler`

Requirement:

- decide whether these belong in capability modeling, attack-modifier modeling, or a new typed family

## Recommended Immediate Implementation Order After Audit

Once the audit is judged detailed enough to move back into implementation, the next code/content slices should be:

1. remove remaining spell-root mechanic assumptions from the intended direction and make the persistence/runtime path follow capability-owned invocation and branch/outcome duration
2. land spell anchor records that prove `DAMAGE`, `HEAL`, `APPLY_GRANT`, `TELEPORT`, `MANIFEST`, and constrained `RULE`
3. land class-feature anchor records that prove charge-backed capabilities versus passive grants
4. use those anchor slices to drive the larger record-by-record retrofit across the SRD master-data corpus

## Candidate Next Model Slice

Based on the audit so far, the most leverage-rich next model slice looks like:

1. alternate save-resolution support
2. capability-to-resource linkage
3. richer manifest lifecycle/linkage
4. mixed-value damage support

Why this slice first:

- richer invocation targeting has already landed as the first part of this slice
- the remaining items still unblock a large number of spell and class-feature anchors at once
- it improves both content accuracy and future UI authoring
- it avoids prematurely jumping to rarer gaps like transformation before the broader common mechanics are covered better

## Working Punch List

This is the concrete short-list the next implementation pass should close in order.

### Spell anchor punch list

- `Lightning Bolt`
  - prove capability-owned invocation
  - remove root summary dependence
  - keep structured scaling
- `Shield`
  - prove temporary AC protection through `APPLY_GRANT`
  - decide whether `Magic Missile` immunity stays constrained `RULE` or gets richer support later
- `Mass Cure Wounds`
  - prove `HEAL`
  - prove heal scaling
- `Find Familiar`
  - prove creature-like `MANIFEST`
  - decide minimum linkage to creature master data and later commands
- `Fog Cloud`
  - prove zone/cloud `MANIFEST`
  - prove duration placement below spell root
- `Misty Step`
  - prove `TELEPORT`
- `Polymorph`
  - explicitly record whether current model is still insufficient
- `Wish`
  - explicitly justify constrained `RULE`

### Class feature punch list

- `Bardic Inspiration`
  - decide whether the granted die should be modeled as an applied grant, capability-created resource, or another typed structure
- `Channel Divinity`
  - decide base container model plus domain-specific child capability strategy
- `Second Wind`
  - prove charge-backed `HEAL`
- `Action Surge`
  - decide whether extra action semantics fit current capability/grant space or require constrained `RULE`
- `Rage`
  - prove charge-backed temporary applied grants
- `Sneak Attack`
  - decide whether this belongs in capability space, attack-modifier space, or another typed path
- `Disciple of Life`
  - decide passive healing modifier model

### Race / background / feat punch list

- `Dragonborn Breath Weapon`
  - prove non-spell active racial capability with shape, scaling, and recharge semantics
- `Grappler`
  - split passive and active parts structurally
- `Shelter of the Faithful`
  - explicitly justify constrained `RULE`

### Equipment / creature boundary punch list

- `Net`
  - decide if its special-use behavior should be item-owned capability content
- `Wolf`
  - document which creature actions stay native stat-block grammar
- familiar/steed linkage
  - decide how manifests should point to creature master records where appropriate

## Representative Record Classifications

These examples anchor the audit to the current SRD source data rather than leaving it purely abstract.

| Source record | Current repo shape | Expected canonical classification | Current verdict |
|---|---|---|---|
| `Dragonborn -> Ability Score Increase` | feature with structured modifier grants | direct passive grants | correctly directioned |
| `Dragonborn -> Breath Weapon` | prose-only feature | active capability with invocation, shape, damage outcome, scaling, and recharge/reset semantics | not yet structurally modeled |
| `Acolyte -> proficiencies` | structured proficiency grants | direct passive grants | correctly directioned |
| `Acolyte -> Shelter of the Faithful` | prose feature/detail | likely constrained `RULE`, unless later modeled more richly | acceptable but still needs explicit verdict |
| `Bard -> Bardic Inspiration` | prose-only class feature | active capability, probably applying grant-like or modifier-like effects | not yet structurally modeled |
| `Warlock Eldritch invocation style grants` | some structured grants | direct passive grants or unlocked capabilities depending on the invocation | partially directioned, still incomplete |
| `Grappler` | prose-only feat | split passive grant-like benefits plus active capability for the pin action | not yet structurally modeled |
| `Shield` spell | currently represented in the spell tree with root summary fields in older slices | active capability applying a temporary AC-related typed grant | target direction is clear, content still needs full retrofit |
| `Find Familiar` spell | prose-only spell metadata | active capability producing a creature-like manifest with later linkage/command expectations | not yet structurally modeled |
| `Net` equipment | static item metadata only | passive item metadata plus a reusable action/capability question if equipment actions become first-class | audit still needed |
| `Wolf` creature | stat-block only | creature stat block with either native creature-action grammar or mapped shared capabilities for bites/traits | boundary still unresolved |

Updated anchor implementation status:

- `Second Wind` is now proven as a feature-owned capability using `ACTIVATED -> ON_USE -> HEAL`
- `Dragonborn Breath Weapon` is now proven as an ancestry-option-owned feature using explicit `ON_SAVE_FAIL` / `ON_SAVE_SUCCESS` branches plus ancestry-derived shape, damage type, save ability, and recharge semantics
- these two anchors confirm that the capability/branch/outcome model is not spell-only

## Canonical Model Matrix

This matrix is the current intended meaning of each mechanics concept.

| Concept | Canonical role | What it should own | What it should not own |
|---|---|---|---|
| `grants` | Passive, persistent, always-on, or selection-based mechanics | modifiers, proficiencies, senses, spell access, feat access, other persistent typed benefits | activated attacks, cast actions, triggered commands, duplicated summaries of active mechanics |
| `capabilities` | Activated or triggered things a subject can do | activation, trigger, invocation, ordered branches | passive bonuses that are always on |
| `invocation` | Delivery and targeting semantics for a capability | activation/trigger timing, range, shape, target/origin semantics | persistent outcome lifetime |
| `branches` | Explicit resolution boundary and result path | ordering, fail/success or hit/miss branching, scaling application, duration of applied effects | subject-root metadata |
| `outcomes` | What actually happens when a branch resolves | damage, condition, heal, apply-grant, teleport, manifest, constrained rule | duplicated delivery semantics like range |
| `manifest` | A created persistent thing in the world/state model | created object identity, subtype, optional child capabilities, linked details | raw geometry-only shorthand in place of a persistent created thing |
| `range` | Invocation targeting/delivery | self, touch, distance, sight, special, unlimited, etc. | subject-root spell summary |
| `shape` | Invocation geometry or manifest footprint geometry | line, cone, sphere, wall, cube, cylinder, radius, similar targeting geometry | the full persistent-zone model by itself |
| `duration` | Lifetime of an applied effect or manifest | concentration, timed duration, until dispelled, until triggered, similar persistence semantics | subject-root spell or feature summary |
| `RULE` | Constrained fallback for unmodeled mechanics | narrow, explicitly justified SRD mechanics not yet representable structurally | default answer for common mechanics families |

## Placement Rules

These rules are now locked for the audit:

- subject roots own identity, metadata, passive grants, and reusable capabilities
- subject roots do not own duplicated summaries like spell-root `range`, `duration`, or `atHigherLevels`
- `range` belongs on capability invocation
- `shape` belongs on capability invocation
- `duration` belongs on branches or outcomes
- `activation` belongs on capability invocation and means action economy to begin use
- `castingTime` belongs on spells and means elapsed cast duration, not action economy
- spells may use both `activation` and `castingTime`
- long-cast spells are not blocked by the timing model itself and should not be forced into fake action-economy activations just to be marked complete
- temporary buffs/debuffs should normally be modeled as applying existing typed grants
- persistent created things should normally be modeled as manifests, not as loose prose-only zones or summons
- `RULE` is allowed only when the SRD mechanic is still genuinely not representable by a better typed path

## Grants Audit

### Current Grant Families in Scope

The repo already treats these as first-class grant families:

- modifier
- proficiency
- sense
- spell
- feat

### Current Grant Verdict

These grant families still make sense as the passive/persistent layer for baseline master data.

They are the right abstraction for:

- always-on racial senses like darkvision
- passive proficiencies from race, class, background, and feats
- persistent modifier-style changes
- passive access to other subject content, such as granted spells or feats

### Grant Questions This Audit Must Answer

The audit must explicitly classify when something should remain a direct grant versus when it should become an active capability that applies grants.

Examples that need consistent treatment:

- `Darkvision` from race vs a temporary darkvision spell effect
- passive movement or AC changes from equipment vs temporary spell-based changes
- feat-granted passive bonuses vs activated feat powers

### Initial Grant Conclusions

- direct grants remain the right home for passive or persistent baseline benefits
- temporary or triggered mechanics should not be stuffed directly into passive grant slots
- `APPLY_GRANT` should be the default path for temporary buffs/debuffs where an existing typed grant family already models the result
- temp HP should stay out of generic healing and instead continue down the grant/modifier-domain path

### Current Grant Gaps

- verify whether modifier payloads are rich enough for all temporary spell and feature buffs/debuffs
- verify whether temp HP needs any additional modifier-domain structure beyond the initial value-domain groundwork
- audit current SRD source usage to find any mechanics that are currently authored as direct grants but are really active capabilities

## Capabilities Audit

### Why Capabilities Exist

Capabilities are the reusable action surface for mechanic-bearing content.

They should cover:

- spells as cast actions
- active class and subclass features
- feat activations
- equipment activations
- manifest commands
- reusable creature abilities where the shared model benefits from that alignment

### Initial Capability Verdict

The capability concept is the right direction because it separates:

- what a subject is
- what a subject passively grants
- what a subject can actively do

That separation is necessary for consistent SRD master data and later homebrew authoring.

### Capability Questions This Audit Must Answer

- should `CapabilityAuthored` become the permanent public concept, or remain an alias during transition
- should legacy `effects` remain only as compatibility aliases
- are invocation semantics rich enough for touch, self, sight, special, triggered, and command-style activations
- do manifestations with child actions fit the capability model cleanly

## Outcome Audit

### Typed Outcomes Currently in Scope

The current shared/schema direction now includes:

- `DAMAGE`
- `CONDITION`
- `HEAL`
- `APPLY_GRANT`
- `TELEPORT`
- `MANIFEST`
- constrained `RULE`

### Initial Outcome Verdict

These families are directionally correct and clearly better than a damage-or-condition-only model.

They map naturally to major SRD families:

- direct attacks and save effects -> `DAMAGE`, `CONDITION`
- healing and restoration -> `HEAL`
- buffs and debuffs -> `APPLY_GRANT`
- movement and relocation -> `TELEPORT`
- summons, walls, clouds, sensors, and constructs -> `MANIFEST`

### Outcome Questions This Audit Must Answer

- are branches the correct explicit resolution boundary
- are direct vs roll-table branches enough for SRD coverage
- which remaining SRD mechanics still require `RULE`
- which currently-`RULE` mechanics should instead receive another typed outcome family
- how much richer `MANIFEST` needs to become to cover summoned creatures, zones, walls, sensors, and commanded constructs honestly

## Manifest Audit

### Why Manifest Exists

The SRD contains a large set of mechanics that create persistent things rather than just dealing damage or applying conditions.

This includes:

- summoned creatures or companions
- steeds and familiars
- persistent zones and clouds
- walls and barriers
- sensors
- magical constructs like hands or weapons
- certain illusion-style presented objects that materially matter for play state

### Initial Manifest Subtypes

Current shared direction allows one manifest family with subtypes such as:

- creature-like result
- zone
- sensor
- weapon-like result
- hand-like result
- object-like result
- illusion-like result

### Initial Manifest Verdict

One manifest family with subtypes is still the best current design direction.

It is preferable to creating disconnected summon/zone/wall systems, because many SRD mechanics blend those ideas and need shared linkage rules.

### Manifest Questions This Audit Must Answer

- what minimum common shape all manifests need
- when a manifest should own child capabilities
- how deeply manifests need to link to creature or vehicle records
- what short-term runtime data is required for baseline sheet usability even before full combat automation exists

Examples that need explicit treatment:

- `Find Familiar`
- `Find Steed`
- `Phantom Steed`
- `Arcane Hand`
- `Spiritual Weapon`
- `Fog Cloud`
- `Darkness`
- `Wall of Force`

## Cross-Subject Mechanics Audit Matrix

This section records the current family-level audit verdicts. These are not final completion claims; they are the current repo-backed classification targets for the larger 7.7 pass.

| Content family | Common mechanic families present in SRD | Primary modeling path | Current verdict | Main gaps still to audit or implement |
|---|---|---|---|---|
| Spells | damage, conditions, healing, buffs, teleport, summons, walls, clouds, sensors, transformations, restoration | capabilities + branches + typed outcomes + manifests | Directionally correct, not fully retrofitted | full spell-by-spell retrofit; remove remaining legacy root shortcuts; prove outcome families cover the whole corpus |
| Class features | passive proficiencies/modifiers plus activated class powers | direct grants for passive, capabilities for active | Directionally correct | needs full class/subclass feature classification against SRD text |
| Subclass features | same split as class features, often more active mechanics | direct grants + capabilities | Directionally correct | needs full subclass audit and canonical placement rules |
| Race and subrace features | mostly passive senses/proficiencies/modifiers with some activated powers | mostly grants, sometimes capabilities | Directionally correct | needs active-vs-passive cleanup for every race feature |
| Background features | mostly persistent permissions or narrative rules, sometimes granted proficiencies/languages | grants, sometimes constrained rule | Directionally correct | verify whether any background feature deserves a first-class capability path |
| Feats | passive bonuses plus optional activated mechanics | grants for passive, capabilities for active | Directionally correct | feat-by-feat active/passive classification still needed |
| Equipment | passive modifiers, proficiencies, carried properties, occasional activations or commands | grants for passive, capabilities for active | Directionally correct | equipment activation modeling still under-audited; containment/loadout remains its own workstream |
| Creatures | attacks, actions, traits, senses, passive defenses, possible summon targets | creature traits + capabilities where shared modeling benefits | Partially aligned | needs explicit boundary between creature-native stat-block grammar and shared capability/outcome reuse |
| Vehicles | mostly metadata/logistics today, some action-like operation semantics possible later | mostly subject metadata today, capabilities only when needed | Not yet fully audited | need to verify whether SRD vehicles require reusable capability modeling at all for baseline master data |

## Cross-Subject Consistency Checks

These are the consistency rules this audit is trying to prove.

### Temporary AC, attack, speed, and sense changes

Expected rule:

- passive permanent changes remain direct grants
- temporary spell/feature/item changes should be capabilities that apply those same typed grants for a duration

### Summon and companion-like mechanics

Expected rule:

- persistent created companions, steeds, sensors, or constructs should be manifests
- if they can be commanded later, those follow-up actions should be capabilities owned by the manifest

### Reusable activated attacks

Expected rule:

- whether the source is a spell, feat, equipment item, or creature-like construct, reusable activated attacks should use the same capability -> branch -> outcome grammar

### Passive vs temporary versions of the same benefit

Expected rule:

- permanent darkvision, flight, or modifiers live in grants
- temporary versions of those same benefits should be modeled as `APPLY_GRANT` outcomes

## Current Model Gaps to Resolve

These are the current major open questions the repo still needs to close before 7.7 can claim full master-data readiness.

### High-confidence gaps

- full record-by-record SRD mechanics classification has not yet been completed
- DB persistence and repository hydration have not yet been fully redesigned for the broader capability/branch/outcome surface

## Branch Refactor Decision

The earlier use of `moment` was a naming mistake at the authored-model layer.

What the repo actually needs is an explicit result-routing concept:

- `trigger` says what kind of resolution process is happening
- `branch` says which result path occurred
- `outcomes` say what happens on that branch

This is now the canonical Phase 7.7 direction.

Important implications:

- `moment` should not remain the long-term public authoring term
- `saveResolution` was a temporary experiment and is not part of the final intended model
- explicit branches are preferred over outcome-specific shortcuts
- this applies across:
  - spells
  - features
  - feats
  - equipment
  - creatures
  - manifests

Current truth after the first refactor slice:

- shared/schema/compiler have been renamed to `branch` terminology
- explicit branch codes such as `ON_SAVE_FAIL`, `ON_SAVE_SUCCESS`, `ON_HIT`, `ON_MISS`, and `ON_CRIT` are now the intended route for SRD mechanics
- the first save-for-half spell anchors have already been re-authored to that branch pattern
- DB persistence still needs its broader branch-based cleanup and expanded outcome support before the persistence story matches the authored/schema story completely
- legacy `effects` compatibility still exists and needs an explicit long-term verdict
- manifest linkage is not yet rich enough to call summon/zone/sensor mechanics complete

### Mechanic families still likely to require deeper work

- restoration and resurrection edge cases
- transformations and state replacement
- recurring save/trigger loops
- complex commandable manifests
- layered zone/wall behaviors
- mechanics that mix created objects with later reusable commands

### Constrained `RULE` review cluster

`RULE` should remain rare.

Every future `RULE` usage should document:

- why no existing typed outcome fits
- whether the gap is temporary or expected to remain
- whether a better typed outcome should be added later

### Current spell `RULE` audit snapshot

Current repo snapshot:

- `38` SRD spell files currently use `EFFECT_KIND.RULE`
- those `RULE` usages should no longer be treated as one undifferentiated bucket

Use these audit buckets instead:

- valid constrained `RULE`
- convertible with the current typed model
- blocked by a named model/runtime gap

#### Likely valid constrained `RULE`

These are mostly information, omen, communication, or adjudication mechanics where a richer typed outcome would currently be artificial:

- `Augury`
- `Commune`
- `Commune with Nature`
- `Contact Other Plane`
- `Divination`
- `Identify`
- `Legend Lore`
- `Sending`
- `Speak with Animals`
- `Speak with Dead`
- `Speak with Plants`
- `Tongues`

#### Convertible or partially convertible `RULE`

These should be challenged before being allowed to remain `RULE`:

- `Darkvision`
  - already moved out of `RULE` into `APPLY_GRANT`
- `Longstrider`
  - already moved out of `RULE` into `APPLY_GRANT`
- `Mage Armor`
  - likely belongs in `APPLY_GRANT`, not `RULE`
  - can likely be represented as two `ARMOR_CLASS` modifiers:
    - `SET_VALUE` to `13`
    - `BONUS` from Dexterity modifier
  - current blocker is ongoing restriction/runtime enforcement for “while not wearing armor,” not the split formula itself
- `Bless` / `Bane`
  - likely want a richer roll-surface modifier path for “add or subtract 1d4 on attack rolls and saving throws”
- `Heroism`
  - likely wants stronger ongoing temp-HP application plus frightened-protection support before it can leave `RULE` honestly

Conclusion:

- `RULE` is still an escape hatch today
- it should be treated as a shrinking audit bucket, not as an acceptable default
- every retained spell `RULE` use should be explicitly classified as:
  - valid constrained `RULE`
  - convertible with the current model
  - blocked by a named model/runtime gap

### Targeting vocabulary drift note

Targeting is not fully untyped, but there is still vocabulary drift across layers:

- shared core already defines `TARGET_SELECTION_KIND` and `TARGET_DISPOSITION_KIND`
- authored targeting already points at those shared types
- schema still hardcodes some targeting literal strings
- many spell source files still hand-author raw strings like `'SINGLE_TARGET'`

Current 7.7 rule:

- spell source data should prefer shared targeting constants over raw string literals
- targeting should be treated as shared mechanics vocabulary, not ad hoc spell-local strings

## Master-Data Readiness Pass

The whole reason for this audit is to answer whether the baseline SRD data can support first-use character creation.

Current readiness snapshot:

### Ready or largely ready in principle

- passive grant-heavy content families, where the current grant model already maps naturally
- creature/vehicle ownership baseline for roster-style use
- core spell metadata and spell inventory coverage

### Not ready to call complete yet

- full active-mechanics master data across spells, feats, equipment, and features
- summon/manifest heavy content
- any content family whose SRD mechanics are still primarily prose because the capability/outcome runtime path is incomplete

### Baseline user-experience rule

Phase 7.7 should not call the SRD baseline "complete" until a new user can:

- create a character from the SRD baseline
- choose baseline race/class/background/feat/equipment/spells
- understand passive vs active mechanics from structured data
- manage roster-like owned creatures or vehicles where SRD content permits them
- avoid running into obviously missing or misleading mechanics caused by model shortcuts

## Decisions This Audit Must Leave Unambiguous

Before Phase 7.7 closes, the repo docs and types should clearly answer:

- whether `CapabilityAuthored` is the permanent public concept
- whether legacy `effects` remain only as a temporary compatibility alias
- whether any subject roots should keep mechanic-summary fields at all
- whether `APPLY_GRANT` is the canonical temporary buff/debuff path
- whether temp HP should remain in modifier/grant space
- whether one `MANIFEST` family with subtypes is sufficient
- whether any additional typed outcome families are required for SRD completeness

## Required Follow-Through

The next 7.7 passes should use this audit as the working checklist:

1. complete the record-by-record SRD mechanics classification
2. finish the DB/runtime persistence redesign for capabilities, branches, and expanded outcomes
3. retrofit SRD source data to the corrected active/passive model
4. keep handoff docs aligned with the master-data purpose of the phase

## Handoff Notes

- do not reduce Phase 7.7 back to "seed files exist"
- do not treat spells as the only mechanic-bearing SRD family
- do not treat passive grants, capabilities, outcomes, and manifests as separate discussions; they are one master-data modeling problem
- do not claim master-data readiness until the baseline user experience is supported structurally, not just textually
- do not lose the deferred cleanup items after the current master-data push:
  - capability/effect naming cleanup after 7.7 convergence
  - engine ruleset-boundary cleanup for `engine/dnd5e2014` after 7.7 convergence
