# Creature RULE Blockers — Model Gap Reference

This file catalogs every remaining `EFFECT_KIND.RULE` blocker in creature source data after the Phase 7.7 Tranche 1 floor pass (2026-03-24).

Use this as the design input when deciding whether to expand or refactor authored types, core primitives, or the engine resolution layer.

---

## How to read this file

Each blocker family lists:
- **What the mechanic does** (concise SRD description)
- **Why it's blocked** (which primitive is missing)
- **Minimum model addition** (smallest typed addition that would unblock it)
- **Affected creatures** (file names)

---

## Blocker Families

### 1. Change Shape
**Mechanic:** The creature polymorphs into one or more listed forms. Statistics remain the same; size and shape change. Reverts on death.
**Why blocked:** Full stat-block transformation (size, form, carried equipment shrinking) is not modeled as a typed outcome. No `TRANSFORM` outcome type exists.
**Minimum addition:** `TRANSFORM` outcome with target form ref, size override, equipment behavior flag.
**Affected:** `adult-gold-dragon`, `adult-bronze-dragon`, `ancient-gold-dragon`, `adult-silver-dragon`, `ancient-bronze-dragon`, `ancient-copper-dragon`, `ancient-silver-dragon`, `ancient-brass-dragon`, `couatl`, `deva`, `night-hag`, `oni`

---

### 2. Parry
**Mechanic:** Reaction. Add +N to AC against one melee attack that would hit. Must see attacker and be wielding a melee weapon.
**Why blocked:** AC bonus as a reaction outcome is not modeled. No `AC_BONUS` outcome type. Reactions that modify incoming attack resolution have no invocation model.
**Minimum addition:** `AC_BONUS` outcome type on `REACTION` activation; conditional trigger on "incoming melee attack that would hit."
**Affected:** `bandit-captain`, `erinyes`, `gladiator`, `knight`, `marilith`, `noble`

---

### 3. Swallow
**Mechanic:** Grappled creature is swallowed. While swallowed: blinded, restrained, total cover, takes acid damage each turn. Creature can escape if swallower takes threshold damage in one turn.
**Why blocked:** Containment state machine (swallowed = blinded+restrained+cover+ongoing damage) with conditional escape trigger is not modeled. No containment lifecycle primitive.
**Minimum addition:** Containment state outcome with bundled condition set, ongoing damage rider, and escape trigger keyed on per-turn incoming damage threshold.
**Affected:** `giant-toad`, `giant-frog`, `purple-worm`, `remorhaz`, `tarrasque`

---

### 4. Weakening Breath (Gold Dragon family)
**Mechanic:** Each creature in cone makes STR save. On fail: disadvantage on STR checks and STR attack rolls for 1 minute. Can repeat save at end of each turn.
**Why blocked:** Disadvantage grant scoped to STR checks/attacks with duration and repeat-save recovery is not modeled. No typed disadvantage-grant outcome with ability-scope filtering.
**Minimum addition:** `DISADVANTAGE_GRANT` outcome scoped to ability code + check/attack type, with timed duration and end-of-turn repeat-save recovery.
**Affected:** `adult-gold-dragon`, `ancient-gold-dragon`, `gold-dragon-wyrmling`, `young-gold-dragon`

---

### 5. Slowing Breath (Copper Dragon family)
**Mechanic:** Each creature in cone makes CON save. On fail: can't use reactions, speed halved, can't make more than one attack per turn for 1 minute. Can repeat save at end of each turn.
**Why blocked:** Speed reduction + reaction suppression + attack-count cap as a bundled timed condition is not modeled. Current CONDITION type has no structured speed/action-economy modifiers.
**Minimum addition:** Structured condition payload with speed modifier, reaction suppression flag, and per-turn attack cap; plus end-of-turn repeat-save recovery.
**Affected:** `adult-copper-dragon`, `ancient-copper-dragon`, `copper-dragon-wyrmling`, `young-copper-dragon`

---

### 6. Repulsion Breath (Bronze Dragon family)
**Mechanic:** Each creature in cone makes STR save. On fail: pushed 60 ft away from dragon.
**Why blocked:** Forced movement (push) as a typed outcome is not modeled. No `FORCED_MOVEMENT` outcome type.
**Minimum addition:** `FORCED_MOVEMENT` outcome with direction (away from source), distance, and unit.
**Affected:** `adult-bronze-dragon`, `ancient-bronze-dragon`, `bronze-dragon-wyrmling`

---

### 7. Life Drain
**Mechanic:** On hit: CON save or max HP reduced by damage dealt. Max HP reduction lasts until long rest. Target dies if max HP reaches 0.
**Why blocked:** Max-HP reduction as a persistent typed outcome (separate from current HP damage) is not modeled. No `HP_MAX_REDUCTION` outcome type.
**Minimum addition:** `HP_MAX_REDUCTION` outcome with amount, recovery trigger (long rest), and death-at-zero condition.
**Affected:** `specter`, `wraith`, `wight`

---

### 8. Create Specter (Wraith)
**Mechanic:** Humanoid killed by wraith rises as a specter under the wraith's control (max 7 specters). Specter does not rise if wraith already controls 7.
**Why blocked:** Cross-actor spawning with control relationship and population cap is not modeled.
**Minimum addition:** `SPAWN` outcome with spawned creature ref, controller reference, and population cap constraint.
**Affected:** `wraith`

---

### 9. Complex Poison Riders (nested save inside ON_HIT)
**Mechanic:** Attack hits → target makes CON save → on fail takes poison damage AND gets condition; or two-threshold: if fails by ≥5, also gets second condition.
**Why blocked:** Nested save-gated sub-resolution inside an `ON_HIT` branch is not modeled. The `multiplier: 0.5` pattern only works for DAMAGE (save-fail/half-on-save); it cannot express a save-gated CONDITION rider inside ON_HIT without a nested invocation primitive.
**Minimum addition:** Nested rider branch: `ON_HIT` branch that contains a save-check sub-invocation, with `ON_SAVE_FAIL` sub-branches for damage and/or condition outcomes.
**Affected:** `giant-centipede` (save-fail-only damage, no half + paralyzed-at-0-HP), `homunculus` (two-threshold variable duration), `quasit` (damage+condition on save-fail inside ON_HIT)

---

### 10. Two-Threshold Escalation (save margin ≥ 5)
**Mechanic:** Target fails save → gets condition A. If save fails by 5 or more → also gets condition B (UNCONSCIOUS).
**Why blocked:** Two-threshold branching based on save failure margin is not modeled. Branch model only supports pass/fail, not margin-gated secondary outcomes.
**Minimum addition:** Margin-gated branch variant: `ON_SAVE_FAIL_BY` with minimum margin value, enabling secondary condition on large failure.
**Affected:** `drow` (Poisoned Bolt), `sprite` (Poisoned Arrow)

---

### 11. Aggressive (Orc)
**Mechanic:** Bonus action: move up to speed toward a visible hostile creature.
**Why blocked:** Movement grant as a typed outcome does not exist. No `MOVEMENT` outcome type.
**Minimum addition:** `MOVEMENT` outcome with direction (toward target), distance (speed), and activation (BONUS_ACTION).
**Affected:** `orc`

---

### 12. Rampage (Gnoll)
**Mechanic:** When gnoll reduces a creature to 0 HP with a melee attack on its turn: bonus action to move half speed and make a bite attack.
**Why blocked:** Kill-trigger invocation (fires when actor reduces target to 0 HP) does not exist in the capability model.
**Minimum addition:** `KILL_TRIGGER` invocation kind on `BONUS_ACTION` activation; chained movement + attack followup.
**Affected:** `gnoll`

---

### 13. Trampling Charge (Warhorse)
**Mechanic:** If horse moves ≥20 ft toward target and hits with hooves: target makes DC 14 STR save or falls prone. If prone, horse makes bonus hooves attack as bonus action.
**Why blocked:** Multi-precondition invocation (movement distance precondition + hit + save + conditional bonus attack) is not expressible as a single typed invocation chain.
**Minimum addition:** Conditional-precondition invocation with movement-distance precondition; chained bonus attack on condition (target is prone).
**Affected:** `warhorse`

---

### 14. Lycanthropy (Werewolf / Wereboar / Werebear)
**Mechanic:** Humanoid target bitten: must make CON save or be cursed with lycanthropy. Curse has downstream transformation, alignment, and stat-change consequences removable only by specific magic.
**Why blocked:** Disease/curse infection pipeline with downstream transformation state is not modeled. No infection/curse outcome type.
**Minimum addition:** `CURSE` or `INFECTION` outcome with associated transformation state, cure condition (remove curse / wish), and downstream stat-block changes.
**Affected:** `werewolf`, `wereboar`, `werebear`

---

### 15. Strength Drain (Shadow)
**Mechanic:** On hit: STR reduced by 1d4. If STR reaches 0, target dies. New shadow spawns from corpse.
**Why blocked:** Ability score reduction as a typed outcome is not modeled. Spawn-on-death is also unmodeled.
**Minimum addition:** `ABILITY_SCORE_REDUCTION` outcome with die config, targeted ability, death-at-zero flag, and spawn-on-death hook.
**Affected:** `shadow`

---

### 16. Engulf (Gelatinous Cube / Shambling Mound)
**Mechanic:** Move into creature's space → creature makes DEX save or is engulfed (restrained, blinded, takes acid damage per turn, suffocation risk). Can escape with STR check.
**Why blocked:** Movement-triggered containment with bundled conditions and per-turn damage is not modeled. No movement-into-space trigger primitive.
**Minimum addition:** `ENTER_SPACE` trigger + containment outcome with bundled condition set, ongoing damage, suffocation flag, and STR-check escape.
**Affected:** `gelatinous-cube`, `shambling-mound`

---

### 17. Ongoing Damage Riders (non-containment)
**Mechanic:** Effect applies recurring damage at the start/end of each turn (fire, acid, bleed, etc.) until action+check removes it or duration expires.
**Why blocked:** No persistent ongoing-damage rider primitive. Current DAMAGE outcomes are one-shot resolution events.
**Minimum addition:** `ONGOING_DAMAGE` outcome with trigger (start/end of turn), damage type/amount, and cancel condition (action + check DC, or duration).
**Affected:** `bearded-devil` (Infernal Wound), `magmin` (ignite), `alchemist's fire` (equipment), various bleed/burn riders across dragons/fiends.

---

### 18. Object / Armor Damage (Corrosive / Rust)
**Mechanic:** Attack damages or destroys target's non-magical metal weapon/armor. Object takes damage or gets -1 AC penalty permanently.
**Why blocked:** Object damage targeting (weapon/armor as target rather than creature) is not modeled. No object-damage outcome type.
**Minimum addition:** `OBJECT_DAMAGE` outcome targeting worn/wielded item, with item type filter (metal weapon/armor) and damage or AC-reduction effect.
**Affected:** `black-pudding` (Corrosive Form), `gray-ooze` (Corrode Metal), `rust-monster` (Antennae)

---

### 19. Split (Puddings / Oozes)
**Mechanic:** When creature of Large size or larger takes lightning or slashing damage, it splits into two creatures of one size smaller with half the HP.
**Why blocked:** Creature split (one creature → two creatures, stat changes) is not modeled. No split/replicate lifecycle primitive.
**Minimum addition:** `SPLIT` lifecycle outcome triggered on damage type, producing two derived creature instances at reduced size/HP.
**Affected:** `black-pudding`, `ochre-jelly`

---

### 20. Haste / Buff Grants
**Mechanic:** Clay Golem Haste: until end of next turn, +2 AC, advantage on DEX saves, extra attack action. Stone Golem Slow: speed halved, -2 AC, -2 DEX saves, can't use reactions, one attack per turn.
**Why blocked:** Bundled multi-stat temporary buff/debuff (AC modifier + save modifier + action economy grant + advantage flag) is not modeled as a typed outcome.
**Minimum addition:** `STAT_MOD_BUNDLE` timed outcome with slots for AC, save, speed, advantage, and action economy modifiers.
**Affected:** `clay-golem` (Haste), `stone-golem` (Slow)

---

### 21. Light Toggle / Illumination State
**Mechanic:** Magmin can ignite flammable objects it touches. It sheds bright/dim light in an aura (always on). Shrieker emits a shriek alarm triggering other creatures.
**Why blocked:** Environmental illumination state and ambient alarm signals are not modeled as typed outcome primitives.
**Minimum addition:** `ILLUMINATION` state outcome and `SIGNAL` outcome (area alarm trigger).
**Affected:** `magmin` (Ignited Illumination), `shrieker` (Shriek)

---

### 22. Illusion / False Appearance
**Mechanic:** Creature appears as an ordinary object or specific other creature while motionless. Detecting requires Investigation check vs DC.
**Why blocked:** Illusion state (alternate appearance + detection check) is not modeled as a typed outcome.
**Minimum addition:** `ILLUSION` state outcome with appearance ref or form, and detection check DC.
**Affected:** `green-hag` (Illusory Appearance), `sea-hag` (Illusory Appearance), `doppelganger`

---

### 23. Death Glare (Sea Hag)
**Mechanic:** Targets that can see the hag and fail a WIS save drop to 0 HP if they have ≤25 HP. Otherwise frightened until end of next turn.
**Why blocked:** Conditional instant-drop-to-0-HP (only if current HP ≤ threshold) is not modeled. No HP-threshold-conditional outcome.
**Minimum addition:** Conditional outcome with HP-threshold guard: if target HP ≤ N → drop to 0; else → FRIGHTENED condition.
**Affected:** `sea-hag`

---

### 24. Mummy Rot (Mummy / Mummy Lord)
**Mechanic:** Cursed target cannot regain HP from any source. STR max reduced by 3d6 until it reaches 0 (target crumbles to dust). Removable only by remove curse.
**Why blocked:** HP-recovery suppression + max-STR reduction curse compound is not modeled.
**Minimum addition:** Curse outcome with HP-recovery-suppression flag, STR-max-reduction die config, and death/crumble-at-zero trigger.
**Affected:** `mummy`, `mummy-lord`

---

### 25. Blood Drain / Attach State (Stirge)
**Mechanic:** On hit → attached. While attached: can't attack; at start of each turn deals 5 CON damage and gains 5 HP. Target or adjacent creature can use action to detach (DC 8 STR check).
**Why blocked:** Attach state with ongoing dual effect (drain HP from target, gain HP for source) and detach mechanic is not modeled.
**Minimum addition:** Attach state lifecycle with per-turn dual transfer (HP from target, HP to self), detach check, and automatic-fall-off-at-0-HP.
**Affected:** `stirge`

---

### 26. Divine Eminence (Priest)
**Mechanic:** As a bonus action, expend a spell slot to deal extra 10 (3d6) radiant damage on next weapon hit this turn.
**Why blocked:** Spell-slot-expend bonus action that modifies the next attack's damage is not modeled. No spell-slot-consumed damage rider primitive.
**Minimum addition:** Bonus-action spell-slot-expend outcome that injects a one-turn damage rider onto the next weapon attack.
**Affected:** `priest`

---

### 27. Ink Cloud / Darkness Zones (Octopus / Cloaker)
**Mechanic:** Creature releases ink cloud (heavily obscured area for 1 minute in water) or conjures a darkness aura (20-ft radius, magical darkness, can't be dispelled by spells ≤2nd level).
**Why blocked:** Persistent AoE zone (darkness, obscurement) with duration and optional magical-darkness type is not modeled. No zone/aura placement outcome.
**Minimum addition:** `ZONE` outcome with area shape, duration, effect type (darkness/obscurement/etc.), and magical darkness flag.
**Affected:** `octopus`, `giant-octopus` (Ink Cloud), `cloaker` (Darkening), `darkmantle`

---

### 28. Reel (Roper)
**Mechanic:** Roper pulls a grappled creature up to 25 ft closer to itself.
**Why blocked:** Forced movement (pull toward source) as a typed outcome is not modeled. (Same family as Repulsion Breath push, different direction.)
**Minimum addition:** `FORCED_MOVEMENT` outcome with direction (toward source), distance, and unit — same primitive as Repulsion Breath but direction parameterized.
**Affected:** `roper`

---

### 29. Nimble Escape (Goblin)
**Mechanic:** Goblin can take the Disengage or Hide action as a bonus action on each of its turns.
**Why blocked:** Action economy grant (add Disengage/Hide as bonus action available each turn) is not modeled as a typed feature outcome.
**Minimum addition:** `ACTION_ECONOMY_GRANT` outcome that adds specified actions (DISENGAGE, HIDE) as bonus action options each turn.
**Affected:** `goblin`

---

### 30. Androsphinx Roar (Multi-stage per-use escalation)
**Mechanic:** First roar: FRIGHTENED 1 min (WIS save). Second roar: FRIGHTENED + DEAFENED 1 min (WIS save). Third roar: thunderclap 600-ft sphere 12d8 thunder damage (CON half).
**Why blocked:** Per-use-count stage progression (first/second/third use has different effect) is not modeled. Resource-stage progression keyed by use count per day is not a current capability shape.
**Minimum addition:** Stage-progression invocation: tracks use count, selects branch set by current stage index.
**Affected:** `androsphinx`

---

### 31. Draining Kiss (Succubus/Incubus)
**Mechanic:** Charmed or willing target: kiss deals 5d6+5 psychic damage. Target's HP max reduced by same amount. Returns on long rest.
**Why blocked:** HP-max reduction paired with psychic damage is not modeled (same family as Life Drain but as a standalone action, not ON_HIT).
**Minimum addition:** `HP_MAX_REDUCTION` outcome (same primitive needed for Life Drain) usable on standalone SAVING_THROW or ACTIVATED invocation.
**Affected:** `succubus-incubus`

---

### 32. Whelm (Water Elemental)
**Mechanic:** Grappled Medium or smaller creature is engulfed — restrained, unable to breathe (unless water-breathing), DC 13 STR save to escape each turn.
**Why blocked:** Same containment-state-machine blocker as Swallow/Engulf. Movement-into-space trigger + bundled conditions + escape check.
**Minimum addition:** Same as Engulf primitive (blocker 16 above).
**Affected:** `water-elemental`

---

### 33. Heart Sight (Unicorn)
**Mechanic:** Unicorn touches a creature and knows if it is evil, good, or neutral, and knows if it is under enchantment or illusion.
**Why blocked:** Sense/detect alignment and magic-state inspection output is not modeled as a typed outcome.
**Minimum addition:** `DETECT` outcome with target information type (alignment, enchantment, illusion) — a sensing/revelation outcome kind.
**Affected:** `unicorn`

---

## Summary Table

| # | Blocker family | Files affected | Missing primitive |
|---|---|---|---|
| 1 | Change Shape | 12 | `TRANSFORM` outcome |
| 2 | Parry | 6 | `AC_BONUS` reaction outcome |
| 3 | Swallow / Engulf / Whelm | 7 | Containment state machine |
| 4 | Weakening Breath | 4 | `DISADVANTAGE_GRANT` scoped outcome |
| 5 | Slowing Breath | 4 | Structured condition with speed/action modifiers |
| 6 | Repulsion Breath / Reel | 4 | `FORCED_MOVEMENT` outcome |
| 7 | Life Drain / Draining Kiss | 4 | `HP_MAX_REDUCTION` outcome |
| 8 | Create Specter | 1 | `SPAWN` outcome |
| 9 | Complex Poison (nested save) | 3 | Nested rider branch primitive |
| 10 | Two-Threshold Escalation | 2 | `ON_SAVE_FAIL_BY` margin-gated branch |
| 11 | Aggressive | 1 | `MOVEMENT` outcome |
| 12 | Rampage | 1 | `KILL_TRIGGER` invocation |
| 13 | Trampling Charge | 1 | Movement-precondition invocation chain |
| 14 | Lycanthropy / Curse infection | 3 | `CURSE`/`INFECTION` outcome |
| 15 | Strength Drain | 1 | `ABILITY_SCORE_REDUCTION` outcome |
| 16 | Ongoing Damage Riders | many | `ONGOING_DAMAGE` persistent outcome |
| 17 | Object / Armor Damage | 3 | `OBJECT_DAMAGE` outcome |
| 18 | Split | 2 | `SPLIT` lifecycle outcome |
| 19 | Haste / Slow bundles | 2 | `STAT_MOD_BUNDLE` timed outcome |
| 20 | Light / Signal | 2 | `ILLUMINATION` / `SIGNAL` outcome |
| 21 | Illusion / False Appearance | 3 | `ILLUSION` state outcome |
| 22 | Death Glare | 1 | HP-threshold-conditional outcome |
| 23 | Mummy Rot | 2 | HP-recovery-suppression curse outcome |
| 24 | Blood Drain / Attach | 1 | Attach state lifecycle |
| 25 | Divine Eminence | 1 | Spell-slot-expend damage rider |
| 26 | Ink Cloud / Darkness Zone | 4 | `ZONE` placement outcome |
| 27 | Nimble Escape | 1 | `ACTION_ECONOMY_GRANT` outcome |
| 28 | Multi-stage Roar | 1 | Stage-progression invocation |
| 29 | Draining Kiss (see #7) | — | — |
| 30 | Heart Sight | 1 | `DETECT` outcome |

---

## Primitives with highest unblock leverage

Implementing these would clear the most RULE entries:

1. **`FORCED_MOVEMENT`** — unblocks Repulsion Breath (3), Reel (1), dragon push riders
2. **`HP_MAX_REDUCTION`** — unblocks Life Drain (3), Draining Kiss (1), Mummy Rot (partial)
3. **Containment state machine** — unblocks Swallow (5), Engulf (2), Whelm (1)
4. **`ONGOING_DAMAGE` rider** — unblocks bleed/burn/acid families across many creatures + equipment
5. **Nested rider branch** — unblocks complex poison (3) and generalizes post-hit save chains
6. **`TRANSFORM` outcome** — unblocks Change Shape (12) but high implementation complexity
7. **`AC_BONUS` reaction** — unblocks Parry (6), relatively contained scope
