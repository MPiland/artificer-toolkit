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

- **Area push picks outside the ordinary area flow (ATTACK-7.T5d, D157).** An area push that needs a destination pick fails closed when the area settles through a GM removal, through a hit-point-pool area or a chosen-creatures action with no saves, or when one creature is moved two ways by the same action. No SRD action does any of these with a choice; hold the pick on those paths if content needs it.

- **Random fling direction (D157).** The Air Elemental's Whirlwind flings a creature in a random direction; its controller picks the square instead. Add a rolled direction if GMs ask for it.

- **Triggered Character auras while the source is down (D155).** A Character-sourced passive zone with an ENTER or turn trigger would still catch while its source is unconscious, because the spatial readers do not read Character play state. No SRD Character has such a zone. Thread an unconscious-source input through the spatial readers if homebrew content needs one.

- **Aura bonus pinned at placement (D155).** An occupant save bonus such as Aura of Protection pins the source's ability modifier when the zone is placed. A mid-Run Charisma change updates it only when the token is rebound.

- **A reactor dropped by melee retaliation keeps its Concentration until the next check (SPELLS-20.T6d2b, D153, D95).** When a Fire Shield or similar zone drops an opportunity attacker to 0 hit points, the movement's D95 end pass still looks only at the mover, so the reactor's Concentration is not ended in that settlement. Needs a holder that is both shielded and the target of a concentrating reactor; fix by running the D95 end over every damaged actor of the settlement.
- **Flaky lease-renewal test.** `apps/session-worker/test/nativeRoomAdmission.test.ts` ("renews the authorization lease with one read per half-lease...") once made 4 authorization reads instead of 3 (Tests 39111148417, attempt 1) and passed on rerun. Likely a timer-boundary race in the test clock. Fix if it recurs.

- **Fire Shield past 100 rounds or recast (D153):** the zone lasts the Run while its resistance expires after 100 turns, and recasting while it is up stacks a second zone; dismissing it early is not offered. A timed zone lifetime would close all three.

- **A cast-time pick on a movement reaction (SPELLS-30.T1, D148).** A Character reaction whose effect offers a CHOICE pick is still discovered as a movement reaction, then fails to prepare with a raw `CastChoiceUnavailableError` instead of being dropped as stale. No SRD reaction offers a pick; fix by skipping such sources at discovery when one does.
- **An authored pick past the option-list limits (SPELLS-30.T1, D140).** A CHOICE with more than 20 options fails the compiled-entry schema parse, which fails every action of that Character, not just that one action. Zone picks share this. No SRD spell comes near the limit; fix by making the per-candidate compile refuse it (MANUAL) when homebrew needs more.
- **A carried caster whose dependents are all outside the Run (D151).** The room loads none of those dependents, so it reinstates no Concentration, and damage in the Run stages no check for them. The caster's next Concentration still ends them. A START read of grants stamped with the Run's Characters would close it.

- **A margin rider outlives an early-ended parent (D149).** The Drow's sleep lasts "while poisoned", but curing or GM-ending the poison mid-sleep leaves the unconscious rider for the GM to end. A persisted effect-to-effect end link would close it.

- **Auras and spells that ignite flammable objects (SPELLS-20.T6, D144).** The Balor's Fire Aura and similar effects ignite unattended flammable objects; no object state is modelled, so the GM narrates it.
- **A GM private roll resent across a room epoch (QUALITY-1.T1).** The room refuses a private-roll nonce sent before the current epoch ("This roll was already made.") instead of replaying the stored roll, as chat now does. Rare (needs a reconnect across an epoch change between send and retry); fix by replaying from the room's retained-roll record.
- **Creatures that do not need to breathe (SPELLS-20.T4b3, D141).** Stinking Cloud's automatic success covers poison immunity only. No SRD 5.1 stat block states that a creature does not breathe, and the SRD undead and constructs are almost all poison-immune, so no breathing fact is modelled. Add an authored creature fact and a Character grant domain when homebrew content needs it.
- **Fleeing a source (SPELLS-29.T2):** the `CONDITION_SOURCE_FLEE` warning covers an Action other than Dash taken through `RESOLVE_ACTION` and area actions. Disarm, escapes and held-grant flows do not warn, and the rider never inspects the distance a move actually covers after the Dash.
- **Other failure-margin riders (SPELLS-27.T11, D149).** `failureMarginRider` covers a follow-up save after a hit whose rider adds a condition for the parent's duration. Still manual: a margin on a direct save (the Medusa's Petrifying Gaze, the Mummy's and Mummy Lord's Dreadful Glare), a margin that changes the parent's duration (the Homunculus bite: 1d10 minutes instead of 1) and a non-condition margin (the Ghost's aging). Extend the rider when one of these is played.
- **A failure-margin rider on an automatic save failure (SPELLS-27.T11).** The margin node compares the save total with the DC, so a save failed automatically (a paralyzed or unconscious creature's Strength or Dexterity save) probably applies the rider only when its total is also low enough (unverified). None of the three SRD riders is a Strength or Dexterity save; fix when one is.
- **Trait invisibility that also ends on using a named action (SPELLS-27.T10).** The Quasit (Scare), Will-o'-Wisp (Consume Life) and Duergar (Enlarge) invisibility also ends when the creature uses that action. No end event covers using a named action, so it ends only on an attack, a cast or Concentration; the GM undoes it by hand. Rare; fix with an action-used end event if it arises.
- **Invisible Characters in the target list (ATTACK-17.T4b, D131).** `unseenReason` reads `INVISIBLE` only for creature actors: a Character's conditions live on its Sheet and are `[]` in the player projection, so an unseen Invisible Character is marked `HIDDEN`. Rare (needs the GM to reveal an unseen Character the player does not control); fix by projecting the Sheet's Invisible fact when it arises.
- **A maintained-state owner Character that is not a Run actor has no room fixture (ROOM-6.T2, D-pending-room-6-t2).** The room test covers a GM-removed Character (D82; still a Run actor) but not a Character absent from the Run's actors: the memory store's `effects.create` requires the target actor in the Run, and the fixture lists Character dependents only through Run actors. Production loads such an owner through `maintenanceCharacterOwnersAtLoad`, the same path the GM-removed case exercises. Fix by seeding a `CHARACTER`-owned effect when the fixture gains a Character table.
- **Teleport undo after the turn ended (SPELLS-28.T1b).** The GM's scene undo restores a spent teleport allowance only on the current turn's record. Undoing a teleport move after its turn ended restores the position but leaves the allowance spent, so the cast's own undo is then refused. Rare (needs an undo across a turn boundary); fix by finding the record by the spending command's id regardless of turn.
- **Stale teleport allowance at commit (SPELLS-28.T1b).** If the cast is undone between the room planning a teleport and its commit, the commit fails with a generic error instead of `TELEPORT_UNAVAILABLE`. The rollback is correct and a retry reports the refusal.
- **Teleport sight is "explored", not line of sight (SPELLS-28.T1b).** A `VISIBLE` destination (Misty Step) must be an explored point for the mover; with fog off every point counts, and a previously explored point behind a wall still counts. Replace with a line-of-sight test when the Scene gains one.
- **Spell attacks count as casts for ON_CAST_SPELL (REACTION-4.T3h, D136).** `castsSpell` is true for a Creature spell-attack action, so ON_CAST_SPELL effects fire for it, but it is not counterable (only `spellCast` actions are offered a counter). Left unchanged by D136; revisit if a rules effect keyed to real casts misfires.
- **A spell link on a Creature capability (REACTION-4.T3h, D136).** `spellCast` carries only `castLevel`. Linking the System spell for display, with a save-time check that `castLevel` is at least that spell's level, is a nice-to-have.
- **Undoing a hit that ended a Character's form (SPELLS-28.T4c, D130).** The form ends and any carried-over damage lands on the Sheet in the same batch; a scene undo of that damage action restores the Sheet but does not put the form back. Undo the cast instead, or recast.
- **A hit-point-maximum effect applied or ended while a Character wears a form (SPELLS-28.T4c).** The effective maximum is the form's plus its effects; the form's hit points are not re-clamped when a maximum effect ends mid-form.

These are rare paths, roughly under 5% of sessions, whose failure is visible and recoverable (user direction, 2026-10-15). Fix one when real use shows it happening.

- **A Self cube smaller than a grid cell beside a token smaller than the leftover (SPELLS-23.T1):** when the cube's edge plus the caster's side is no more than one cell, no grid line gives the face a shared length with the side, and `cubeFromSideOutline` places the cube on the nearest line, touching the caster at most at a corner. No SRD Self cube is that small; the fix is to place the face flush at the side's start when no grid line qualifies.
- **A Self cube's face can miss the press on an off-grid caster (SPELLS-23.T1):** each grid-line place owns an equal share of the side, so for a caster whose side does not sit on grid lines the picked place may not contain the pressed point. Nothing reads the origin for cover; the aim is still the side and the place the caster chose.

- **Spells and features whose printed end is a GM call (SPELLS-27.T5):** Animal Friendship, Awaken, Calm Emotions, Eyebite, Mass Suggestion, Mislead, Modify Memory, Phantom Steed, Produce Flame, Project Image, Sequester, Suggestion and Oath of Devotion's Turn the Unholy are closed rules or manual adjudications that create no effect, so a harm, damage, attack or cast that ends them is applied by the GM at the table. They are listed with their covering mechanism in `packages/source-data/src/srd/endEvents.test.ts`. Authoring any of them as a real effect removes its entry there.
- **Charm Person's save advantage while fighting (SPELLS-27.T5):** the target has advantage on the saving throw if the caster or their companions are fighting it. No conditional save advantage exists on the spell's save, and it is not an end event.
- **Waking a Brass Dragon's Sleep Breath target with an action (SPELLS-19.T3):** the unconscious condition ends on damage taken, but "someone uses an action to wake it" is not a commit event; the GM ends the condition by hand.
- **A Creature attack with no ability bonus escapes an ability-scoped attack grant (SPELLS-19.T3b):** a Creature's attack ability is read from its first damage outcome's `ABILITY_BONUS`, so an attack whose stat block carries fixed damage only (no ability bonus) is never matched by Weakening Breath's Strength-scoped disadvantage. The SRD stat blocks carry 285 such bonuses, so it shows only on a hand-authored Creature; the fix is an explicit attack ability on the Creature attack.
- **A projectile aimed again at a creature whose form its earlier dart ended (SPELLS-28.T2, D130):** the dice settle each entry against the hit points the earlier entry left, which are the form's, so the commit finds the actor back at its origin's hit points and refuses the second dart as stale. The caster re-aims; the fix is a settle that follows the revert (carry-over included).
- **Undo of a damage action that auto-reverted a creature form (SPELLS-28.T2, D130):** the revert restores the form's hit points, which `restoreHitPoints` refuses once the actor is out of its form. The GM corrects the hit points by hand; a form-aware undo can follow if it shows up in play.
- **"You must have seen the creature" for Shapechange and Wild Shape (SPELLS-28.T4, D130):** the filtered form choice checks creature type, challenge-rating cap and excluded speeds against the System's creature list, but not whether the caster has met that creature. The table polices it; a per-Character known-forms list can follow if it shows up in play.
- **Willing Polymorph targets still roll the save (SPELLS-28.T4, D130):** a willing creature can fail on purpose, and the GM can override the roll. A "willing target skips the save" choice needs a willing-target input on the command.
- **The creature picker is not narrowed by the filter (SPELLS-28.T4, D130):** the Action drawer lists the System's creatures; the Worker refuses one the filter rejects at cast. Narrowing the list by type and challenge-rating cap is a presentation change.
- **Failed-counter binding is by reactor id only (REACTION-4.T3c):** persistence binds a failed Counterspell spend to the held pause by the reactor's id, without comparing the pin, the sealed choice or the d20. Similarly, the reactor-is-target merge doesn't compare the failed receipt's Character version. Both inputs come from the room's own planner, so a mismatch needs a room bug, and the GM can undo the action.

- **A free GM pick for an attack on a square (ATTACK-17.T4):** the GM chooses only among the creatures whose token covers the square. Letting the GM name any creature (a creature that dodged into the square, a large creature the token footprint misses) is a larger rule and is deferred.
- **Square attack answer after the pending index is lost (ATTACK-17.T4a):** a retried GM answer replays by its derived child command id; if the room journal has forgotten the pending and the occurrence index, the retry is rejected as stale rather than replayed. Rare and recoverable by aiming again.
- **A cast that ends the caster's Concentration while the same command damages that Concentration (SPELLS-27.T3b):** the concentration plan reads the stored slot before the cast's ended effects are deleted, so a Concentration-held Invisibility caster who casts Shield (or sits in its own damaging area) and is still hit in the same command fails the commit with a concentration-child error; the GM resolves it by hand. Fix by planning concentration against the slot as the cast leaves it, or by binding damage before the effects end.
- **Square attack range is checked on the GM answer (ATTACK-17.T4a):** the aim seals the candidates, and the ordinary attack run on the named creature raises its normal range warning then, so the player learns of an out-of-range target only after the GM answers.
- **Frightened's sight gate outside attacks and Disarm (SPELLS-29.T1):** reactions (opportunity attacks, cast reactions), legendary actions and movement-passage contests prepare without `loadSourcesSeen`, so a sourced Frightened keeps its disadvantage there even when its source is out of sight. Rare (a frightened creature reacting or contesting while its source is hidden); the GM can set the roll mode. Fix by passing the loader at those preparation sites.
- **A condition held both sourced and unsourced counts as unsourced (SPELLS-29.T1):** when two effects own one Frightened and one recorded no source (a hand-applied or immediate untimed frighten), the condition reads as unsourced and stays always on. Rare and conservative.
- **The "Its Source" toggle shows on relationship conditions (SPELLS-29.T1):** the authoring map shows `recordsSource` on every condition outcome, including actor-relationship conditions, where it has no effect.
- **Frightened sight reads the Scene once per source (SPELLS-29.T1):** `readNativeLiveSourcesSeen` reads the holder's perception Scene for each recorded source, beside the attack's own read. One source (the usual Fear or dragon) is one extra Scene read for an attack by or at a sourced Frightened creature; a creature frightened by several sources pays one per source. Fix by reading the Scene once per holder.
- **A Frightened source bound to another Scene (SPELLS-29.T1):** if a recorded source's token is bound on a Scene other than the holder's, the perception capture refuses as stale and the attack fails instead of treating the source as unseen. Not known to be reachable (an Encounter's tokens share one Scene); the GM recovers by removing the condition.
- **A repeat attempt gate with roll influence on one save (SPELLS-29.T1a):** the schema refuses `repeatAttemptGate` beside `repeatRollInfluence`, since the two would share one pinned perception requirement. No SRD save needs both. Fix by pinning each its own requirement fact.
- **Repeated saves made at once on application ignore their perception options (SPELLS-29.T1a):** the schema refuses a `repeatAttemptGate` on such a save, and `repeatingImmediateFollowUpSavePlan` compiles without a `repeatRollInfluence`, which it drops. No SRD immediate repeated save authors either. Fix by carrying both through that plan's turn-end recurrence as the direct plan does, then lift the schema refusal.
- **A refused repeat attempt's graph still reports a save result (SPELLS-29.T1a):** the gated graph disables only its d20, so the save-test node runs on the settled minimum and its outputs read as a failed save; interpretation and the turn-result schema treat it as refused. Nothing reads those outputs today. Fix by feeding the allowed fact into the save-test operation so it emits no result when refused.
- **A failed counter keeps its reactor's cast-ended effects (SPELLS-27.T3b):** a Counterspell that fails its check is still a cast, but only a successful counter ends the reactor's own cast-ended effects (for example Invisibility); the failed-counter receipt carries `applications: []`. Ending them needs the effects threaded through `planNativeFailedCounters`, the failed-counter spend and the target-rides path (`targetFailedCounterSpend`).
- **A Scene edit while a square attack pends (ATTACK-17.T4a):** the candidates are sealed with the Scene version; a token moved afterwards does not change them, and the child attack re-reads the Scene as any attack does.
- **An empty square is refused until T4b (ATTACK-17.T4a):** a player who aims at a square with nobody on it gets `TARGET_UNAVAILABLE`, which tells them it is empty. T4b replaces it with the guaranteed-miss root.
- **A second Action Surge in one turn (ATTACK-9.T3):** SRD Action Surge is once per turn, but the feature-action path has no per-turn use cap, so a level-17 Fighter with two uses can spend both in one turn. The second one sets the same action count and wastes a charge; the GM can undo it. The fix is a per-turn use cap on feature actions, authored in data for Action Surge.
- **Live-backend script spawn failure:** if `yarn` can't start, `scripts/liveBackendValidation.mjs` throws an unhandled rejection instead of a step error. This is dev tooling; the run still fails, just with a noisier log.
- **`--fresh` guard:** `liveBackendValidation.mjs --fresh` checks the container by name only. A different container given the same name would be reset.
- **A creature named twice by a projectile list that leaves a condition (SPELLS-19.T1):** `advanceAreaPrepared` does not add the effect an earlier entry created to the creature's `activeEffects`, so a repeated-target action whose outcome applies a condition reads the condition as already present when it records the second entry's baseline. No SRD projectile action applies a condition; it needs an authored list action that does.
- **Concentration area over the per-actor dependent cap (SPELLS-19.T2):** one maintained state holds an effect per failed creature, and `MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR` (64) caps them. An area that fails more than 64 creatures at once (a Scene of 65+ tokens inside one sphere) fails the commit with a generic store error instead of a domain rejection.
- **Concentration area where every creature saves (SPELLS-19.T2):** no effect is created, so the caster's earlier Concentration is not replaced. This mirrors the single-target path, where a made save also leaves the earlier Concentration running.
- **Concentration cast on a creature named twice (SPELLS-19.T2):** the chosen-creatures variant shares the area maintenance path but has no test that names one creature twice under a Concentration outcome.
- **Chosen-creature list and a moved Scene (SPELLS-8.T12):** the list commit (`areaCommitPersistence.ts`, `input.area === null`) does not re-read the Scene, so a token moved between planning and commit (the sphere membership or range was checked at plan time) is not re-checked. Single-target commits re-read it. Only a Scene edit landing inside one command's await gap triggers it, and the GM can undo the cast.
- **Range outline of a shaped chosen-creature list (SPELLS-8.T12):** Mass Cure Wounds draws no range outline from the caster (`enforcedRange` reports UNLIMITED for the creatures; the picked point carries the 60 ft range), yet the room warns for a point beyond it.
- **Replay of a completed chosen-creature cast:** `actionAdmission.ts`'s replay branch expects a mechanics-batch output, so a retried command id after the room journal has forgotten it may raise "Stored Encounter action receipt mismatch." Unverified; point-area roots may share it.
- **Pool-paid attack reactions (SPELLS-8.T8):** an attack reaction cast from a limited-use or fixed-level pool (for example Shield granted once per rest) is not offered, because the reaction receipt carries no pool spend (`nativeEncounterAttackReaction.ts`). The cast is still available from slots and as a normal action; offering it needs the reaction receipt to spend and restore the pool use.
- **Sight-gated saves (ATTACK-10.T4):** Danger Sense is not lost while Deafened (no holder-state predicate for it), a sight-gated save contributor gives nothing to the save inside an attack's rider, and a flagged grant scoped to a Condition or Rule applies to base saves only. A point area's GM reason names the caster, not the origin, and lists no Sense. Each needs a rarer authoring shape than the SRD uses.
- **Rage on outright death:** a grant that ends only on a condition (SRD Rage ends on Unconscious) is not ended when its holder is `DEFEATED`, for example a raging Character killed outright by massive damage. The grant stays visible on a defeated holder, and the GM can end it (`encounterGrantLifetimes.ts`).
- **Pact Magic slot level for upcasting:** when the only slot a Character has is a higher Pact Magic slot, the cast keeps the spell's own level. So a Cleric/Warlock casting Cure Wounds from a 2nd-level Pact slot rolls 1d8, not 2d8. The player can choose the higher-level cast candidate instead.
- **Creature type warning for a Character target (SPELLS-8.T13):** a Character's facts carry no creature type, so Hold Person on a player Character never raises `TARGET_CREATURE_TYPE_EXCLUDED` even though a Character's race implies a type (Humanoid in the SRD). The GM sees no warning, and the spell works, which matches the SRD for Humanoid Characters.
- **Telepathic Bond gaps (SPELLS-28.T3):** the web shows no bond badge, because the client has no active-effect projection for any effect kind (a new read-side projection, not bond-specific). A Character target's Intelligence is unreadable (facts carry none), so the Intelligence warning is raised for Creatures only. A bonded creature that leaves the Encounter keeps the member id in its peers' frozen bond. Bonds change no rule; each is provenance until the duration ends.
- **Sneak Attack on Feature-sourced attacks and movement undo (ATTACK-9.T2d):** a Character on-hit rider merges only onto equipment-sourced attacks, so a Feature-sourced attack (a Bite Feature) gets no Sneak Attack. A movement opportunity attack has no GM undo, so its spent once-per-turn use is only released when the turn ends.
- **Once-per-turn limits outside the general attack path (ATTACK-9.T2d):** Legendary Actions, Disarm, the target's own reaction, area rules and the read path supply no turn-use loader, so a homebrew attack authored `ONCE_PER_TURN` there is refused as unsupported (fails closed). The immediate follow-up save branch applies neither restrictions nor the usage limit. More than 16 distinct once-per-turn keys spent by one actor in one turn would fail the row parse. Two commits racing on one key hit the version fence first; the persistence backstop throws a plain error.
- **Projectile at a creature already at 0 hit points (SPELLS-26):** a second dart of Magic Missile at a creature an earlier dart dropped still resolves against the chained hit points and is reported with the rest; the room does not warn or redirect it. Rare, visible and recoverable by undo.
- **Duplicated digest prose:** the README restates the image digest that `.github/workflows/live-backend.yml` pins, so the two can drift when the digest is bumped.
- **A reaction that only adds a follow-up is refused after being offered (REACTION-4.T2):** `resolveNativeActionReaction` requires a used reaction to change the attack's bound facts or the reactor's defenses. A Tiefling casting Absorb Elements against fire already resists it, so the use throws a plain error after the offer; the player can decline and the pause stays. Rare, recoverable. The fix is to scope the must-change check to `ATTACKED_SELF` and refuse at discovery.
- **Grant- or rider-added damage types are not seen by reaction discovery (REACTION-4.T2):** `attackHitDamageTypeIds` reads only the attack's authored outcomes, so a damage type added by an active grant or rider does not offer an Absorb Elements named for it. (The crit-only over-offer is fixed in REACTION-4.T3.)
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
- **Allies are offered Counterspell (REACTION-4.T3b-2):** every Character in range with the spell is offered it for a cast, including the caster's allies, as the rules allow. A per-player preference to auto-decline allies' casts is not built.
- **Each cast loads the other Characters (REACTION-4.T3b-2):** discovering Counterspell reads every other Character in the room per cast. Cheap for a table; revisit if a room's Character count grows.
- **A reactor with no token on the Scene is not offered Counterspell (REACTION-4.T3b-2):** range cannot be read, so the offer fails closed.
- **A countered concentration spell and one-roll grants (REACTION-4.T3b-2):** a countered cast starts and ends no Concentration and consumes none of the caster's one-roll grants.
- **Eight offered reactions cap a cast (REACTION-4.T3b-2):** each eligible slot level is a separate option and a cast pause holds at most eight, so a reactor with slots 3 to 9 plus a second `SPELL_CAST` reaction makes the pause fail to build and the cast cannot be made. Needs a level 17 or higher Character with two such reactions.
- **A user-authored `SPELL_CAST` reaction that rolls or cancels conditionally is offered, then refused on use (REACTION-4.T3b-2):** discovery checks only that a cancel outcome exists. Declining still works. T3c's authored check removes the roll case.
- **The drawer names no cast for a nested counter offer (REACTION-4.T3d):** a holder offered a counter to a Counterspell sees the same menu as for the original cast; which cast it answers is not shown.
- **Canonical definitions, Systems, sources and catalogues are still insert-or-identical (PLATFORM-18.T1):** only authored subjects are replaced in place. Changing a reusable definition, System, content source or catalogue record in the corpus fails the seed with `Canonical content conflict`. The fix is to extend the in-place replace to those records.
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
- **A spatial move that catches many prompted creatures can exceed the 256-command cap (SPELLS-20.T1):** each prompted candidate now appends one d20 command plus one per damage die to `resolutionCommands` (capped at `MAX_SPATIAL_CANDIDATES` in the pending root and the receipt metadata), so about 256 / (1 + dice) prompted candidates in one move fails the parse mid-occurrence. Derive the bound from candidates × (1 + max dice) or refuse at plan time if a real table reaches it.
- **A placed zone whose source actor left the Encounter leaves its damage-dice prompt unanswerable (SPELLS-20.T1, unverified):** `decisionActorIds` reads the source actor to find the roller; a removed source probably throws, leaving the pending entry for a GM revert. Verify and fall back to the target's controller or the GM.
- **A carried effect does not resume for a Character that joins an ACTIVE Run (SPELLS-5.T10, D151):** only a PREPARED Run's START resumes carried effects, so a Character added mid-fight keeps its Campaign-minute expiry until the Run completes or the clock reaches it. Resume on the actor-add command when a table hits it.
- **A carried effect held only through a worn form does not resume (SPELLS-5.T10):** `persistCarriedEffectResumes` lists each Character actor's own effects; one carried on a worn form keeps its expiry. Rare, and the clock still ends it.
- **Removing a reinstated caster from the Run leaves the Concentration standing (SPELLS-5.T12, D151):** an actor removal ends no maintained state, so the relinked grants keep their link until the Run completes, when they detach and carry over again. An action-made Concentration behaves the same today.
- **Undo cannot restore a relinked carried grant (SPELLS-5.T12):** an effect restore derives `sourceEncounterId` from the definition's origin, which names the earlier Run, so restoring a relinked grant would fail its read check. Rare: it needs an undo of a command that ended one relinked grant alone.
- **A reinstated Concentration emptied by its own dependents does not record the caster (SPELLS-5.T12):** when the last relinked grant expires or is consumed, `TERMINATE_WHEN_EMPTY` deletes the state without appending the caster to `concentrationCasterCharacterIds`, so stamped grants on Characters outside the Run stay until the caster's next Concentration or the clock ends them.
- **Crusher's move is not optional (ATTACK-7.T5):** the homebrew Crusher fixture moves its target on every qualifying hit, because an on-hit rider's only player choice is a paid one (`optionalOnHit: SPELL_SLOT`, D123). Candidate: a free optional rider kind, so "you can move it" spends the once-per-turn use only when chosen.

### Code-quality refactors (deferred from Phase 8.2, 2026-10-17)

The user cut these from pre-alpha scope for time to market (D145 amendment). They came from the five-surface code-quality audit; QUALITY-1 (diverging duplicates) and QUALITY-3.T1a (lint in CI) shipped. Re-register as PBIs when picked up.

- **QUALITY-2 Each rule has one implementation.** Temporary-HP-first damage and temporary HP non-stacking, Polymorph carry-over, action source-spend settlement, the Character campaign context, currency group validation, the random number source, System-dispatched armor class and the mechanics receipt validation each have one implementation called from every site, with existing tests green and no assertion weakened. Planned work: Consolidate each listed rule into its owning package and delete the copies. Includes Convex endCarriedConcentration, a local copy of the shared endChosenConcentration (found by QUALITY-1.T1).
- **QUALITY-4 Contracts and primitives come from one place.** Checksum, integer, boolean and uniqueness schema primitives, the Scene command input unions, the mutable Scene table list, account and import-preview validators, and web-local types come from packages/schema; the campaign DTO carries a canManage flag replacing the 12 owner-and-active checks; token control and formatting helpers have one shared home per package. Planned work: Move each duplicated contract and primitive into packages/schema or a domain-named shared module and update every caller.
- **QUALITY-5 Pre-launch shims and dead code are gone.** Legacy optional fields are migrated in development data and made required or deleted, old schemaVersion branches are normalized at load, completed one-off migrations are deleted, dead exports, re-export chains and compatibility aliases are removed, frontend names drop the word runtime, and the 19 legacy authored URL redirect routes are removed. Planned work: Migrate development data, tighten the schemas and delete each shim, migration, alias, dead export and legacy redirect route.
- **QUALITY-6 The live room is split along its seams.** Every room command goes through one journaled-command path; nativeLiveSessionRoom is a thin router over admission, command pipeline, per-scope executors, transient relay and Scene cache modules; the single-target and area encounter planners are split into phases; the web holds one live-session WebSocket per campaign. Planned work: Extract runJournaledCommand, split the room and planners by responsibility, and share one live-session connection per campaign on the web.
- **QUALITY-7 Monolithic modules are split by responsibility.** effectActionCompiler, sheetCommandReducer, path.ts, facet.ts and nodeDefinition.ts are split by responsibility, with the duplicated node maps built by one factory and their casts removed; the authoring form context becomes a narrow read context with explicit props; CampaignVttStage, the VTT Scene renderer and the form renderer factories are split into plain modules and components; guided authoring forms are typed by their schema DTOs. Planned work: Split each listed module along its responsibilities and remove the casts and single-use factories that the splits expose.
- **QUALITY-8 Each game System has one policy bundle.** Generic encounter and character modules resolve System behaviour through one per-System policy bundle instead of direct dnd5e imports, one-entry maps and separate registries; compiled graph node roles are exported constants or graph tags rather than repeated string ids. Planned work: Introduce the per-System policy bundle, migrate every lookup to it and replace string node ids.
- **QUALITY-3.T1b (lint).** knip in CI for dead exports, files and dependencies, configured per workspace (entry points: routes, Convex functions, Worker entry, stories, tests); its current findings deleted (deleting unused code is pre-approved) or listed as public package entry points.
- **QUALITY-3.T1c1 (lint).** Package boundary rule (D145): survey each web import of rules-runtime (38), source-data (38), authoring (6) and design-system (5) and each Convex and Worker package import, propose the allowed matrix in the workbook for an orchestrator ruling, then enforce it in lint with the crossing imports fixed.
- **QUALITY-3.T1c2 (lint).** Root-barrel ban: codemod the 1,072 root @artificer-toolkit/schema and @artificer-toolkit/shared imports in non-test code to their narrow subpaths, then make the root barrel import a lint error.
- **QUALITY-3.T1d (lint).** Large-file flag (D145): a non-test file over 1,500 lines fails lint unless it is in a reviewed allowlist. Each of the 18 current files gets a responsibility review: split at a real seam, or stays allowlisted with a one-line reason. The allowlist may only shrink.

### Pit Fiend Fear Aura as a passive zone (D147)

The Fear Aura stays an exact CLOSED_RULE. Converting it to a passive zone (SPELLS-20.T6b) needs four generic zone options: a placement filter by disposition relative to the source, a zone condition that ends at the start of the target's next turn, per-zone, per-target immunity for the rest of the Encounter after a made save, and suppression while the source is incapacitated (generalizing the defeated rule).

### Margin-of-failure riders on direct saves (D149)

The failure-margin rider is wired only on follow-up saves. Direct-save actions that author one (Medusa, Mummy and Ghost gazes, Homunculus) fail closed at compile until the direct save path learns the same margin node.

### Release a grapple to draw (D152)

Drawing a weapon while every hand holds a weapon or a grappled creature is refused today, so the grappler releases first. D107's prompt to release a grapple as part of the draw would save that step.

### Touch and Heated Body retaliation (D153)

The Balor's "touches the balor" clause needs a touch event, which the rules runtime does not model. Heated Body (Azer, Remorhaz, Salamander) is data on D153's `MELEE_HIT_ON_SOURCE` zone option and can be authored once T6d lands.

### Hand-rolled retaliation dice (D153)

Melee-hit retaliation dice are system-rolled even when the zone source rolls by hand. Offering the hand roll would pause the attack for the defender, as turn zones pause today.

### Zones that block vision (D154)

A zone with `BLOCKS_SIGHT` (Wall of Fire, Wall of Thorns) is projected, but Scene vision and line of sight read only Scene barriers. Feed sight-blocking zones into the vision and line-of-sight checks.

### Disarm defender picks its check (D152)

Disarm seals the defender's check from the initiator's selection. The optional rule lets the target choose Athletics or Acrobatics. Seal both checks and let the `CONTEST_CHECK` resolution pick, as Grapple does.

### Wind Wall blocks projectiles and gases (D154)

Wind Wall's appear save ships in SPELLS-4.T1g. Its deflection of small projectiles, its block on gases and fog, and its ranged-attack interaction are not modeled yet.

### Web obscures and burns (D156)

Web's restraint, escape and difficult terrain ship in SPELLS-4 and SPELLS-20.T4d. Its light obscurement and its burning (a 10-ft cube burns away in a round, dealing 2d4 fire to a creature that starts its turn in the fire) are not modeled yet.

### Day-scale durations on the Campaign clock (D156)

Durations stop at hours and 10,000 turns, so Awaken's 30-day charm ships as a GM ruling. Day-scale durations counted on the Campaign clock would let it, and other effects that last days, run on their own.

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

### Turn-boundary effect order chosen by the creature

SPELLS-20.T4b2b resolves a turn boundary's effects in a fixed, deterministic order: the actor's own start- or end-of-turn effects first, then the zones it is in (such as Spirit Guardians), each batch by effect id. The SRD lets the creature whose turn it is choose the order of simultaneous effects. Candidate: an order prompt for that creature when more than one effect is due. Raised 2026-10-17 during SPELLS-20.T4b2 design; post-launch.

### Death save outcome on the tabletop

A death save rolled in play shows its outcome only on the Character Sheet (CharacterSheetDeathSaves); the tabletop shows the prompt, then the decision settles, with no tally, token mark or log entry for the player or the GM. Candidate: a success/failure tally on the dying creature's token or in the play log. Raised 2026-10-17 by the ATTACK-2.T2 journey; post-launch.

### Level-gated check on an effect (Dispel Magic)

REACTION-4.T3c authors the level-gated check as `higherLevelCheck` on a `SPELL_CAST` reaction binding (roll only when the triggering level exceeds the level the reaction is cast at; DC = base DC + the triggering level). Dispel Magic is not a reaction: it ends an effect of a given level on a target, and an effect above the slot owes the same check. Its gate needs the same shape authored on the effect side, with the check resolved by the same rules-runtime requirement, before Dispel Magic can reuse it. Raised by Phase 8 on 2026-10-16; post-launch.

### Object forms, permanent True Polymorph and Shapechange re-forming (SPELLS-28.T4, D130)

D130 swaps a creature for a creature. Candidates, each its own rule: True Polymorph turning a creature into an object and an object into a creature; True Polymorph's permanence after an hour of Concentration (the form outlasting the effect); and Shapechange's action to take a different form during the duration. Until then the GM adjudicates these by hand. Raised by the architect on 2026-10-16 while ruling on SPELLS-28.T4; post-launch.

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

- Eyebite authored from core options (choice of effect, per-turn re-target, distance end) reusing the SPELLS-29 flee rider.

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
- **Creature forms, later pieces (SPELLS-28):** the form's defenses, speeds, senses and proficiency merge (rest of T4d), a per-form authorable retained-ability set (Polymorph replaces mental scores), object forms, True Polymorph permanence and Shapechange re-form.
- Home-base, settlement, bastion, faction-reputation, and downtime trackers after Campaign and Vehicle ownership seams are stable.
