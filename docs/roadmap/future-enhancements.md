# Future enhancements backlog

> **Status:** proposed enhancements. The Post-launch section holds improvements that are deliberately deferred until after launch; everything needed for a competitive product before closed beta lives in the phase plans, not here.
> **Scope:** product ideas, model redesigns and interactive behavior that are explicitly out of phase

## Campaign Features (GM-directed)

Campaigns will support a campaign-level **Feature** concept that applies temporary grants to participating characters. This is intentionally separate from encounters, inventory, or core entitlement behavior.

### Why this fits later

- It should stay out of the core phase scope so Campaign and Encounter can ship with deterministic, small contracts.
- It creates a clean seam for future GM creativity without rewiring sheet/engine structure.

### Intended behavior

- A Feature is owned by a Campaign.
- A Feature can be declared as:
  - Campaign-wide (applies to all eligible participants), or
  - Character-scoped (applies to selected character(s)).
- A Feature can expose one or more grant packages. Grants can include:
  - feature-like permissions,
  - behavior flags,
  - mechanical modifiers,
  - or other explicit, versioned campaign mechanics.
- A Feature can define prerequisites (class, race, level, or other stable predicates).
- The feature evaluator applies grants when prerequisites are met.
- Granted visibility and effect are explicit and auditable.
- Granting or ungranting does not rewrite core character structure.

### Open questions

- Are grants only mechanical, only informational, or both?
- Should characters see grant sources in their sheet projection?
- Do we need grant expiration / session-bound grant windows in phase 1?

## Node-based Campaign management and authoring (user-requested 2026-09-27)

The user wants two React Flow features. Neither starts while ADR 0035 is in flight. Scheduling (user, 2026-10-01, superseding 2026-09-27): **both are pre-launch but post-beta.** They start once Phases 8.2 and 8.3 are done, and are worked while beta testers are being recruited.

- **Advanced authoring node editor.** Authoring is heavy, and a hard Advanced path could put off newer players who want to go beyond the Guided flow.
- **Campaign node map.** A competitor running a Kickstarter has a similar feature, so it must not drift far.
  - The Campaign entry kinds it needs (locations, NPCs, factions and their relationships) are designed together with the Q18 per-Campaign entries limit.

### Campaign management as a node map

GMs organize a Campaign as a graph: locations, NPCs, factions, handouts, Scenes and Encounters as nodes, with relationships as edges ("rules", "located in", "allied with").

- **Differentiator:** it is a visual board like LegendKeeper's and World Anvil's, but connected to live play. A node opens its Scene, starts its Encounter, or reveals its handout.
- **Needs:**
  - Campaign entry kinds for locations, NPCs and factions (the Campaign model has none yet; see the Q18 entries limit);
  - an edge model;
  - a counterpart that works on mobile and with keyboard and screen reader (a list or outline view), because a canvas alone is not accessible.

### Advanced authoring as a contextual node editor

This replaces the long Advanced authoring form with a mind-map editor. Selecting a node shows only the child nodes valid in that context, which is less overwhelming than a 12-step form. The Advanced form is retired only if usage data shows it isn't used.

- **Reuse:** authored forms are already backend-resolved node maps (`steps -> sections -> nodes`, ADR 0004). React Flow should render those same resolved nodes and their visibility and options rules, not a second model.
- **Needs:**
  - the same validation and TanStack Form state as the form platform;
  - a keyboard and screen-reader path;
  - mobile behavior;
  - usage analytics before the form is retired.

## Help: definitions and how-to guides (user direction, 2026-10-13)

Scheduling: **during beta, last**. Testers start without help text, so their feedback shows where the app isn't intuitive; that feedback shapes what the help says.

- **Definitions in authoring.** Every authoring field and option (for example a sense's Illumination access: Magical darkness) shows a short plain-language definition on hover, keyboard focus and touch. Definitions are written once in a shared glossary keyed by vocabulary code; a test fails when a node-map field or option has no entry.
- **Help pages.** A searchable glossary drawn from the same entries, and step-by-step how-to guides for the main journeys: homebrew content (such as a custom sense granted by a feat), build a Character, run a Campaign session, prepare a Scene and run an Encounter.

## Crowdfunding campaign (user direction, 2026-09-28)

The user wants a Kickstarter campaign with realistic goals to fund finishing the build and early hosting.

- **Timing:** it runs alongside closed beta, not after it. The campaign ends just before beta opens, and higher-tier backers join a Founders' Beta and help shape the product.
- **Guardrails:**
  - rewards are bounded: no lifetime subscriptions, only beta access, time-limited plans, badges and credits;
  - it launches only once there is working footage;
  - the page states plainly what the money funds;
  - the wording is "compatible with 5th edition", never the Dungeons & Dragons trademark.
- **Tracking:** this is a business plan, kept here and out of the Phase 8.2 work-slice registry, whose dashboard tracks dev completion only (user, 2026-10-01). Audience-building comes first. React Flow prototypes may serve as campaign footage; the features themselves keep the schedule in the node-based section above.
- **Next step:** Claude drafts a campaign plan for the user's review. It covers the goal built from real costs, the reward tiers, a timeline tied to the Phase 8.2 and 8.3 finish, a page outline, a video shot list, the waitlist and the risks.

## Post-launch

### Deferred edge cases (watch for in real use)

These are rare paths, roughly under 5% of sessions, whose failure is visible and recoverable (user direction, 2026-10-15). Fix one when real use shows it happening.

- **Live-backend script spawn failure:** if `yarn` can't start, `scripts/liveBackendValidation.mjs` throws an unhandled rejection instead of a step error. This is dev tooling; the run still fails, just with a noisier log.
- **`--fresh` guard:** `liveBackendValidation.mjs --fresh` checks the container by name only. A different container given the same name would be reset.
- **Chosen-creature list and a moved Scene (SPELLS-8.T12):** the list commit (`areaCommitPersistence.ts`, `input.area === null`) does not re-read the Scene, so a token moved between planning and commit (the sphere membership or range was checked at plan time) is not re-checked. Single-target commits re-read it. Only a Scene edit landing inside one command's await gap triggers it, and the GM can undo the cast.
- **Range outline of a shaped chosen-creature list (SPELLS-8.T12):** Mass Cure Wounds draws no range outline from the caster (`enforcedRange` reports UNLIMITED for the creatures; the picked point carries the 60 ft range), yet the room warns for a point beyond it.
- **Replay of a completed chosen-creature cast:** `actionAdmission.ts`'s replay branch expects a mechanics-batch output, so a retried command id after the room journal has forgotten it may raise "Stored Encounter action receipt mismatch." Unverified; point-area roots may share it.
- **Pool-paid attack reactions (SPELLS-8.T8):** an attack reaction cast from a limited-use or fixed-level pool (for example Shield granted once per rest) is not offered, because the reaction receipt carries no pool spend (`nativeEncounterAttackReaction.ts`). The cast is still available from slots and as a normal action; offering it needs the reaction receipt to spend and restore the pool use.
- **Sight-gated saves (ATTACK-10.T4):** Danger Sense is not lost while Deafened (no holder-state predicate for it), a sight-gated save contributor gives nothing to the save inside an attack's rider, and a flagged grant scoped to a Condition or Rule applies to base saves only. A point area's GM reason names the caster, not the origin, and lists no Sense. Each needs a rarer authoring shape than the SRD uses.
- **Rage on outright death:** a grant that ends only on a condition (SRD Rage ends on Unconscious) is not ended when its holder is `DEFEATED`, for example a raging Character killed outright by massive damage. The grant stays visible on a defeated holder, and the GM can end it (`encounterGrantLifetimes.ts`).
- **Pact Magic slot level for upcasting:** when the only slot a Character has is a higher Pact Magic slot, the cast keeps the spell's own level. So a Cleric/Warlock casting Cure Wounds from a 2nd-level Pact slot rolls 1d8, not 2d8. The player can choose the higher-level cast candidate instead.
- **Creature type warning for a Character target (SPELLS-8.T13):** a Character's facts carry no creature type, so Hold Person on a player Character never raises `TARGET_CREATURE_TYPE_EXCLUDED` even though a Character's race implies a type (Humanoid in the SRD). The GM sees no warning, and the spell works, which matches the SRD for Humanoid Characters.
- **Sneak Attack on Feature-sourced attacks and movement undo (ATTACK-9.T2d):** a Character on-hit rider merges only onto equipment-sourced attacks, so a Feature-sourced attack (a Bite Feature) gets no Sneak Attack. A movement opportunity attack has no GM undo, so its spent once-per-turn use is only released when the turn ends.
- **Once-per-turn limits outside the general attack path (ATTACK-9.T2d):** Legendary Actions, Disarm, the target's own reaction, area rules and the read path supply no turn-use loader, so a homebrew attack authored `ONCE_PER_TURN` there is refused as unsupported (fails closed). The immediate follow-up save branch applies neither restrictions nor the usage limit. More than 16 distinct once-per-turn keys spent by one actor in one turn would fail the row parse. Two commits racing on one key hit the version fence first; the persistence backstop throws a plain error.
- **Projectile at a creature already at 0 hit points (SPELLS-26):** a second dart of Magic Missile at a creature an earlier dart dropped still resolves against the chained hit points and is reported with the rest; the room does not warn or redirect it. Rare, visible and recoverable by undo.
- **Duplicated digest prose:** the README restates the image digest that `.github/workflows/live-backend.yml` pins, so the two can drift when the digest is bumped.
- **A reaction that only adds a follow-up is refused after being offered (REACTION-4.T2):** `resolveNativeActionReaction` requires a used reaction to change the attack's bound facts or the reactor's defenses. A Tiefling casting Absorb Elements against fire already resists it, so the use throws a plain error after the offer; the player can decline and the pause stays. Rare, recoverable. The fix is to scope the must-change check to `ATTACKED_SELF` and refuse at discovery.
- **Grant- or rider-added damage types are not seen by reaction discovery (REACTION-4.T2):** `attackHitDamageTypeIds` reads only the attack's authored outcomes, so a damage type added by an active grant or rider does not offer an Absorb Elements named for it. (The crit-only over-offer is fixed in REACTION-4.T3.)
- **A slot-scaled reaction with no DAMAGE/HEAL scaling offers only its base cast level (REACTION-4.T3):** `getExplicitSpellCastLevels` derives upcast levels from `DAMAGE` and `HEAL` scaling entries only, so an authored Absorb Elements whose only scaling is a `SPELL_SLOT_LEVEL` grant amount is castable at its own level, where the bonus is `multiplier × (level − subtractLevels)`. Authoring a `DAMAGE`/`HEAL` scaling entry (as Aid does) lists the higher levels. Deriving the levels from the grant itself needs the Sheet's mechanics projection to carry grant payloads.
- **Absorb Elements' resistance lasts as long as its melee bonus (REACTION-4.T3):** both ride one effect that ends at the end of the caster's next turn, while the SRD ends the resistance at the start of it. Splitting them needs a reaction to create more than one effect.
- **Absorb Elements' follow-up is spent by any attack roll (REACTION-4.T3):** the grant is consumed on `ON_ATTACK_ROLL`, which the Worker consumes before the hit is known, so a miss or a non-melee attack roll also spends the melee bonus. Rare (the next attack is usually the melee attack) and visible on the Sheet; the fix is a hit-only, melee-only consume event.
- **Half damage on a successful save is unproved for a Character cast (SPELLS-8.T2):** the room Fireball proof answers every save with a failure. The halving path is shared with Creature area actions, which prove it. If it broke, a Wolf would visibly take full damage and the GM could correct its HP.
- **The GM sees the believed roll mode while targeting (ATTACK-17.2):** the target hover readout reads the acting Character's believed mode for every viewer, including the GM, who knows the true mode. It is the safe mode for a shared screen; a GM-only "true mode" line is the enhancement. Rare to matter and the roll card still shows the real result.
- **Undo can re-add a concealment observer (ATTACK-10.T1):** `restoreConcealmentPrune` restores the observers a move pruned without a version fence. A move prunes A, the GM re-adds A, A's Search removes A, and then undoing the move re-adds A. The GM sees it and can edit the observers.
- **No concealment prune under MANUAL automation (ATTACK-10.T1):** movement has no targets in MANUAL mode, so a hider that steps into view keeps its observer list. Attack sight on a Scene ignores the list anyway; only Search is affected, and the GM can edit it.
- **The concealment prune checks only the final position (ATTACK-10.T1):** a hider that crosses an observer's open line mid-path and ends behind cover stays hidden. Arguably a GM call.
- **`generated-parity` can miss a dirty generated file outside the checksum list (PLATFORM-13.T10):** the stage compares each listed file's checksum and the `git status --porcelain` of the generated roots against their own baseline. A file under `_generated` that is already untracked or modified when the run starts, and is not in `generatedFiles`, shows the same status line after codegen even if codegen rewrote it. Today every tracked `_generated` file is listed, so it needs a new codegen output plus a dirty tree. CI starts from a clean checkout, where `generatedDrift.mjs` is exact.
- **Fireball's room proof uses a stand-in wizard (SPELLS-8.T2):** the fixture is a level-1 Fighter with Wizard spellcasting and a hand-written slot table. A real Wizard Class whose slot table lacked the 3rd-level row would visibly not offer Fireball.
- **Repeated short terms split by punctuation are partly unmasked (ACCOUNTS-7.T2):** in Standard campaign text, `ASS. Ass! (ass)` masks only the first `ass`. The matcher skips punctuation, so the next short whole-word term fails its word boundary. The text stays visible and the GM can switch the Campaign to Mature or edit it.
- **Removing a canonical subject from the corpus (PLATFORM-18.T1):** the seed fails before any write, naming the removed ids (`assertNoRemovedSubjects` in `seed.ts`), so a removal still needs a reset. Real removal can reuse `deletion.ts`: `removeCatalogueMetadata`, `reconcileAuthoredDeletionDependencies` and `deleteOwnedActiveAuthoredContent`. The mismatch is visible and loud.
- **Homebrew pins of a replaced canonical definition (PLATFORM-18.T2):** a canonical reusable definition is replaced in place and keeps `version` 1, with its checksum as the revision identity. A homebrew document that pinned the old checksum is not re-checked when the seed replaces it, so it keeps resolving the new definition. It surfaces only when a corpus change rewrites a definition that homebrew content already references, which is rare and visible in the definition's own page. The fix is a dependents check on definition replace, like the one subjects run (ADR 0024).
- **A replaced variant or subrace cannot move to a parent that is not yet imported (PLATFORM-18.T1):** the replace resolves the new parent first, so a seed that re-parents a subject to a brand-new parent fails with the missing-parent error. Rerunning the seed after the parent is imported resolves it; the manifest order does not guarantee parents first for a re-parent.
- **`damageTypeIds` accepts duplicates (REACTION-4.T2):** authoring the same damage type twice in a `DAMAGE_TAKEN` trigger is accepted and harmless; a uniqueness check on the schema would reject it.
- **A resistance-only reaction seals no change in its audit (REACTION-4.T2):** `adjustment.defenseBefore === defenseAfter` and the bound-facts checksum are unchanged, so replay does not cross-check the defenses the reaction added. Sealing the defenses checksum in the adjustment would make the audit self-evident.
- **Other `.public`-keyed player reads still ignore an unseen creature (ATTACK-17.T2):** the player projection, turn, targets and result recipients follow `playerSeesActor`, but `pendingReads.ts`, `rollReveals.ts`, `rollModeReasons.ts`, `ruleRollCards.ts`, `turnResponseAuthority.ts`, `cleavingResponseAdmission.ts` and `actionAreaPending.ts` test `actor.public` alone. A player could read a roll or prompt that names an unseen creature the GM has not revealed. It needs a hidden creature caught in a live prompt.
- **Summary feed pushes only on fog changes (ATTACK-17.T2):** a player's Campaign summary re-reads the visible-creature list when the Encounter changes, not on every fog change, so a creature stepping out of sight can stay in the count until the next Encounter update.
- **Room Scene id mismatch fails closed (ATTACK-17.T2):** if the room's composed Scene is not the Encounter's bound Scene, the player lists no bound creature until the room catches up, as the Convex reads do.
- **On-hit riders from equipment-granted Features (ATTACK-9.T2a):** `collectOnHitRiders` reads class, subclass, race and feat Features. A passive Feature granted by an item or a nested option of an item is not collected, so a magic item's "extra 1d6 on every weapon hit" does not ride on the hit. Collect from the equipped items' Features when real use needs one.
- **A rider takes the weapon's first on-hit damage type (ATTACK-9.T2a):** a weapon that deals two `ON_HIT` types (a flaming sword) gives a "weapon's damage type" rider the type of its first `ON_HIT` entry by path order, not the primary type ("first authored", not "primary"). Rare; the author can name the type instead.
- **On-hit riders reach equipment weapon attacks only (ATTACK-9.T2a):** `appendActions` merges riders into the root-equipment attacks. An unarmed strike or a Feature-granted attack (a spell attack, a natural weapon) takes none, so a rider whose trigger is `UNARMED_ATTACK` never applies. Pass the riders to those sources when an authored rider needs them.
- **A passive CHOICE path's ON_HIT damage is collected as a rider (ATTACK-9.T2a):** `isOnHitDamage` accepts every `DIRECT` entry, which includes the options of a `CHOICE` path, so a passive Effect with a choice of `ON_HIT` damage merges all options. Only the weapon-type flag is restricted to fixed paths (schema). Restrict collection to `FIXED` paths if such an Effect is authored.
- **An Effect whose every restricted group is gated off has no OUTCOME graph (ATTACK-9.T2b):** template enumeration cannot know the attack's roll mode, so it seals the authored groups; if specialization then filters all of a path's groups away, `resolveEncounterActionPhaseExecution` throws "A selected outcome path requires its sealed OUTCOME graph." A rider merges into a weapon's unrestricted damage, so this needs a standalone restricted-only attack Effect. Treat a null specialization of an enumerated template as "nothing owed" if one is authored.
- **Path restrictions evaluate the attacking item's checks only (ATTACK-9.T2b):** `reduceEffectRestrictions` answers item identity, category, property and sole-weapon checks; anything else (a Character or class fact, `ATTACK_ABILITY`, another subject) fails its group whatever its constraint. Route those through the Grant-level `restrictions` or extend the reducer when a path needs them.
- **Path restrictions are honored on the general attack TEST_OUTCOME branch and equipment attacks only (ATTACK-9.T2b):** the schema limits them to `ON_HIT`/`ON_CRIT` paths, but the immediate and repeating follow-up-save branches, SINGLE_GRAPH actions, active-effect-plan outcomes (APPLY_GRANT, ACTOR_RELATIONSHIP), roll-table repeats and manifest behavior paths ignore them, and spell-cast, Encounter feature and creature actions never run `reduceEffectRestrictions` (a weapon check there throws at OUTCOME). Reject or honor them when such an Effect is authored.
- **The Sheet and mechanic DTOs show a gated rider as unconditional (ATTACK-9.T2b):** `normalizeCharacterActionMechanicFacts` emits the restricted DAMAGE row with no conditional marker, so the dice roll target lists Sneak Attack dice on every finesse attack. Add a conditional marker to the mechanic row when the Sheet needs to tell them apart.
- **`ATTACK_ROLL_MODE` is offered on every Equipment facet (ATTACK-9.T2b):** it is meaningful only in path restrictions; on a grant or modifier restriction it normalizes to `UNSUPPORTED` and fails closed. Scope the predicate to path restrictions when the facet model can express it.
- **Opportunity attacks and reactions measure no enemy proximity (ATTACK-9.T2c):** only `prepareAttack` passes `loadEnemyProximity`, so a gated rider (Sneak Attack's nearby enemy) is withheld from a movement-reaction or Disarm attack even beside an enemy. Pass the supplier at those call sites when a reaction attack should earn the rider.
- **A gated attack's Scene capture is all-or-nothing (ATTACK-9.T2c):** `ACTION_AREA_SCENE` reads every bound actor's token, so an unavailable or stale token binding (a GM removing a bound token mid-Encounter) refuses the whole attack, not just the rider, as it does for an area action. Scope the capture to the target's and consulted tokens, or clean bindings on token removal.
- **A NEUTRAL target never has enemies (ATTACK-9.T2c):** `encounterActorRelationship` is never HOSTILE when either side is NEUTRAL, so attacking a NEUTRAL creature never earns an `ENEMY_NEAR_TARGET` rider; "an enemy of the target" is not expressible in the disposition model.
- **`ENEMY_NEAR_TARGET` is offered on every Equipment facet (ATTACK-9.T2c):** it is meaningful only in path restrictions; elsewhere it normalizes to `UNSUPPORTED` and never applies.
- **An unmeasured Scene fails an `ENEMY_NEAR_TARGET` check with no way to acknowledge it (ATTACK-9.T2c):** an attack that names no Scene (a Table without positions) never earns the rider. A GM-acknowledgeable "Scene unmeasured" warning, as for an unchecked reach (D11), would let the table apply it by hand.
- **A follow-up-save weapon plus an appended rider is rejected (ATTACK-9.T2a/T2b):** `mergeOnHitRiders` appends riders last and `immediateFollowUpSaveEntries` requires the save entry last, so a weapon with an on-hit save and Sneak Attack does not compile as a follow-up save. Order riders before the save when such a weapon exists.
- **No settled roll card for a sight-adjusted movement reaction or Disarm (ATTACK-10.T3):** an opportunity attack or Disarm whose attack d20 settled in a different mode than the roller entered posts no `D20_MODE_ADJUSTED` card, and Disarm does not store `modeAdjustment`. Movement reactions and Disarm contests post no roll card at all today; the held die and the GM caption still show at the prompt.

### Shared live cursors (Q19)

This is a per-person, opt-in "Share my cursor" setting, sent at most 4 times a second and only while the mouse moves. It costs about 2,000–4,000 Durable Object requests per 4-hour session with 6 people. Revisit it when revenue supports the paid Workers plan; the launch matches Roll20, with a ping only.

### Images on notebook entries (D87)

D87 removes Campaign Files, which was the only way to attach an image to a notebook section or session. Notes are text-only at launch.

- **Example:** an NPC portrait on a People section, or a sketch on a Places section.
- **Candidate direction:** one optional image field on the notebook section itself, using the existing media pipeline. It is visible to whoever can see that section, so it needs no separate file list or permission model.

Raised by the user on 2026-10-03.

### Rules-engine-native modifier model

Much of the modifier vocabulary predates the rules engine and expresses capability rules as numeric workarounds. For example, Shocking Grasp's "can't take reactions" is authored as `REACTION_COUNT` `SET_VALUE` 0. Review the whole modifier model with the engine in mind:

- capability modifiers (`DISABLE` / `ENABLE` over reactions, bonus actions, movement modes, concentration, and so on) instead of zeroing counts, so effects compose cleanly and the UI can say "Reactions disabled (Shocking Grasp)";
- which kinds should become engine rules instead of authored numbers;
- migrating SRD and homebrew content, with authoring UX that reads like the rules text.

Raised by the user on 2026-09-25 during Phase 8.2.

### Node-map DSL child-scope references

Condition paths resolve one field from the current scope or an enclosing one (`ShallowPath`), never from a child group. So the Equipment effect `grip` field is always visible, although its correct condition is the effect's own `invocation.triggerCode`. Candidate: a bounded, typed child-scope reference. See `docs/architecture/authoring-schema.md`.

### Publish-time recompute of stored Character maximum HP

A Character's stored maximum HP (display only; rules are live) updates on the Character's next write after a content republish. A background recompute of the affected Characters after publish would remove that lag.

### Fog-off Scenes skip unused fog layers

A fog-off Scene that keeps its fog layers still uses full hydration, and players download layers they don't use. Skip or defer them while fog is off.

### World time tints the Scene

The Campaign clock knows dawn and dusk, but Scenes look the same at noon and midnight. Foundry lets world time drive Scene darkness. Candidate: a per-Scene opt-in that maps clock time to a lighting tone (day, dusk/dawn, night), applied client-side from the clock the page already reads, so it adds no room or Convex traffic. Raised by the user on 2026-10-01 during Phase 8.2.

### Manual-mode rules cues

Manual mode ([ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md)) resolves no rules, so a table running the rules itself gets no hint when a rules moment passes. Candidate: an opt-in Campaign setting (it replaces the removed "Subtle reminders" `manualReminderMode`, which only gated an undisplayed receipt marker) under which the actor's controller, the GM for monsters, sees a quiet note wherever Assisted mode would prompt. Nothing is rolled, chosen or applied.

- **Examples:** "Goblin left Thorin's reach: opportunity attack?"; a start- or end-of-turn effect such as an ongoing save or damage; a Concentration check after damage.
- **Needs:** an amendment to ADR 0034's Manual bullet; detection reuses the Assisted discovery paths (Manual movement skips reaction discovery today); cues are never shown to players who don't control the actor.

Raised by the user on 2026-10-07 during Phase 8.2; post-beta.

### Merchant interface

Players add bought items to their inventory by hand and subtract the coin themselves; there are no merchants. Candidate: a GM-run merchant (a stock list priced from the System's equipment, with optional markups) where a player buys an item and the app adds it to inventory and deducts the coins in one step. A merchant line is just the item, a quantity and a price (Arrow, quantity 20, 1 gp), so items need no sale unit. Raised by the user on 2026-10-08 during Phase 8.2 (Q21); post-launch.

### Hands for spellcasting and War Caster

D107 tracks what each hand holds, but spellcasting ignores it: a caster with a sword and shield can still cast a spell with somatic or material components. Candidate: an optional enforcement that requires a free hand (or a focus in hand) for those components, with War Caster lifting the somatic requirement. Optional because many tables house-rule it. Raised by the user on 2026-10-10 during ATTACK-7 design; post-launch.

### One free object interaction per turn

Weapon swaps and stowing are free and unlimited (D107, `encounterWieldConflict`). Candidate: track the SRD's one free object interaction per turn, so a second draw or stow costs the Use an Object action. Raised 2026-10-10 during ATTACK-7 design; post-launch.

### Metric Campaigns

Rules data is imperial: authored lengths use inches, feet, yards or miles, and the D&D System measures in feet. An unused Imperial/Metric measurement-system vocabulary was deleted on 2026-10-13 (the user's call: wire one when feedback warrants it). Candidate attach point: the System declares its measurement system (D&D 5e: Imperial), and the Campaign display setting converts from it. Only a Scene's grid can be calibrated in meters, converted at the exact 0.3048 m per foot. Candidate: a Campaign setting that shows every length in meters at presentation, using the tabletop convention of 1.5 m per 5 ft (30 ft reads 9 m), so authored content is not rewritten. It needs one decision: Scene meter grids switch to the same 0.3 m per foot, so a metric table measures exactly as an imperial one. Raised by the user on 2026-10-13; post-launch.

### Hex grids

Scenes are square or gridless, and a square is the System's base square (5 ft in D&D 5e). Candidate: a hex grid kind, with hex distance counting for range, reach, movement and areas, using the same base-square length per hex. Raised by the user on 2026-10-13; post-launch.

### Hazard and trap tools

MOVE-3 ships the small version: the GM places zones through the zone node map, types spot and disarm DCs, and reveals or disarms by hand. Candidates:

- a trap library of presets dropped onto a Scene;
- a Scene sidebar listing every zone, highlighting each on the map on hover;
- picking a roll card's result as the spot DC instead of typing it;
- a GM trigger that fires a zone on a chosen creature, for a botched disarm;
- the 2024 caltrops and ball bearings rule (first entry per turn, Speed 0, no half-speed bypass), as a System option.

Raised by the user on 2026-10-14 during the hazards and traps design; post-launch.

## Other future enhancements (parked)

### Adventure Module Packages

Allow creators to assemble reusable Game-System-bound packages for GMs from existing UUID-backed
content: NPCs, Encounter Blueprints, maps, handouts, reference material, and Campaign preparation.
Packages compose and share existing authored objects; they do not introduce another mechanics engine,
historical source versions, arbitrary scripts, or user-created Game Systems. Define licensing,
ownership, dependency updates, installation, and Marketplace behavior only after the core rules
lifecycle and Encounter Blueprint model are accepted.

- Rich chat extensions: typing indicators, reactions, threads, and attachments.
- Semantic note links/hover tooltips (campaign places, people, and lore references).
- Multi-calendar support and reversible GM clock editing.
- Additional notification channels beyond Phase 05 in-app/email and Phase 11 native push.
- Structured Campaign knowledge beyond notes: NPCs/people, places/settlements, factions, quests/conflicts, relationships, timelines, and player-knowledge versus GM-secret projections.
- Session-prep templates that a GM can customize or duplicate after the flexible Phase 06 prep blocks prove useful; no single prescribed prep method.
- Scheduling polls, recurring-session generation, external calendar subscriptions, and delegated scheduling roles after the Phase 06 schedule and RSVP model is proven.
- Privacy-aware post-session feedback such as stars/wishes or anonymous safety check-ins after the table-safety policy and moderation boundaries are defined.
- Professional-GM retention, onboarding, schedule-health, and table-performance analytics after paid-table operations produce enough data to define honest metrics without ranking GMs prematurely.
- Travel planning, weather, encounter/name/treasure tables, and other system-aware GM quick generators.
- Campaign-wide search and backlinks across notes, sessions, Characters, authored content, handouts, and future world entities.
- “View as player” and deliberate co-GM/assistant-GM roles with a separate permission model rather than treating every helper as the owner.
- Ambience libraries, playlists, scene audio, and player presentation controls after the VTT/media usage model is known.
- Optional session recording, transcription, recap drafting, and continuity extraction only after consent, privacy, retention, and cost policy are approved.
- Home-base, settlement, bastion, faction-reputation, and downtime trackers after Campaign and Vehicle ownership seams are stable.
