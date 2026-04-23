# Phase 7.7 RULE Gap Ledger

## Status: Deferred follow-on backlog (post-7.7)

## Purpose

This ledger tracks constrained `EFFECT_KIND.RULE` usages that remain after Tranche 1 semantic-gap reduction work.  
Each entry records whether the gap is still intentionally blocked and what minimum model/runtime addition would be needed to replace it honestly.

## Current Scope

- Phase 7.7 close decision: this ledger is now a deferred backlog for post-7.7 runtime-depth work, not an active phase gate.

- Domains in active pass: `creatures`, `equipment` (floor confirmed — moving to spells)
- Conservative exactness policy: only remove `RULE` when semantics are fully representable
- Active tranche: spell `RULE` audit (215 entries across 214 files)
- Snapshot counts (current): `creatures: 119`, `equipment: 10`, `spells: 215`
- Full creature blocker catalog: [`CREATURE_RULE_BLOCKERS.md`](./CREATURE_RULE_BLOCKERS.md)

## Latest Reduction Snapshot

- Creature `RULE` count reduced from `364` to `138` in the prior pass.
- Creature `RULE` count reduced from `138` to `134` in pass 2 (2026-03-24).
- Creature `RULE` count reduced from `134` to `123` in pass 3 (2026-03-24).
- Creature `RULE` count reduced from `123` to `122` in pass 4 (2026-03-24).
- Creature `RULE` count reduced from `122` to `119` in pass 5 (2026-03-24) via `BRANCH_GROUP_TYPE.CHOICE` pattern.
- Spell `RULE` count reduced from `274` to `255` in pass 6 (2026-03-24) via strict save-success no-op removal and save-fail condition conversion.
- Spell `RULE` count reduced from `255` to `243` in pass 7 (2026-03-24) via additional strict save-success no-op removal.
- Spell `RULE` count reduced from `243` to `232` in pass 8 (2026-03-24) via additional strict save-success no-op removal.
- Spell `RULE` count reduced from `232` to `225` in pass 9 (2026-03-24) via strict no-op `ON_MISS` RULE removal.
- Spell `RULE` count reduced from `225` to `221` in pass 10 (2026-03-24) via typed save-damage conversion in `flame-strike` and partial typed conversion in `sunburst`.
- Spell `RULE` count reduced from `221` to `219` in pass 11 (2026-03-24) via strict no-op `ON_MISS` RULE removal (`arcane-sword`, `eldritch-blast`).
- Spell `RULE` count reduced from `219` to `218` in pass 12 (2026-03-24) via typed prone condition conversion in `grease`.
- Spell `RULE` count reduced from `218` to `217` in pass 13 (2026-03-24) via typed invisible condition conversion in `greater-invisibility`.
- Spell `RULE` count reduced from `217` to `215` in pass 14 (2026-03-24) via typed rider-grant conversions in `shocking-grasp` (reaction lock) and `ray-of-frost` (speed penalty).
- Remaining `Multiattack` wrapper `RULE` entries: `0` (cleared).
- Focused validation currently green:
  - `packages/db/src/__tests__/creature-repository.test.ts`
  - `packages/db/src/__tests__/srd-manifest.test.ts`

## Handoff Snapshot (2026-03-24, pass 14 — spell tranche active)

- Current measured counts:
  - `creatures: 119 RULE occurrences` (floor — all remaining blocked)
  - `equipment: 10 RULE occurrences across 10 files` (floor — all remaining blocked)
  - `spells: 215 RULE occurrences across 214 files` (next active tranche)
- Pass 5 conversions (2026-03-24, CHOICE pattern discovery):
  - `oni` Glaive: `ON_HIT RULE` → two `ON_HIT CHOICE DAMAGE(SLASHING)` branches (Large 2d10+STR, Small/Medium 1d10+STR)
  - `drider` Longsword Two-Handed: `ON_HIT RULE` → `CHOICE` pair (1d8+3 one-handed, 1d10+3 two-handed)
  - `erinyes` Longsword (full RULE collapse): rebuilt as proper `MELEE_WEAPON_ATTACK` invocation with `CHOICE` pair + sequential poison DAMAGE
- Pass 5 type cleanup:
  - Removed `label` and `description` from non-RULE branches across 91 creature files (145 TS errors cleared)
  - These fields are only valid on `RuleAuthored`; `DamageAuthored` and `ConditionAuthored` do not carry them
  - Pre-existing `label`/`description` on `djinni` CHOICE branches also cleaned up
  - `BranchAuthoredBase` remains clean — `label`/`description` NOT added (they belong on outcome types only, and only RULE needs them)
- Pass 5 blocker catalog:
  - Full creature blocker reference written to [`CREATURE_RULE_BLOCKERS.md`](./CREATURE_RULE_BLOCKERS.md)
  - 30 named blocker families with minimum model additions documented
  - Highest-leverage primitives: `FORCED_MOVEMENT`, `HP_MAX_REDUCTION`, containment state machine, `ONGOING_DAMAGE`, nested rider branch
- Batch conversions landed in pass 3 (11 total):
  - `bone-devil` Sting: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 min)`
  - `erinyes` Longbow Poison: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED)` (no duration — "until lesser restoration")
  - `dragon-turtle` Tail Slam: `ON_HIT RULE` → `ON_HIT CONDITION(PRONE)`, push-10ft caveat retained in description
  - `couatl` Poison Bite: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 24 hr)`, UNCONSCIOUS linked-condition retained in description
  - `cockatrice` Petrifying Bite: `ON_HIT RULE` → `ON_HIT CONDITION(RESTRAINED)`, PETRIFIED two-stage escalation retained in description
  - `pseudodragon` Poison Sting: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 hr)`, UNCONSCIOUS two-threshold escalation retained in description
  - `cloaker` Moan: `ON_USE RULE` → `SAVING_THROW(WIS) + ON_SAVE_FAIL CONDITION(FRIGHTENED, 1 round)`, 24hr immunity caveat retained in description
  - `giant-wasp` Sting Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 3d6, multiplier: 0.5)`, paralyzed-at-0-HP caveat retained in description
  - `phase-spider` Bite Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 4d8, multiplier: 0.5)`, paralyzed-at-0-HP caveat retained in description
  - `giant-spider` Bite Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 2d8, multiplier: 0.5)`, paralyzed-at-0-HP caveat retained in description
  - `giant-wolf-spider` Bite Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 2d6, multiplier: 0.5)`, paralyzed-at-0-HP caveat retained in description
- Creature RULE floor assessment: all remaining 119 entries are confirmed BLOCKED by named gaps after exhaustive survey of all files. No further creature conversions are representable without new model primitives.

### Next Actions For Successor

1. **Spell RULE tranche** — current active baseline is 215 entries across 214 files after strict no-approximation conversions. Continue pattern-driven reductions and update this ledger in the same change.
2. Add `conditionTypeId` and `DURATION_KIND` to `creatures/shared.ts` so creature files use one import source instead of cross-domain `equipment/shared.js` (deferred cleanup, low priority).
3. Creature floor is confirmed at 119 entries — do not attempt further creature conversions without first adding a named primitive from [`CREATURE_RULE_BLOCKERS.md`](./CREATURE_RULE_BLOCKERS.md).

### Current Creature Residue Concentration (top labels)

- `Change Shape` (`11`) — `couatl` now BLOCKED only for Change Shape (Poison Bite converted)
- `Parry` (`6`) - reactive single-attack AC semantics
- `Swallow` (`5`) - containment + ongoing damage + escape pipelines
- `Weakening Breath` (`4`)
- `Slowing Breath` (`4`)
- `Life Drain` (`3`)
- `Repulsion Breath` (`3`)
- `Poison` complex riders (`3`) — `giant-centipede`, `homunculus`, `quasit` (spider family converted via `multiplier: 0.5`)

### Damage semantics convergence note

- generic damage `multiplier` is now wired in shared/schema/compiler contracts for damage outcomes.
- half-on-save migration is now applied in creature source data: `saveSuccess: 'HALF'` hints were replaced with `multiplier: 0.5` on explicit `ON_SAVE_SUCCESS` damage branches.
- `multiplier: 0.5` pattern on `ON_HIT DAMAGE` now used for spider family: when the secondary poison rider has save-fail/save-success-half semantics, the `multiplier: 0.5` field converts the RULE to typed DAMAGE with save caveats in description.

### Current Creature Blocker Clusters (file-level)

- `Change Shape` (11): `adult-gold-dragon`, `adult-bronze-dragon`, `ancient-gold-dragon`, `adult-silver-dragon`, `ancient-bronze-dragon`, `ancient-copper-dragon`, `ancient-silver-dragon`, `ancient-brass-dragon`, `couatl`, `deva`, `night-hag`, `oni`
- `Parry` (6): `bandit-captain`, `erinyes`, `gladiator`, `knight`, `marilith`, `noble`
- `Swallow` pipelines (5): `giant-toad`, `giant-frog`, `purple-worm`, `remorhaz`, `tarrasque`
- `Weakening Breath` (4): `adult-gold-dragon`, `ancient-gold-dragon`, `gold-dragon-wyrmling`, `young-gold-dragon`
- `Slowing Breath` (4): `adult-copper-dragon`, `ancient-copper-dragon`, `copper-dragon-wyrmling`, `young-copper-dragon`
- `Life Drain` (3): `specter`, `wraith`, `wight`
- `Repulsion Breath` (3): `ancient-bronze-dragon`, `adult-bronze-dragon`, `bronze-dragon-wyrmling`
- `Poison` complex riders (3): `giant-centipede` (save-fail-only damage with no half + paralyzed-at-0-HP), `homunculus` (two-threshold duration + UNCONSCIOUS), `quasit` (nested save-gated damage+condition inside ON_HIT)

## Equipment Residue (10)

| domain | entity id | rule text summary | why not representable today | minimum addition needed |
| --- | --- | --- | --- | --- |
| equipment | `equipId(120)` (`alchemists-fire-flask`) | Ongoing fire damage until extinguished with action+check | Ongoing repeating rider + explicit extinguish check/action flow is not modeled as typed branch lifecycle | Persistent ongoing-damage rider with action/check-based cancellation |
| equipment | `equipId(121)` (`antitoxin-vial`) | Advantage on poison saves for 1 hour | Needs scoped conditional advantage (`save vs poison`) with timed expiration | Restriction-capable timed modifier grants for save-context filtering |
| equipment | `equipId(122)` (`ball-bearings-bag-of-1000`) | Area hazard; save or fall prone and speed penalty | Trap/hazard zone lifecycle and movement-interaction checks not fully typed | Persistent hazard/zone runtime with movement-trigger checks |
| equipment | `equipId(128)` (`caltrops-bag-of-20`) | Area hazard with speed reduction and stop condition | Hazard persistence + trigger+recovery semantics not fully typed | Persistent hazard/zone runtime and conditional speed-state rider |
| equipment | `equipId(131)` (`climbers-kit`) | Anchoring prevents fall in specific situations | Environmental anchoring / fall interception logic is not modeled as typed engine primitive | Fall/anchor interception primitive with context-aware triggering |
| equipment | `equipId(140)` (`healers-kit-10-uses`) | Stabilize dying creature without medicine check | Stabilize/death-save state transition path is not modeled as typed outcome | Typed stabilization outcome and dying-state transition support |
| equipment | `equipId(147)` (`hunting-trap`) | Trap damage + restrained + escape/break checks | Combined trap lifecycle, restrained + escape/break interaction not fully typed | Trap object runtime with escape/break interaction model |
| equipment | `equipId(148)` (`manacles`) | Restrain with lock and DC to escape/break | Item-imposed restraint with lock/escape/break object-state semantics not fully typed | Object-bound restraint model with lock state and break/escape checks |
| equipment | `equipId(37)` (`net`) | Restrained plus action/check or slashing-damage to free | Secondary release paths and object damage interaction not fully typed | Multi-path release semantics for imposed restraint objects |
| equipment | `equipId(157)` (`oil-flask`) | Spill zone + ignition interaction | Surface hazard + ignition conversion lifecycle not fully typed | Surface effect runtime with ignition transform semantics |

## Creature Residue Families (Primary)

| domain | entity id | rule text summary | why not representable today | minimum addition needed |
| --- | --- | --- | --- | --- |
| creatures | `CREATURE_IDS.WOLF` family (`knock prone` riders across beasts/NPCs) | On-hit rider forces saving throw and applies prone on fail | Current model lacks clean hit-follow-up save rider chain in one typed path | Hit-follow-up save rider primitive (attack-hit then conditional save branch) |
| creatures | `CREATURE_IDS.ASSASSIN` / `CREATURE_IDS.GUARDIAN_NAGA` / `CREATURE_IDS.SPIRIT_NAGA` family | On-hit poison rider forces save for additional poison damage | Current model cannot express nested save-gated rider resolution inside `ON_HIT` attack flow without fallback RULE | Nested rider branch primitive for post-hit save resolution (attack-hit then save-gated sub-outcome) |
| creatures | `CREATURE_IDS` mixed-attack residue (remaining two-handed/form/conditional outliers) | Some attack rows still combine mode-specific damage alternatives inside one natural-language attack line | Current capability shape does not cleanly encode all mode-specific payload variants inside one attack profile | Mode-select attack profile support (one-handed/two-handed/form/size conditional payload variants) |
| creatures | `CREATURE_IDS.GIANT_CROCODILE` family | Grapple/swallow/escape DC pipelines | Nested containment + ongoing damage + escape checks not fully typed | Grapple/swallow containment state machine with escape checks |
| creatures | `CREATURE_IDS.SHADOW` / `CREATURE_IDS.WRAITH` family | Max HP reduction and restoration caveats | Permanent/long-lived max-HP reduction lifecycle not modeled as typed effect | Max-HP reduction state with rest/dispel restoration hooks |
| creatures | `CREATURE_IDS.WEREWOLF` family | Lycanthropy infection/transmission riders | Disease/curse infection and downstream transformation semantics not typed | Infection/transformation pipeline with cure/removal semantics |
| creatures | `CREATURE_IDS.ABOLETH` / telepathic families | Long-form charm, telepathy, and remote influence riders | Persistent cross-actor control/charm contracts exceed current typed condition granularity | Rich control/link state model with scoped command constraints |
| creatures | `CREATURE_IDS.ANDROSPHINX` family | Multi-stage roar and per-use escalating effects | Per-resource-use stage progression is not modeled as typed branch progression | Resource-stage progression model keyed by per-rest use count |
| creatures | `CREATURE_IDS.ORC` (`Aggressive`) | Bonus-action move up to speed toward visible hostile creature | No typed MOVEMENT outcome; movement grants require separate runtime primitive | MOVEMENT outcome type with direction/distance semantics |
| creatures | `CREATURE_IDS.GNOLL` (`Rampage`) | On-kill trigger: bonus action move half speed + bite attack | No kill-trigger event in current capability invocation model | KILL_TRIGGER invocation kind for post-kill reactive bonus actions |
| creatures | `CREATURE_IDS.WARHORSE` (`Trampling Charge`) | Move 20+ ft toward target, hit with hooves → save or prone + bonus attack if prone | Multi-precondition trigger (movement distance + hit + save + followup attack chain) not typeable as single invocation | Conditional-precondition invocation with chained followup attack |
| creatures | `CREATURE_IDS.WEREBEAR` / `CREATURE_IDS.WEREBOAR` (`Lycanthropy`) | Disease/curse transmission on hit, with cure and transformation consequences | Disease infection pipeline and downstream transformation state not modeled | Infection/transformation state with cure/remove/progression semantics |
| creatures | `CREATURE_IDS.SHADOW` (`Strength Drain`) | On-hit Strength score reduction; target dies if STR reaches 0; shadow spawns from corpse | Ability score reduction as typed outcome not modeled | Ability-score reduction outcome with death-at-zero + spawn-on-death hooks |
| creatures | `CREATURE_IDS.DROW` (`Poisoned Bolt` UNCONSCIOUS escalation) | Fails-by-5+ threshold triggers second condition (UNCONSCIOUS) on top of POISONED | Two-threshold escalation (primary condition + escalated condition if margin ≥ 5) not expressible in current branch model | Two-threshold branch variant with margin-gated secondary outcome |
| creatures | `CREATURE_IDS.SPRITE` (`Poisoned Arrow` UNCONSCIOUS escalation) | Same two-threshold pattern: save result ≤ 5 also triggers UNCONSCIOUS | Same as drow escalation blocker | Same as drow |

## Tranche 1 Notes

- This ledger intentionally tracks true blocked gaps rather than forcing approximate conversions.
- During this tranche, classes/races remain out of active remediation unless regressions are detected.
- Spell `RULE` classification remains the next tranche so this ledger can stay focused on creature/equipment convergence first.

## Deferred TODO: Temporary APPLY_GRANT Lifecycle

- Phase priority decision: do not block Phase 8 (character builder + sheet) on combat/event lifecycle semantics.
- Deferred model note for post-Phase-8 interactive runtime:
  - Add optional APPLY_GRANT-local lifecycle metadata, separate from existing `Duration.durationKind`.
  - Pseudo-shape (not implemented):
    - `lifetime.mode: 'PERMANENT' | 'TEMPORARY'`
    - `lifetime.lastsUntil: 'NEXT_ATTACK' | 'END_OF_ROUND' | 'START_OF_NEXT_TURN' | 'END_OF_NEXT_TURN' | 'NEXT_SAVE'`
- Runtime implications (deferred):
  - Event hooks for consuming one-shot grants
  - Turn-boundary expiry processing
  - Snapshot/state reconciliation for expired temporary grants

## Tranche 1 Converted Anchors (so far)

- `Iron Golem -> Poison Breath`:
  - converted from duplicated `RULE` save text into typed `DAMAGE` fail/success branches with success-side `multiplier: 0.5`
- `Behir -> Lightning Breath`:
  - converted from `ON_USE -> RULE` text into `SAVING_THROW` invocation plus typed `DAMAGE` fail/success branches
- `Magma Mephit -> Fire Claws`:
  - converted from a plain `RULE` damage sentence into a typed secondary fire `DAMAGE` rider (`1d4`)
- `Ice Mephit -> Frost Breath`:
  - converted from `ON_USE -> RULE` save/damage text into a typed `SAVING_THROW` invocation plus `DAMAGE` fail/success branches
- `Ankheg -> Acid Spray`:
  - converted from a `RULE` save/damage row into typed `SAVING_THROW` + `DAMAGE` fail/success branches
- `Kraken -> Lightning Storm`:
  - converted from a `RULE` save/damage row into typed `SAVING_THROW` + `DAMAGE` fail/success branches
- Metallic dragons (adult/ancient/young/wyrmling) special breaths:
  - `Sleep Breath` and `Paralyzing Breath` converted to typed `CONDITION` outcomes with durations, while repeat-save/wake caveats remain in description text
- Dragon legendary/action cleanup:
  - `Tail Attack`, `Wing Attack` damage, and `Frightful Presence` converted to typed damage/condition outcomes across adult+ancient dragon sets
- Grapple family cleanup (20 files):
  - `Grapple` RULE branches converted to typed `CONDITION` (`GRAPPLED`) while keeping escape DC / restrained caveats in descriptions
- Web family cleanup:
  - `Web` RULE branches in `giant-spider`, `ettercap`, and `spider` converted to typed `CONDITION` (`RESTRAINED`) while preserving object/escape caveats
- Invisibility family cleanup:
  - `Invisibility` RULE branches in `duergar`, `imp`, `quasit`, `sprite`, and `will-o-wisp` converted to typed `CONDITION` (`INVISIBLE`) with behavioral caveats retained in descriptions
- Charm family cleanup:
  - `succubus-incubus` `Charm` and `dryad` `Fey Charm` converted from `ON_USE/RULE` to `SAVING_THROW` + typed `CONDITION` (`CHARMED`) with 24-hour durations and caveat text preserved
- Teleport / planar-movement cleanup:
  - `Teleport` and `Etherealness` RULE branches converted to typed `TELEPORT` outcomes across `androsphinx`, `balor`, `gynosphinx`, `marilith`, `nalfeshnee`, `unicorn`, `ghost`, `night-hag`, `succubus-incubus`, and `nightmare`
- Attach / reaction-condition cleanup:
  - `Attach` branches in `cloaker` and `darkmantle` converted to typed `CONDITION` (`GRAPPLED`) with caveats retained in descriptions
  - `Unnerving Mask` in `chain-devil` converted to `SAVING_THROW` + typed `CONDITION` (`FRIGHTENED`) with duration and caveat text preserved
- Save-to-condition cleanup tranche:
  - Converted `Blinding Breath` (`dust-mephit`), `Blinding Spittle` (`gibbering-mouther`), `Stunning Screech` (`vrock`), and `Blinding Gaze` (`solar`) from `RULE` to typed save-fail condition outcomes
  - Converted `Tentacle Slam` (`otyugh`) from `RULE` to typed save-fail/save-success bludgeoning damage with stun on fail
  - Converted `Tentacles` (`chuul`) and `Fetid Cloud` (`dretch`) from `RULE` to typed save-fail `POISONED` condition outcomes while preserving caveat text
- 25x3 enforced-lane follow-up conversions:
  - Converted additional save-to-condition riders in `ghast` (`Ghast Claws`) and `ghoul` (`Ghoul Claws`)
  - Converted `Constrict` rider handling in `giant-constrictor-snake` to typed condition path where representable
  - Lane reports now include per-file `converted` vs `blocked` outcomes to prevent silent under-delivery
- Large creature wrapper/rider reduction follow-up:
  - Removed all remaining `Multiattack` wrapper `RULE` branches where mechanics were purely descriptive wrappers and base attacks were already explicitly authored on sibling features
  - Converted remaining straightforward poison rider families to typed `DAMAGE` or `CONDITION` outcomes where semantics were representable without inventing new primitives (e.g., `assassin`, `wyvern`, `spirit-naga`, `stone-giant` prone rider)
- Floor-pass ON_HIT condition conversions (2026-03-24):
  - `gladiator` Shield Bash Prone: `ON_HIT RULE` → `ON_HIT CONDITION(PRONE)`, save DC caveat retained in description
  - `deep-gnome-svirfneblin` Poisoned Dart: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 min)`, repeat-save caveat retained in description
  - `drow` Poisoned Bolt: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 hr)`, UNCONSCIOUS two-threshold escalation retained in description (two-threshold blocker)
  - `sprite` Poisoned Arrow: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 min)`, UNCONSCIOUS two-threshold escalation retained in description (two-threshold blocker)
- Continuation batch conversions (2026-03-24, third pass):
  - `bone-devil` Sting: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 min)`
  - `erinyes` Longbow Poison: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED)` (no duration — indefinite, "until lesser restoration")
  - `dragon-turtle` Tail Slam: `ON_HIT RULE` → `ON_HIT CONDITION(PRONE)`, forced-push caveat retained in description
  - `couatl` Poison Bite: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 24 hr)`, UNCONSCIOUS linked-condition retained in description (24hr-linked blocker)
  - `cockatrice` Petrifying Bite: `ON_HIT RULE` → `ON_HIT CONDITION(RESTRAINED)`, PETRIFIED two-stage escalation retained in description (two-stage blocker)
  - `pseudodragon` Poison Sting: `ON_HIT RULE` → `ON_HIT CONDITION(POISONED, 1 hr)`, UNCONSCIOUS two-threshold escalation retained in description (two-threshold blocker)
  - `cloaker` Moan: `ON_USE RULE` → `SAVING_THROW(WIS) + ON_SAVE_FAIL CONDITION(FRIGHTENED, 1 round)`, 24hr immunity caveat retained in description
  - Spider family poison riders via `multiplier: 0.5` pattern — 4 files:
    - `giant-wasp` Sting Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 3d6, multiplier: 0.5)`
    - `phase-spider` Bite Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 4d8, multiplier: 0.5)`
    - `giant-spider` Bite Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 2d8, multiplier: 0.5)`
    - `giant-wolf-spider` Bite Poison: `ON_HIT RULE` → `ON_HIT DAMAGE(POISON 2d6, multiplier: 0.5)`
    - Paralyzed-at-0-HP caveats retained in descriptions (conditional state application not modeled)
