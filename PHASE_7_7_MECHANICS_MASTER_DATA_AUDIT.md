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
- compiled spell grants now preserve authored `restrictions`, so specialization- and facet-routed spell packages survive compilation instead of being dropped before resolution

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
- only `1` race/background/feat file currently contains explicit `capabilities`:
  - `Dragonborn`
- race files already show strong alignment for passive mechanics like ability score bonuses, senses, and persistent proficiencies
- backgrounds already model persistent proficiencies better than most active mechanic-bearing families

Current race/background verdict:

- these families are directionally closer to master-data readiness than spells
- passive mechanics are often already landing in the correct grant-oriented abstraction
- active race features still need cleanup where they currently remain prose-only
- current repo-backed skew inside this family:
  - races are much farther along on structured grants than classes
  - `Dragonborn` is currently the main race-side active-capability proof
  - backgrounds remain strong on proficiencies/equipment but largely descriptive on feature semantics
- first systematic-audit follow-through already found one stale assumption and corrected it:
  - `Mountain Dwarf -> Dwarven Armor Training` was still tagged as unmodelable even though the repo now supports armor proficiency grants by category/property
  - that race feature has now been converted into a real structured proficiency grant
- remaining race/background audit examples that still need follow-through:
  - `Dwarf -> Stonecunning`
  - background feature semantics such as `Acolyte -> Shelter of the Faithful`, which are still intentionally descriptive rather than typed capabilities
- another race-side follow-through slice has now landed:
  - `Dwarf -> Tool Proficiency` is no longer prose-only
  - it now uses a real chosen equipment proficiency grant across `Brewer's Supplies`, `Mason's Tools`, and `Smith's Tools`

### Class and subclass findings

Current observed source-data counts:

- `35` class/race/background/feat files currently expose `features`
- `18` files in those families currently expose explicit `grants`
- only `2` files in those families currently expose explicit `capabilities`:
  - `Dragonborn`
  - `Fighter`
- class source files are still heavily feature-description driven

Current class/subclass verdict:

- passive class scaffolding such as spellcasting/proficiencies/progression is partly structured
- feature-level mechanics are still mostly descriptive rather than classified into grants or capabilities
- persistent subclass identity branches should now be modeled as `specializations`, not `subtypes`
- `Circle of the Land` terrain is the canonical subclass-specialization anchor, while Ranger favored terrain remains a feature-level repeated choice rather than subclass identity
- `Circle of the Land` now also proves the canonical progressive subclass-spell pattern:
  - one real `Circle Spells` feature
  - multiple specialization-restricted `SPELL_GRANT`s on that feature
  - `SCALING.PER_LEVEL` progression at later class levels
- the current class/subclass tranche is still structurally uneven:
  - passive proficiencies and some grant-driven spell packages are landing correctly
  - active feature mechanics are still sparse outside the current proof cases
  - prose regressions introduced by earlier large refactors are still worth watching for during the audit
- class and subclass features are a major remaining audit cluster after spells

Current representative class findings from the systematic audit:

- `Barbarian`
  - passive pieces like `Unarmored Defense` are partially structured
  - major active features like `Rage`, `Reckless Attack`, and `Danger Sense` remain prose-heavy
  - `Fast Movement` still points to a conditional speed-modifier gap because the current modifier surface does not cleanly express “+10 feet while you aren't wearing heavy armor”
- `Ranger`
  - spellcasting scaffolding and some fighting-style grants are structured
  - `Favored Enemy` and `Natural Explorer` remain prose-heavy despite being major class-defining mechanics
  - `Primeval Awareness`, `Hide in Plain Sight`, and `Vanish` are still descriptive feature shells rather than typed capabilities or grants
  - the current blocker is not just retrofit time:
    - `Favored Enemy` wants a stronger creature-type/language-choice and target-relative bonus model
    - `Natural Explorer` wants travel/exploration-state semantics rather than combat-only modifiers
    - `Vanish` and `Hide in Plain Sight` want clearer action-economy / hide-state support than the current grant surface exposes
- `Cleric`
  - spellcasting scaffolding is structured
  - `Channel Divinity`, `Destroy Undead`, and `Divine Intervention` are still mostly feature-description placeholders
- `Life Domain`
  - `Domain Spells` now use honest per-level prepared spell grants instead of flattening the whole package into an immediate all-spells grant
  - `Bonus Proficiency` is now a real heavy-armor proficiency grant
- `Paladin`
  - `Lay on Hands` is still blocked by pooled-healing resource semantics plus the disease-cure rider; it should not be flattened into a simple one-shot heal capability
  - `Divine Health` is still blocked by missing disease-immunity semantics
  - `Aura of Protection` and `Aura of Courage` still point to aura-radius ally-state semantics rather than plain grants
- `Oath of Devotion`
  - `Oath Spells` now use honest per-level prepared spell grants instead of flattening the whole package into an immediate all-spells grant
- `The Fiend`
  - `Expanded Spell List` is not the same mechanic as domain/oath always-prepared spells
  - it now stays descriptive in source data instead of pretending to be a `SPELL_GRANT`
  - it still points to a distinct model gap for subclass-driven spell-list expansion rather than spell grants
  - `Dark One's Blessing` still points to a trigger-model gap: `HEAL` can already represent temporary hit points, but the current invocation trigger surface does not yet expose a clean non-activated `ON_HP_ZERO` trigger for “when you reduce a hostile creature to 0 hit points”
  - `Fiendish Resilience` still points to a chosen-option modifier gap because the current chosen modifier shape does not expose a clean option list for selectable damage resistances plus short/long-rest reselection cadence
- `Warlock Invocations`
  - spell-grant-shaped invocations such as `Armor of Shadows`, `Fiendish Vigor`, `Mask of Many Faces`, and `Misty Visions` still point to a spell-access semantic gap
  - current `SPELL_GRANT` structure does not yet encode “at will, without expending a spell slot” or similar invocation-specific casting permissions honestly
- `Warlock Pact Boons`
  - `Pact of the Chain` is now partially structured: `Find Familiar` is carried as a real known ritual spell grant, while the separate familiar-manifest/runtime semantics remain their own gap
  - `Pact of the Tome` is now partially structured: the “choose three cantrips from any class's spell list” portion is a real chosen known-spell grant using the repo-derived cantrip corpus
  - the later `Book of Ancient Secrets` ritual-book expansion still points to separate ritual-book and spell-copy semantics rather than a simple spell grant
- `Race Innate Magic`
  - race features such as `Tiefling -> Infernal Legacy` and `Drow -> Drow Magic` are now at least partially structured, with their cantrip portions carried as real known-spell grants
  - current `SPELL_GRANT` structure does not yet encode “once per long rest,” “once per day,” or fixed-cast-level innate-magic permissions honestly
- `Circle of the Land`
  - now stands as the canonical specialization-driven subclass spell proof and remains structurally sound after spot review
  - `Bonus Cantrip` is now a real chosen known-spell grant using the repo-derived druid cantrip option list instead of a prose-only feature shell
  - `Land's Stride`, `Nature's Ward`, and `Nature's Sanctuary` remain blocked by terrain-state, source-creature-type, disease-immunity, and target-retargeting semantics that the current model does not yet expose cleanly
- `College of Lore`
  - `Bonus Proficiencies` is now a real chosen skill proficiency grant instead of a prose-only feature shell
  - `Additional Magical Secrets` still points to a real spell-choice constraint gap: it needs “choose spells from any class, but only of levels you can currently cast, with cantrips also allowed” rather than a flat unrestricted spell picker
- `Bard`
  - both `Expertise` features at levels 3 and 10 are now real chosen doubled-skill proficiency grants instead of prose-only feature shells
  - base `Magical Secrets` at levels 10, 14, and 18 points to the same cross-list spell-choice gap as `College of Lore`, even though the class-layer wording omits the explicit cantrip clause
- `Fighter`
  - `Fighting Style` now uses a real option-choice structure, and the `Archery`, `Defense`, and `Dueling` options are modeled as structured modifier grants instead of prose-only options
  - `Great Weapon Fighting`, `Protection`, and `Two-Weapon Fighting` still point to reroll, reaction interception, and off-hand damage semantics that are not yet cleanly expressed by the current grant/capability model
- `Champion`
  - `Additional Fighting Style` now uses a real option-choice structure mirroring fighter fighting styles, with the same safe structured `Archery`, `Defense`, and `Dueling` options carried directly on the subclass feature
  - `Remarkable Athlete` still points to conditional half-proficiency-on-nonproficient-checks semantics rather than a plain modifier or grant
- `Draconic Bloodline`
  - `Draconic Resilience` is now mostly structured: the AC-setting half and the per-sorcerer-level hit-point-maximum increase are both modeled as modifier grants
  - the remaining descriptive truth is mostly presentational flavor, not a missing mechanical grant
- `Rogue`
  - `Expertise` still points to a mixed-choice gap: the SRD allows either two skill proficiencies or one skill proficiency plus thieves' tools, which is not the same shape as bard's pure skill-only expertise chooser
  - the 6th-level `Expertise` feature is now at least structured as a real chosen doubled-skill proficiency grant, because that later feature is skill-only
  - `Slippery Mind` is now a real Wisdom saving throw proficiency grant instead of a prose-only feature shell
  - `Thieves' Cant` is now modeled as a real language proficiency grant while preserving its descriptive secret-code semantics in feature text
- `Monk`
  - `Diamond Soul` now at least structures the “proficiency in all saving throws” half as a real save proficiency grant
  - the reroll-on-failure rider still points to a roll-event interception gap rather than a grant gap
  - `Unarmored Movement` still points to a conditional movement-scaling gap because it combines level-based speed increases with armor and shield state requirements
  - `Purity of Body` still points to disease-immunity semantics and poison-immunity ambiguity that should not be flattened casually
  - `Empty Body` still points to charge-spending plus temporary invisibility and broad damage-resistance semantics rather than a simple passive modifier
- `Rock Gnome`
  - `Tinker` now at least structures the tinker's tools proficiency half as a real equipment proficiency grant
  - the clockwork-device construction clause still remains descriptive until the item-creation/runtime path is richer
- `Druid`
  - `Druidic` is now modeled as a real language proficiency grant instead of a prose-only feature shell
- `Half-Elf`
  - `Skill Versatility` was carrying a chosen skill proficiency grant without explicit skill options; that source-data drift is now corrected
- `Human`, `Half-Elf`, `High Elf`, and `Acolyte`
  - chosen language proficiency grants now carry explicit language option lists instead of relying on unstated UI assumptions
- `High Elf`
  - `Cantrip` is now a real chosen known-spell grant using the repo-derived wizard cantrip option list instead of a prose-only feature shell
- chosen-language integrity check
  - the remaining race/background `AUTHORING_SELECTION_KIND.CHOSEN` language grants now verify cleanly with explicit `languageIds`
  - the remaining `CHOSEN` cases in that audit slice are now legitimate tool/equipment/skill choices plus the separate half-elf ability-score modifier-choice gap
- `Half-Elf -> Ability Score Increase`
  - still points to a modifier-choice gap because the current chosen modifier shape does not expose the legal ability-choice set for the two `+1` increases
- `Way of the Open Hand`
  - `Wholeness of Body` is now a real limited-use activated self-heal capability instead of a prose-only feature shell
- `School of Evocation`
  - `Evocation Savant` still points to spellbook-copy cost/time modification semantics rather than a plain grant
  - `Sculpt Spells`, `Potent Cantrip`, `Empowered Evocation`, and `Overchannel` still point to spell-resolution and damage-roll rider semantics beyond the current generic grant surface
- `Thief`
  - `Fast Hands`, `Second-Story Work`, `Supreme Sneak`, `Use Magic Device`, and `Thief's Reflexes` all remain blocked by action-economy reuse, movement/jump overrides, conditional stealth advantage, magic-item requirement bypass, and extra-turn sequencing semantics respectively
- `Hunter`
  - `Steel Will` is now a real structured modifier grant using the same frightened-save-advantage pattern already proven in race features
  - sibling options such as `Colossus Slayer`, `Horde Breaker`, `Escape the Horde`, and `Multiattack Defense` remain prose because they still want stronger target-relative attack-state and per-turn retaliation semantics than the current grant surface exposes

Current representative blocked race/class feature findings from the systematic audit:

- `Dwarf -> Stonecunning`
  - still blocked because the current model does not express subject-matter-restricted expertise such as doubled proficiency on `Intelligence (History)` checks specifically about the origin of stonework
- `Halfling -> Lucky`
  - still blocked because the current model does not express roll-event interception and forced rerolls on natural `1`s across attack rolls, ability checks, and saving throws
- `Halfling -> Halfling Nimbleness`
  - still blocked because the current model does not express occupancy and pass-through movement exceptions
- `Elf -> Trance`
  - still blocked because the current model does not express sleep replacement and rest-equivalence semantics
- `Monk -> Tongue of the Sun and Moon`
  - still blocked because the current model does not express universal spoken-language comprehension and cross-language communication semantics as a clean structured grant
- `Cleric -> Channel Divinity`
  - still blocked because the current model does not yet expose a mature authored pattern for a shared class resource pool consumed by multiple later capabilities
- `Cleric -> Destroy Undead`
  - still blocked because it wants follow-through branching from `Turn Undead`, keyed to target CR threshold after a failed save
- `Cleric -> Divine Intervention`
  - still blocked because it is a percentile petition with adjudicated outcome, long cooldown, and level-20 auto-success, not a normal typed combat/state result
- `Hunter -> Colossus Slayer`
  - still blocked because it wants a once-per-turn hit rider conditioned on the target being below hit point maximum
- `Hunter -> Horde Breaker`
  - still blocked because it wants follow-up attack generation with proximity constraints relative to the original target
- `Hunter -> Escape the Horde`
  - still blocked because it wants disadvantage scoped specifically to opportunity attacks made against you
- `Hunter -> Multiattack Defense`
  - still blocked because it wants a triggered, source-specific, turn-scoped AC bonus after being hit
- `Champion -> Additional Fighting Style`
  - still blocked because it wants a reusable class-feature option-selection pattern rather than a plain feat or proficiency grant

Current representative background and feat findings from the systematic audit:

- `Acolyte`
  - proficiencies and starting equipment are structurally solid
  - `Shelter of the Faithful` still reads correctly as a descriptive social/world-state feature rather than a typed mechanical capability
- `Grappler`
  - still mixes a passive attack-advantage clause with an action-based pin rider in pure prose
  - the passive clause wants a target-relative grapple predicate the current modifier surface does not expose cleanly
  - the active clause wants contested-resolution / grapple-state follow-through beyond the current generic activated-capability surface
  - it remains a good proof that feats still need a stronger passive-versus-active classification pass after the class and equipment tranches settle

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
- current repo-backed proof is still minimal:
  - the feat tranche currently has no explicit `capabilities`
  - `Grappler` remains a useful audit example because it mixes a passive advantage clause with an action-based pin mechanic that still reads as prose

### Equipment findings

Current equipment source tree:

- equipment is rich in metadata and static properties
- equipment source constants are now normalized to shared category/property/measurement registries instead of raw string literals
- equipment authoring/persistence now round-trips `capabilities` as the preferred surface, with legacy `effects` still present only as compatibility drift in shared/schema/DB naming
- magic gear remains equipment, not a separate subject; magical upgrades such as `+1` items should be authored as `VARIANT` children of the base item with the `MAGIC` property
- earlier magic-variant drift has improved substantially:
  - sampled `+1/+2/+3` equipment variants now already include passive `modifiers` alongside `maxBonus`
  - magic-variant modifier absence no longer appears to be the broadest unresolved equipment issue in the current source tree
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
- magic variant correctness still deserves spot checks, but sampled `+1/+2/+3` variants now already include passive modifier grants alongside `maxBonus`; this is no longer the broadest unresolved equipment issue
- systematic equipment spot checks now narrow the highest-signal remaining issues:
  - the broadest remaining equipment problem is not magic variants; it is the mundane-tool / utility-item tranche still modeled as placeholder `ACTIVATED -> ON_USE -> RULE` capabilities that mostly restate "use this item according to the applicable check rules"
  - representative files:
    - `Calligrapher's Supplies`
    - `Thieves' Tools`
    - `Alchemist's Supplies`
    - `Brewer's Supplies`
    - `Disguise Kit`
    - `Poisoner's Kit`
    - `Tinderbox`
    - `Crowbar`
    - `Bell`
    - `Block and Tackle`
  - these are strong candidates for metadata-only or descriptive-item treatment unless the product explicitly wants a generic mundane-item action surface
  - first cleanup slice has now landed on that tranche:
    - broad tool records such as `Alchemist's Supplies`, `Brewer's Supplies`, `Calligrapher's Supplies`, `Cartographer's Tools`, `Carpenter's Tools`, `Cobbler's Tools`, `Cook's Utensils`, `Forgery Kit`, `Glassblower's Tools`, `Herbalism Kit`, `Jeweler's Tools`, `Leatherworker's Tools`, `Mason's Tools`, `Navigator's Tools`, `Painter's Supplies`, `Potter's Tools`, `Smith's Tools`, `Tinker's Tools`, `Weaver's Tools`, `Woodcarver's Tools`, plus `Disguise Kit`, `Poisoner's Kit`, and `Thieves' Tools`, have been flattened back to metadata-only equipment records
    - second cleanup slice removed additional descriptive utility items such as `Fishing Tackle`, `Grappling Hook`, `Hammer`, `Iron Spikes (10)`, `Ladder (10-foot)`, `Pole (10-foot)`, `Magnifying Glass`, and `Portable Ram`
    - third cleanup slice flattened simple light-source records such as `Candle`, `Lamp`, `Torch`, `Bullseye Lantern`, and `Hooded Lantern` back to metadata-only equipment
    - follow-up cleanup also removed explicit no-op miss branches from `Acid (Vial)`, `Alchemist's Fire (Flask)`, `Holy Water (Flask)`, and `Net`, and flattened `Lock` back to metadata-only gear
    - the remaining equipment `RULE` count is now down to `10`, and the residue is much more concentrated in genuinely special-use gear such as thrown substances, trap/hazard gear, healing supplies, restraints, and a few climbing/support items
    - current residue list:
      - `Alchemist's Fire (Flask)`
      - `Antitoxin (Vial)`
      - `Ball Bearings (Bag of 1,000)`
      - `Caltrops (Bag of 20)`
      - `Climber's Kit`
      - `Healer's Kit (10 uses)`
      - `Hunting Trap`
      - `Manacles`
      - `Net`
      - `Oil (Flask)`
    - current residue classification:
      - likely convertible with stronger typed support:
        - `Antitoxin (Vial)`
          - looks close to `APPLY_GRANT`, but the current `SAVING_THROW_BONUS` domain only scopes by save ability plus optional condition type
          - the repo still lacks an honest typed way to express "advantage on saving throws against poison" without approximating the rule
        - `Climber's Kit`
          - wants a more explicit movement/fall-protection or traversal-state grant if this family is ever typed more strongly
      - likely valid constrained `RULE` for now:
        - `Healer's Kit (10 uses)`
          - "stabilize without a Medicine check" is still closer to a narrow action-override rule than a clean typed outcome
        - `Manacles`
          - escape/break clauses remain a good constrained special-case rule until equipment-applied restraint states are richer
      - blocked by stronger trap/zone/runtime support:
        - `Ball Bearings (Bag of 1,000)`
        - `Caltrops (Bag of 20)`
        - `Hunting Trap`
        - `Oil (Flask)`
          - these all want better hazard/zone/persistent-area semantics than the current equipment surface exposes
      - correctly still mechanic-bearing:
        - `Net`
          - remains a legitimate structured attack item with a mixed `CONDITION` plus special rider rule
        - `Alchemist's Fire (Flask)`
          - remains a legitimate attack item, but the recurring burn/extinguish rider still needs richer ongoing-effect handling
  - the second strongest equipment gap is bundle/container drift:
    - pack records already use `contains`
    - several filled-container or bundle-style ammo/deployment records still do not
    - representative files:
      - `Arrows (20)`
      - `Crossbow Bolts (20)`
      - `Blowgun Needles (50)`
      - `Sling Bullets (20)`
      - `Ball Bearings (Bag of 1,000)`
      - `Caltrops (Bag of 20)`
  - current good news from the same audit:
    - sampled `+1/+2/+3` variants such as `Pike +1`, `Plate Armor +1`, and `Arrows +1` now already include real passive modifiers alongside `maxBonus`
    - magic-variant modifier absence no longer appears to be the top unresolved equipment issue in the current source tree

Important implementation fact:

- the current SRD equipment tree still skews heavily toward metadata-driven records
- active equipment mechanics are now represented as capabilities in the first anchor slice instead of being entirely absent from source data
- this means the equipment audit is no longer only a boundary-definition task; it is now an active retrofit workstream with passive/state and area-hazard gaps still open

### Creature findings

Current creature source tree:

- creature stat blocks are present and useful for baseline reference/master records
- current creature files are still mostly stat-block shaped rather than capability/outcome shaped
- reusable creature actions and traits should converge on the shared feature/capability model, with stat-block sections treated as presentation grouping rather than a second mechanic system
- creature SRD files now use shared constants for record-kind/category/size and movement units, reducing literal drift across the creature corpus
- the creature source tree is no longer the earlier `22`-record subset; it now covers the full local-SRD creature roster:
  - `201` main `Monsters A-Z`
  - `89` Appendix `MM-A` miscellaneous creatures
  - `21` Appendix `MM-B` NPC stat blocks
  - `311` total creature master records
- current creature master records still do not have a direct default-equipment/loadout field; creature equipment remains modeled at character-owned roster assignment time, not on the creature master record itself

Current creature verdict:

- creature master records are useful and necessary for baseline play-state and roster ownership
- creature action arrays are now treated as a temporary structural inconsistency relative to the shared capability/outcome model
- the full SRD creature roster now exists in source data, including legendary-profile cases from the main monster set
- the current creature import is still partly stat-block-first in source data, but the corrected direction is now explicit: traits, actions, bonus actions, reactions, legendary actions, and lair actions should converge on feature-owned capabilities, with action grouping derived from the capability layer rather than generic feature metadata
- creature proficiency authoring is now converging on the same canonical grant model used elsewhere:
  - plain creature skills use proficiency grants
  - plain creature save proficiencies use proficiency grants
  - plain fixed creature languages use proficiency grants
  - creature-only authored fields such as `skillProficiencies`, `savingThrowProficiencies`, and root `languages` are no longer the target contract
  - qualified communication semantics remain feature-driven instead of inventing a second creature-only language model
  - examples that stay feature-driven:
    - `Telepathy 120 ft.`
    - `understands Common but can't speak`
    - `any two languages`
    - `the languages it knew in life`
  - when a qualified communication feature still implies real language knowledge, the feature should also own the matching language proficiency grant
  - fixed creature languages missing from the earlier seed vocabulary have been added so creature language grants stay id-based instead of falling back to prose
- the earlier broad corruption tail from the generated creature tranche has now been materially cleaned up:
  - truncated language/telepathy fields were repaired
  - merged weakness/features were split back into distinct entries
  - lore prose accidentally appended to mechanical actions was removed
  - malformed spellcasting punctuation was normalized
  - broad generated spacing/article artifacts were corrected across the remaining stat-block text
- focused verification remains green on:
  - `packages/db/src/__tests__/creature-repository.test.ts`
  - `packages/db/src/__tests__/srd-manifest.test.ts`
  - `packages/db/src/__tests__/facet-owner-roundtrip.test.ts`
- current repo scan status for legacy creature action surfaces:
  - `0` files in `packages/db/src/source-data/srd/creatures` still expose root `actions`, `reactions`, `bonusActions`, or `legendaryProfile` arrays as canonical authored mechanics
  - creature active mechanics are now authored through feature-owned capabilities across the converted SRD creature corpus
- current creature constrained-`RULE` footprint after action-surface convergence:
  - creature `RULE` is now at a confirmed floor of `119` constrained occurrences
  - remaining creature residue is blocker-driven rather than structural conversion debt
  - this is now the primary creature follow-through surface (semantic gap reduction), not structural action-array cleanup
- the creature capability-first proof set is now materially broader than the initial anchor slice:
  - baseline action/reaction anchors:
    - `Medusa`
    - `Knight`
    - `Bandit Captain`
    - `Aboleth`
    - `Gladiator`
    - `Erinyes`
  - dragon-family anchors:
    - all adult dragons
    - all ancient dragons
    - all young dragons
    - all dragon wyrmlings
  - legendary/control anchors:
    - `Androsphinx`
    - `Gynosphinx`
    - `Kraken`
    - `Unicorn`
    - `Lich`
    - `Vampire`
    - `Mummy Lord`
    - `Planetar`
    - `Solar`
    - `Tarrasque`
  - fiend/construct/elemental anchors:
    - `Balor`
    - `Marilith`
    - `Pit Fiend`
    - devil family anchors through `Ice Devil`
    - elemental family anchors through `Water Elemental`
    - golem/guardian anchors through `Shield Guardian`
  - NPC/caster anchors:
    - `Archmage`
    - `Mage`
    - `Priest`
    - `Acolyte`
    - `Cult Fanatic`
    - `Druid`
    - `Assassin`
    - `Scout`
    - `Spy`
    - `Thug`
    - `Veteran`
  - undead/control anchors:
    - `Ghast`
    - `Ghoul`
    - `Ghost`
    - `Specter`
    - `Wight`
    - `Wraith`

Important implementation fact:

- creature files are now materially converging on reusable action structures instead of only carrying native stat-block arrays
- the creature audit has therefore shifted from "should we unify creatures at all" to "which remaining creature mechanics still need richer shared semantics before they can leave constrained `RULE`"
- first representative post-conversion spot checks are directionally good:
  - plain cases like `Medusa` and `White Dragon Wyrmling` read naturally with root proficiency grants
  - qualified communication cases like `Pegasus`, `Dretch`, and `Aboleth` keep the caveat in feature text while exposing real underlying language knowledge where appropriate
  - dynamic placeholder cases like `Zombie`, `Skeleton`, `Mummy`, and `Ghost` stay feature-driven instead of pretending "languages from life" is fixed vocabulary
  - the remaining cleanup here is contextual polish on some generated feature labels such as `Language Knowledge` / `Language Limitation`, not a structural model gap
- current recurring creature gap buckets are now clearer and repeat across many files:
  - death-trigger and aura-tick semantics:
    - `Balor -> Death Throes`
    - `Balor -> Fire Aura`
    - `Fire Elemental -> Fire Form`
  - grapple/swallow/ingestion loops:
    - `Kraken -> Bite` / `Swallow`
    - `Tarrasque -> Swallow`
    - `Water Elemental -> Whelm`
  - life-drain / hit-point-maximum reduction / undead-creation semantics:
    - `Specter`
    - `Wight`
    - `Wraith`
    - `Vampire`
  - fear/paralysis and repeat-save control riders:
    - `Lich -> Frightening Gaze`
    - `Ghast` / `Ghoul` paralysis
    - dragon control breaths like sleep / weakening / slowing / repulsion / paralyzing
  - wall, zone, and persistent object/control semantics:
    - `Ice Devil -> Wall of Ice`
    - `Chain Devil` animated chains
    - `Solar -> Flying Sword`
  - stored-spell / summon / companion-style semantics:
    - `Shield Guardian -> Spell Storing`
    - `Vampire -> Children of the Night`
  - transformation / replacement semantics:
    - dragon `Change Shape`
  - mixed attack packages and spell-amplified attack riders:
    - `Druid -> Quarterstaff` with `shillelagh`
    - `Priest -> Divine Eminence`
    - some NPC `Multiattack` bundles that are still partly descriptive

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

### 4. Creature actions should converge on features and capabilities

The corrected 7.7 direction is now explicit:

- preserve stat-block readability and section grouping
- stop defending a separate creature-only active-mechanics system
- treat section labels such as `Traits`, `Actions`, `Reactions`, and `Legendary Actions` as presentation concerns, not as a second mechanic surface or a generic feature property

Current repo truth:

- many creature records still use native `actions`, `bonusActions`, `reactions`, and `legendaryProfile.actions`
- creature traits already live in `features`
- representative source-data follow-through has started on `Medusa` and `Aboleth`, where action rows now live as feature-owned capabilities instead of the creature `actions` array, with descriptive action text using constrained `RULE` where full structure still is not worth faking
- `Aboleth` now also proves the same direction for legendary-action presentation: a feature-owned limited-use shell with legendary action capabilities is structurally cleaner than the old `legendaryProfile.actions` array
- `Knight` now extends that proof to reaction-style creature mechanics by moving `Parry` onto a feature-owned reaction capability and treating `Leadership` as a limited-use activated capability instead of a standalone action row
- `Adult Black Dragon` now extends that proof into the dragon stat-block family by moving `Legendary Resistance`, core attacks, a recharge breath weapon, and legendary actions onto feature-owned mechanics instead of `actions` plus `legendaryProfile`
- `Adult Blue Dragon` and `Adult Brass Dragon` now extend that same proof across more dragon-family variants, including single-breath and multi-breath action sets
- `Gladiator` now extends the NPC-side proof with another mixed attack/reaction stat block, including a melee-or-ranged attack shell and a reaction capability
- the adult-dragon proof set now extends across `Adult Black Dragon`, `Adult Blue Dragon`, `Adult Brass Dragon`, `Adult Bronze Dragon`, `Adult Copper Dragon`, and `Adult Gold Dragon`, covering:
  - legendary resistance as limited-use feature state
  - structured breath-weapon damage where the model clearly fits
  - constrained `RULE` breath riders where the model still should not be faked
  - `Change Shape` and `Frightful Presence` as feature-owned descriptive capabilities
  - legendary action pools as feature-owned limited-use shells
- `Erinyes` now extends the NPC/fiend proof set with feature-owned weapon capabilities, poison rider sequencing, and a reaction capability instead of separate creature `actions` and `reactions` arrays

Legendary mechanics follow the same rule:

- `Legendary Resistance` should converge on a feature with charges and reset semantics
- `Legendary Actions` should converge on feature-owned capabilities backed by a legendary-action resource/pool

This is no longer an open design question. It is now a consistency correction to be finished.

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
| Creature action/capability consistency | Medium | Low | In progress |

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
  - continue the creature feature/capability convergence and record any true residual creature-only presentation metadata still needed after that conversion
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
- spell-grant attributes still do not explicitly encode "does not count against prepared limit" as a separate structured flag; `PREPARED` currently carries the always-prepared side, but the preparation-cap exclusion semantics still need a dedicated follow-through decision

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
- the shared engine now resolves class/subclass spell grants into `spellState`, and the separate lifecycle/build-state snapshot path now threads selected subclass specialization through `GAIN_CLASS_LEVEL` commands, `CharacterBuildState`, and `snapshotBuilder`; the honest remaining caveat is tooling-related rather than model-related, because `packages/schema` rebuilds are still blocked by the pre-existing `equipment.ts` serialization issue and the checked-in dist had to be synchronized directly for this tranche
- current source-data inventory snapshot for the main 7.7 audit buckets:
  - spells: `324`
  - equipment: `357`
  - creatures: `311`
  - classes/subclasses source files: `24`
  - races/subraces source files: `17`
  - backgrounds: `1`
  - feats: `1`
  - vehicles: `11`

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

### Tranche 1 cross-domain `RULE` snapshot (creatures + equipment now)

Current repo scan snapshot for the active semantic-gap reduction tranche:

- creatures:
  - `119` constrained `RULE` occurrences (floor — all blocked)
- equipment:
  - `10` constrained `RULE` occurrences (all in special-use gear)
- spells:
  - `215` constrained `RULE` occurrences across `214` files
  - scheduled as the next focused tranche, not part of current creature/equipment execution lane
- classes/races/backgrounds/feats:
  - `0` constrained `RULE` occurrences in current source scan

The live blocked-gap ledger for this tranche is now tracked in:

- [`PHASE_7_7_RULE_GAP_LEDGER.md`](c:/Users/pilan/Desktop/artificer-toolkit/PHASE_7_7_RULE_GAP_LEDGER.md)

Ledger policy in this tranche:

- convert only when semantics are fully representable
- keep constrained `RULE` when conversion would hide real mechanics gaps
- always log the minimum model/runtime addition needed to replace the remaining `RULE` honestly

### Damage save-success normalization

- convergence direction now applied:
  - keep explicit `ON_SAVE_FAIL` and `ON_SAVE_SUCCESS` branches
  - normalize half-damage semantics to generic damage `multiplier: 0.5`
  - remove ad hoc `saveSuccess` usage from source data
- rationale:
  - avoids save-only shortcut fields
  - keeps damage math in one outcome primitive
  - reduces authored/runtime drift

Latest direct conversion examples in this tranche:

- `Iron Golem -> Poison Breath` now uses typed `DAMAGE` branches (`ON_SAVE_FAIL` / `ON_SAVE_SUCCESS` with success-side `multiplier: 0.5`) instead of duplicated `RULE` damage text
- `Behir -> Lightning Breath` now uses a proper `SAVING_THROW` invocation and typed save-gated `DAMAGE` branches instead of a single `ON_USE -> RULE` block
- `Magma Mephit -> Fire Claws` now uses a typed secondary fire `DAMAGE` rider (`1d4`) instead of a plain `RULE` damage sentence
- `Ankheg -> Acid Spray` now uses a typed `SAVING_THROW` invocation and save-gated `DAMAGE` branches instead of a `RULE` save/damage sentence
- `Kraken -> Lightning Storm` now uses a typed `SAVING_THROW` invocation and save-gated `DAMAGE` branches instead of a `RULE` save/damage sentence
- mixed attack-form cleanup is now landing where mechanics are fully representable:
  - `Archmage`, `Mage`, `Cult Fanatic`, and `Bandit Captain` dagger rows now use explicit melee/ranged attack capabilities with typed hit damage
  - `Bugbear`, `Lizardfolk`, and `Ogre` javelin rows now use explicit melee/ranged attack capabilities with typed hit damage
  - `Orc -> Javelin` now uses explicit melee/ranged attack capabilities with typed hit damage

### Current spell `RULE` audit snapshot

Current repo snapshot:

- `214` SRD spell files currently use `EFFECT_KIND.RULE` (`215` total occurrences)
- those `RULE` usages should no longer be treated as one undifferentiated bucket
- the large count confirms that spell inventory conversion is complete, but typed-outcome convergence is not
- the current spell `RULE` bucket includes a mix of:
  - valid constrained information/adjudication mechanics
  - likely-structured buffs/debuffs still waiting on richer grant/modifier support
  - manifest-like or recurring-command spells whose authored source shape is ahead of the current runtime/persistence semantics

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
- `Detect Magic`
- `Find Traps`
- `True Seeing`
- `Wish`

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
- `Aid`
  - likely wants a better max-hit-point-plus-current-hit-point typed grant path
- `Bless` / `Bane`
  - want richer roll-surface modifier support for attack-roll and saving-throw dice adjustments
- `Shield`
  - mostly wants `APPLY_GRANT` plus a separate resolution for the `Magic Missile` clause
- `Spiritual Weapon`
  - directionally wants richer `MANIFEST` plus commandable follow-up capability support rather than a flat `RULE`
- `Mage Hand` / `Unseen Servant` / `Find Familiar`
  - prove the manifest family direction, but the remaining command/control semantics still need richer follow-through before the whole family can be considered fully typed

Conclusion:

- `RULE` is still an escape hatch today
- it should be treated as a shrinking audit bucket, not as an acceptable default
- every retained spell `RULE` use should be explicitly classified as:
  - valid constrained `RULE`
  - convertible with the current model
  - blocked by a named model/runtime gap
- the immediate spell audit follow-through should prioritize the highest-leverage convertible families rather than attempting to eliminate all `RULE` uses at once:
  - AC-setting / passive-protection buffs
  - attack-roll and saving-throw roll-surface modifiers
  - recurring temp-HP / immunity bundles
  - commandable or reusable manifests

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

## 2026-03-24 Mechanics Delta

- Damage success semantics are now standardized:
  - no SRD source records should use `saveSuccess`
  - use explicit `ON_SAVE_SUCCESS` damage branches with `multiplier: 0.5`
- Cross-domain reduction status remains:
  - creatures: `119 RULE` (floor confirmed)
  - equipment: `10 RULE`
  - spells: `215 RULE` (`214` files)
- Tranche sequencing remains unchanged:
  - active: creature + equipment conservative semantic reduction
  - next: focused spell `RULE` classification/conversion tranche
- Strict-shape reminder for conversion work:
  - do not attach ad hoc `label`/`description` on branch payloads; keep descriptive semantics at feature/capability/invocation layers.

## Handoff Notes

- do not reduce Phase 7.7 back to "seed files exist"
- do not treat spells as the only mechanic-bearing SRD family
- do not treat passive grants, capabilities, outcomes, and manifests as separate discussions; they are one master-data modeling problem
- do not claim master-data readiness until the baseline user experience is supported structurally, not just textually
- do not lose the deferred cleanup items after the current master-data push:
  - capability/effect naming cleanup after 7.7 convergence
  - engine ruleset-boundary cleanup for `engine/dnd5e2014` after 7.7 convergence
