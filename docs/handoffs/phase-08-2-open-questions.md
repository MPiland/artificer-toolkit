# Phase 8.2 open questions

> Living list of questions waiting for the user's answer. Answer inline under **Answer** (or in chat); answered items move to [Resolved](#resolved) with the decision. Decisions made on the user's behalf are summarized in [Decisions to review](#decisions-to-review); the full reasoning is in the [handoff Decision log](phase-08-2-convex-cutover.md#decision-log-delegated-for-user-review).
>
> Updated: 2026-09-26.

## Open

_(none)_

## Decisions to review

Made on your behalf while you were away (Foundry baseline, Roll20 as a second reference). Say "override Dn" to change any of them.

- **D1** Development proofs drive Encounter commands through the Session room, not admin-key shortcuts.
- **D2** Local deploys and resets are part of local validation (staging and production still need approval).
- **D3** Domain rejections carry a code and a user-safe message; the room forwards the message.
- **D4** Magic ammunition is chosen per weapon, auto-selected when only one stack fits, and counted down per attack (Phase 8.3).
  - **Override (user, 2026-09-25):** ammunition tracking is a Campaign option the GM sets, because some GMs don't track ammunition. With tracking off, the chosen ammunition's bonuses still apply but nothing is counted down.
- **D5** `maxBonus` is removed (unused; duplicates authored +N modifiers).
  - **User question answered (2026-09-25):** capped bonuses such as medium armor's "Dex (max 2)" are expressed with the **Min**/**Max** fields on the modifier's value (`packages/shared/src/domains/grants/maps/modifier.ts`), which the rules enforce, and a magic item's +N is its modifier's value. `maxBonus` was an unconsumed duplicate, so homebrew authors lose nothing. The decision stands.
- **D6** Unarmored AC formulas choose the best instead of stacking.
- **D7** Character maximum HP is stored on the Character through one persistence helper (updates after a content republish on the Character's next write; the Sheet is always live).
- **D8** Displayed maximum HP includes active reductions (for example a vampire's bite).
- **D9** "Auto-roll my dice" defaults on and is stored server-side (it only rolls; it never chooses).
- **D10** GM void: a paused action is cancelled whole, declinable choices resolve as decline; turn-flow steps aren't voidable because the GM can answer any prompt.
- **D11** Soft enforcement: action economy, resources, range, `requiresEquipped` and target disposition warn with a logged "Do it anyway" (GM badge); authorization, stale versions, missing targets and a player acting out of turn stay hard.
- **D12** GM undo reverts the last action exactly, or refuses and explains when an exact undo isn't possible.
- **D13** Every Run actor has a GM-editable disposition (Friendly, Neutral, Hostile), like Foundry token disposition; flanking uses the same field.
- **D14** The action drawer marks already-unavailable actions with their reason before selection.

* **D15** `REACTION_COUNT SET_VALUE` (only SRD use: Shocking Grasp's "can't take reactions" on the target) ships with APPLY_GRANT in Phase 8.3, when granted effects start applying. Until then it stays accepted with no consumer.
* **D16** Barbarian Fast Movement has no mechanics yet; it's queued with the class-mechanics follow-ups.
* **D17** Disposition is the single source of hostility. Targeting, flanking and movement reactions all read actor disposition; sides remain only for side-initiative ordering.
* **D18** A recommended roll mode's reason ("Advantage: Flanking") is labelled from the contributor evidence the engine already records, not from a separate labeling system.
* **D19** A roll on an actor the initiator doesn't control goes to that actor's controllers, even when the GM initiated the action; the GM can still answer any prompt. (Foundry: players roll their own saves against the GM's Fireball.)
* **D20** "Waiting on the GM" survives a page reload (server signal), and bound-token drag previews follow actor control, the same rule as commits.
* **D21** Contest rolls keep the rules-derived roll mode for now (contest evidence stores faces only); the roll-mode override applies to ordinary d20 rolls.
* **D22** V07 (movement) is reopened for player agency: player token moves outside Encounters, bound-token moves that follow actor control, and remaining movement shown but not enforced. Every ADR 0034 item is attached to a ledger case, so no pre-beta scope sits outside the acceptance count.
* **D23** Auto-roll applies to every roll: remaining sibling Concentration checks honor the roller's controller preference. Queued for the next Encounter slice.
  - **Implementation:** every auto-rolled check commits in the same transaction as the answer. The Encounter version advances once if any check in that commit failed, and the replay guards count failures across all its checks. This was chosen over one server-issued command per auto-rolled check, which would need a synthetic actor to authorize those commands.
  - **Approved (user, 2026-09-25), on one condition:** every prompt and every auto-roll must be visually distinct and clear.
    - Each auto-rolled check gets its own roll-log/chat entry showing:
      - the actor;
      - what triggered the check (the source and its damage);
      - the DC, the roll and the modifier;
      - whether concentration was kept or lost.
    - Checks are never batched into one summary line.
    - Each pending prompt names its own actor and trigger.
* **D24** Recharge and Legendary Action dice for a creature the GM granted to a player go to that player, consistent with D19. Done in S4-a.
  - A hidden creature's app rolls stay out of the table roll log.
* **D25** A player's bound-token drag preview reuses the short-lived authority capture cache instead of one Convex capture per preview. Done in S4-b.
  - A Scene with Character vision still captures per drag preview, for the GM too, to recheck the Character revisions behind its vision.
* **D26 (approved 2026-09-25)** While a movement decision is pending on the presented Scene (an opportunity attack, a passage choice, a save), the room holds other token moves and door changes on that Scene. Players see "Waiting on a movement decision". The GM can answer for anyone, or cancel the decision if a player is taking too long.
  - Canceling declines the option (the reaction isn't taken and the movement continues) and releases the hold.
  - The decision drawer and chat show the player "The GM skipped this decision".
  - There is no automatic timer. The GM decides when the wait is too long, the same as at a table.
  - **Why:** the pending decision is planned against that exact Scene. Any Scene change underneath it would make the decision unanswerable.
  - **Tabletop parity:** this matches a real table, which pauses for a reaction. Foundry and Roll20 don't automate reactions, so they have no such hold.
  - **Rejected:** re-planning the decision against a changed map. That silently changes what the player was asked.
  - **Scope:** only that Scene is held. Chat, Sheets, other Scenes and GM tools keep working.
* **D27** Bound-token movement through the room commits to Convex first. That commit also advances the room's authority sequence, so Convex itself enforces ordering.
  - Before calling Convex, the room writes a write-ahead record. A new Worker-secret `resolve` route then settles any uncertain outcome (a timeout or crash) as COMMITTED or ABANDONED.
  - This replaces "reload the Scene and verify its checksum". That check breaks as soon as a Sheet write changes Character vision.
  - Movement responses also advance the room sequence.
* **D28** Movement responses skip the session-sequence check, because the Scene version pin already fences them.
* **D29** (superseded by D42) Movement decisions on a Scene that isn't presented keep the native Convex path. Nothing about that Scene is live-owned.
* **D30** When the GM grants a player control of a creature, the player also picks that creature's Legendary Actions at the end of other creatures' turns, not just its dice. This matches Foundry, where whoever owns a creature takes its actions, and follows the "players drive their own actors" rule. The GM can still pick or answer for it.
  - **Approved (user, 2026-09-25).** This is the rare case. A creature nobody has been granted, such as a typical boss, stays entirely with the GM: the GM picks its Legendary Actions and rolls its dice.
* **D31** Every settled rule check gets its own chat card, whether it was rolled by the app or answered by hand. This meets the D23 condition.
  - **Why:** today, auto-rolled checks leave no chat entry at all. Foundry posts every roll to chat.
  - **The card** carries a structured `ruleCheck` on the roll record. Concentration comes first, showing:
    - the actor;
    - the damage and its type;
    - the source (for example "Fire Bolt");
    - the DC, the roll, the modifier and the total;
    - whether concentration was kept or lost.
  - **The writer** is system-authored and not chat-rate-limited, because commands are already limited. Replay never duplicates a card.
  - **Visibility:** a hidden actor's cards go to the GM only.
  - **Prompts** name the actor and the trigger, for example "Concentration check for Mira: took 12 fire from Fire Bolt (DC 10)".
  - **Still to do:** the other automatic rolls (attacks, saves, Recharge, Legendary d20, movement reactions) get the same cards in a follow-up slice.
  - **Built in S4-a:** Concentration cards and prompts.
    - Cards are filed under whichever member settled the check, with the display name "Rules".
  - **Gaps in the S4-a cards:**
    - Movement damage has no source name yet.
    - A Character action without a label shows "took N damage (DC X)" with no source.
  - **Rolls with no card today** (audited, file:line in the S4-a report):
    - action attack rolls and target saves;
    - Disarm contests;
    - turn-effect saves;
    - Recharge;
    - Legendary d20;
    - initiative;
    - movement reaction attacks and saves;
    - Overrun and Tumble passage contests;
    - results of prompted rolls once they are answered.
* **D32** The room captures each Encounter command's volatile inputs in one bundled Convex read to reach the planned 3–4 round trips.
  - The bundle covers admission, Run inputs, every actor, Character inputs and the maintenance slot, and each part keeps its own read checksum for the commit fences.
  - The S4-b cache already made stable data free. After it, commands still take 6–8 round trips, all of them volatile reads.
  - This changes only the private room-to-Convex route, not any public contract.
  - Narrowing capture to the involved actors was dropped. Rules, Concentration and Cleaving read the whole Run, so a narrowed read would change results.
* **D33** A bound drag preview on a Scene with Character vision checks only the Character revisions behind that vision (one small read), not a full capture.
  - If the revisions are unchanged, the preview reuses the room's authority capture.
  - Rejected: reusing the capture blindly for a 2-second window. That could briefly show a token to a player who just lost sight of it.
  - Commits keep the full check.
* **D34** Changing whether an import job is visible bumps the System revision, so commit fences and the room cache both see it. Before this, neither could.
* **D35** Health display details (S6h):
  - Near death is 25% or less of maximum HP, including 0.
  - An actor's controllers, including a Character's own player, always see exact HP.
  - The GM always sees exact values, in the tabletop drawer too.
  - "Share health state" applies only to public, non-Character creatures and reads "The ogre looks bloodied."
  - Other players never see personality (traits, ideals, bonds, flaws), background (organizations, allies, enemies, backstory) or the Character concept.
  - The new health-display and party-visibility fields are required in stored state. Their values are set when the record is created, not filled in by schema defaults (pre-launch policy).
* **D36** The Campaign roster shows the portrait. Members get a read path for the portraits of Characters assigned in their Campaign, and nothing else.
* **D37** Remaining movement (V07.5) ships with S4-c, because the room's bound-movement commit is where movement is recorded.
  - Each Run actor stores the movement it has used this turn. The value resets when that actor's turn starts.
  - Only voluntary movement counts, at the path's terrain-aware cost. Forced movement and teleports don't count.
  - The budget is walking speed, doubled after Dash.
  - Players see "Movement 15 / 30 ft". Moving past the budget is allowed: Assisted mode shows a soft warning, and Manual mode shows the number only.
  - Foundry v13 tracks movement history per combat turn in the same way.

- **D38** How remaining movement (D37) is built, following up S4-c:
  - **Walking speed** is stored on the Character record through the same persistence helper as maximum HP (D7). Creatures read their stat block speeds.
  - **Movement used** lives in a small per-turn record keyed by Run, round and turn, outside the Run version and checksum. The budget is shown, never enforced, so no fence needs it. Bound moves don't bump the Run version or add contention, and a new turn key starts at zero.
  - **Dash** becomes a real rules mechanic: using the Dash action adds the actor's speed to that turn's budget. Without it, Assisted mode would warn wrongly after every Dash.
- **D39** A player whose movement decision the GM skipped sees "The GM skipped this decision" in their decision drawer as well as in chat. The decision read model records who settled it.
- **D40** Confirmed from S4-c:
  - A player's door change is staged under their own actor, and the lock rule is checked at publish.
  - Recovering an uncertain commit as COMMITTED drops the room's Scene cache and re-challenges every socket.
  - A decision whose acknowledgement was lost in a crash replays as "already settled". The player already sees the result through their subscription.
- **D41** Deciding what counts as "rules in the room" (S4B, R06.1):
  - **Dice move to the room:** `ROLL_RULE_EVIDENCE`, `ROLL_ACTOR_INITIATIVE` and `ROLL_ENEMY_ACTION` are planned in the room, which has the secure random source.
  - **Recording stays in Convex:** GM tools whose only derived work is the deterministic actor recalculation stay Convex-recorded, because Convex recalculates actors at every commit anyway. These are `ADJUST_FEATURE_RESOURCE`, `REPLACE_CREATURE_EQUIPMENT`, `REINFORCE`, `REVERT_LAST_ACTION` and `REMOVE_ACTOR`. `REMOVE_ACTOR`'s cleanup is shared with account deletion, which runs without a room.
  - **Disarm sees what the initiator sees:** a GM's Disarm reads the Scene with the GM's view, and a player's with the player's.
  - **Cards credit the answerer:** a Cleaving answer's Concentration cards are credited to whoever answered (D31).
  - **Old Convex paths go now (S4-d):** the Convex-side action, turn and Concentration resume paths that tests still reach are deleted in this slice, with those fixtures moved to the room path. They are not kept as a second path.
- **D42** Three rulings from the S4-d cleanup:
  - **D29 is superseded.** With a room active, bound-token movement and its decisions happen only on the presented Scene. Anything else is refused with "Present this Scene to move Encounter tokens." The native forward was unreachable in practice.
  - **No internal IDs in persisted contracts.** They must carry public UUIDs, never Convex document ids.
  - **Permission refusals say so.** A player sending a GM-only command, or acting for an actor they don't control, sees a permission message such as "Only the GM can do that." "The Encounter changed" is reserved for genuinely stale versions.
- **D43** (was Q12; decided because it follows from D41) Convex refuses Encounter-bound token moves when no room is live, using the same domain refusal as D42. The native Convex movement preparation, dice and Concentration code this leaves unused is deleted. The tabletop always opens a room before moving tokens, so the native path was a second rules path with Convex dice, which D41 rules out.
- **D44** Rulings on S4-e's escalations:
  - **Commit checks:** Convex no longer re-runs movement rules at commit. Correctness rests on the commit fences over every captured read (Run version, Scene version, Character and rules revisions), plus the room running commands one at a time (D41).
  - **Refusal wording:** the no-room refusal reuses "Present this Scene to move Encounter tokens." Only direct API calls can reach that case.
  - **V15 workload driver:** the driver D43 broke gets fixed in R08 prep, by sending Scene commands through the room socket.
- **D45** Basic combat actions (Q11):
  - **Command:** they use a dedicated `USE_BASIC_ACTION` command. `RESOLVE_ACTION` is tied to kernel occurrences.
  - **Homebrew:** entries follow the System, so custom entries arrive with user-authored Systems.
  - **Undo:** GM undo covers basic actions, and undoing an attack gives back the Help it consumed.
  - **SRD gaps, closed before beta:**
    - **Help** covers any next attack roll, including opportunity attacks and Disarm, and ability checks in Encounter contests.
    - **Dodge** needs the dodger to see the attacker, gives advantage on Dexterity saves, and is lost while the dodger is incapacitated or at speed 0.
    - **Disengage** expires by turn identity, so a GM moving the turn marker back to that actor doesn't revive it.

- **D46** D45 follow-ups (basic actions):
  - **Disengage** expires by a Run turn counter, which START, ADVANCE_TURN, GM turn edits and removal of the current actor all advance. The D38 turn key would revive Disengage when the GM set the same actor current again.
  - **Dodge** is suspended, not lost, while the dodger can't act or has speed 0.
  - **Help** doesn't apply to initiative.
  - **Gaps before closed beta:**
    - Dodge checking whether the dodger can see the attacker (no combat step computes sight yet).
    - Speed 0 from conditions such as Grappled (ships with condition mechanics).
    - Dodge benefits on saves forced by turn effects.

* **D47** R08-prep rulings:
  * **Binding while a room is live.** A GM can bind an Encounter to the presented Scene mid-session, the common "the fight starts here" case, so binding goes through the room like other Scene-owning changes. Today `sceneBindings:bind` refuses whenever a room owns the presented Scene, which is a product defect.
  * **V15 schedule.** An actor's turn may end without a reaction, as the criterion's "up to one reaction" wording allows. With two dispositions, not every turn can provoke one.
  * **Room replies:**
    * An exact replay reports `replayed: true`, matching Convex.
    * A capture timeout is reported as temporarily unavailable ("try again"), not as `STALE_STATE`.
    * When the initiator can't see the result of their own command, the room acknowledges only the version, which is correct redaction. Any decision owed to them must still reach them through their pending reads.
  * **Storybook failures are real defects to fix:**
    * Dimmed unavailable actions need 4.5:1 text contrast.
    * The GM Window story's token-binding select must offer the fixture's actors.
  * **Fog exploration along a move (defect found by the T3 fast tests).** A move explores continuously along the walked line, as Foundry does and as the code comment says. Today `deriveSceneTokenPathExplorationPatch` (`packages/shared/src/domains/vtt/exploration.ts:361`) samples only the path's corner points. A straight drag is a two-point path, so short-sighted tokens leave the middle unexplored. Fix it with a test that fails today.
  * **No commits during the final R08 run.**
* **D49** Rulings from the D47 fix batch:
  * **Unbinding.** Deleting a prepared, bound Encounter while a room owns its Scene also goes through the room, the same way binding does.
  * **Dimmed text.** Mantine's dimmed color now maps to the Forge secondary text token app-wide, raising contrast to at least 4.5:1 (light 6.26:1, dark 7.17:1). This is an accessibility improvement everywhere text is dimmed.
  * **R08 drivers.** The Effects, Disarm and Campaign lifecycle drivers get a room binding helper in `DevelopmentHttpClient`.
  * **Binding expiry window.** 10 seconds is accepted. The commit is refused once the binding's `expiresAt` has passed, and ABANDONED only after that. It relies on Convex and Worker clocks agreeing within the window: true locally, and NTP-synced in hosted environments.
  * **Query cost.** Handler JavaScript is about 1–10 ms per call. The cost is cold module evaluation per function call: `projectionReads:get` ~75 ms and the capture ~150 ms cold. First measure on the real backend, with the browserless load check, whether Convex reuses module state between executions. Then decide on shrinking each function's module graph. Decide nothing before that measurement.

* **D52** Command speed, from the browserless V15 check ([v15-browserless-2026-09-26](../validation/phase-08-2/v15-browserless-2026-09-26.md)).
  * **Findings:**
    * The self-hosted backend re-evaluates each function's modules on every call, a fixed cost of about 55–150 ms that is 58–74% of each call.
    * Command p95 is 2.5–2.8 s against a 1 s budget.
    * A bound move makes about 7 serial Convex calls.
    * Each commit re-runs `projectionReads:get` once per subscribed player, about 6 times.
  * **Rulings:**
    1. Shrink per-call setup for the capture bundle, the commits, `encounterMovement:*`, `projectionReads:get` and the rules capture. Use narrower or lazy imports, and build no large schemas at module load. Prove it with per-function user execution time on the backend.
    2. Collapse the bound-move and reaction chain to at most 2 serial Convex calls per step. Fold route, begin, observe, capture and prepare into one call, and prepare into commit. This changes only the private room↔Convex routes, and keeps the write-ahead, fence and replay semantics.
    3. Re-run the browserless check. The 6-browser V15 runs only when command p95 is comfortably under 1 s and convergence p95 is under 250 ms.
  * **Caveat:** hosted Convex may cache modules differently, and the staging run (R09) will measure that. Both fixes help either way.

* **D51** D50 follow-ups:
  * **Legendary attack options.** Option B: a Legendary option names the creature's own action (Tail Attack runs the Tail action) and supports target selection. Area options wait on the area-targeting work. Until then, discovery skips options it can't execute instead of crashing.
  * **Stored-format changes.** `CANCELLED` is renamed to `RESISTANT_AND_VULNERABLE`, and Concentration `damageTypeId` is now nullable. Local data is reset under the standing reset approval, with no migration.
  * **E4, open: do SRD creature attacks work?** 381 of 471 SRD creature attack features have no attack-roll definition, and on the pure path they fail at execution ("dnd5e.attack-modifier is missing"). A read-only investigation is checking the room path. If it fails there too, it blocks closed beta and is fixed next.

* **D50** Rules defects found by the T2 fast tests. All get fixed, each with a test that fails first:
  1. **HIGH: Legendary discovery throws on SRD dragon attack options.** `encounterTurnLegendaryDiscovery.ts:33` calls `adapter.compile`, which throws on anything that isn't a self action (`effectActionCompiler.ts:1646`). So ending a turn in an Assisted Encounter with an SRD dragon crashes. Legendary options that are attacks (Tail Attack, Wing Attack) must be offered and resolve as actions. Discovery must never throw on one option.
  2. **Initiative tie-break.** The tie-break roll only orders the tied creatures, and their initiative count stays the same (SRD 5.1). Today `encounterInitiativeStateEvaluation.ts:54` overwrites the score, which breaks reinforcement placement.
  3. **Initiative roll log.** Log `1d20+modifier` as stored, and honor advantage on initiative (Barbarian Feral Instinct). Today `commands.ts:400-434` logs a bare 1d20.
  4. **Concentration saves.** One save per damage source, not per damage part (SRD 5.1). The DC comes from that source's total damage. First confirm whether the compiler emits several damage rows for one attack.
  5. **SRD data: Legendary costs.** Options authored "Costs 2 Actions" or "Costs 3 Actions" use those costs, fixing the adult and ancient dragons and the Unicorn. The SRD manifest diff must show only those changes.
  6. **Resistance and vulnerability together.** When both apply, halve (round down) and then double. They don't cancel (SRD 5.1), and today every odd amount comes out 1 too high (`effectActionCompiler.ts:4720-4737`).
  7. **Cleaving reach** uses the fixed D48 grid measure (`encounterCleavingFacts.ts:205-209`). This goes into the D48 batch.
  8. **Smaller fixes:**
     * Cleaving continues from a target at full HP that has temporary hit points, when the rules allow it.
     * A `CONDITION_REMOVE` receipt reports `applied` correctly when the condition is on both the Sheet and the Campaign.
     * `inMemoryInitiativeRepository` doesn't leak `expectedVersion` into DTOs or checksums.
  10. **Heal multipliers** apply the same way damage multipliers do, rounded down. This was found during the D48 fixes.
  11. **Ranged single-target `ON_USE` actions.** A `DISTANCE` range warns when out of range (D11). It isn't refused.
  12. **Gridless Scenes** measure the edge-to-edge gap plus the System's base square (5 ft). That matches the grid rule, where adjacent is 5 ft, so reach means the same thing on every Scene.
  13. **Area actions** (breath weapons, lines, cones, spheres) are confirmed as part of the queued area-targeting work (Phase 8.3, before closed beta). D48 proved Acid Breath's half damage on a single-target copy only.
  9. **Tests typecheck.** Add a repo typecheck config for `packages/rules-runtime/src/__tests__`, run through turbo and CI. Fix the two existing errors it finds: `dnd5eCombatMath.test.ts:815` and `encounterMovementReactionDecision.test.ts:47`.

* **D48** Rules defects found by the T1 fast tests. All are to be fixed, each with a test that fails first:
  * **Half damage on a successful save.** An `ON_SAVE_SUCCESS` outcome's `multiplier` (for example 0.5) must apply to direct saving-throw actions, such as the Black Dragon Wyrmling's Acid Breath. Today only the nested follow-up save shape halves damage, so the tabletop disagrees with the Sheet.
  * **Several non-dice outcomes on one save result.** Two or more fixed or condition outcomes on the same result path must not crash. Give every outcome group a unique node id, as dice groups already have.
  * **Grid distance.** Range and reach use the SRD grid rule: count squares to the nearest occupied square of the target, so adjacent is 5 ft. Today the gap between footprints undercounts by one square: a 5-ft reach reaches a target two squares away. The same measure drives opportunity-attack reach, so fix both from one shared measure. This supersedes the documented "between complete occupied rectangles" choice.
  * **Touch range.** A single-target Touch action (for example the Unicorn's Healing Touch) behaves as a 5-ft range that warns when out of reach (D11). It is not refused.
  * **Wording:** "This actor can't take an action right now."
  * **Creature saving-throw proficiencies.** Stat blocks with a Saving Throws line must use those modifiers. This needs a creature schema field and SRD data. It's queued as its own slice before closed beta. Its source-identity check requires a frozen tree.

## Resolved

- **Q11 (2026-09-26).** Basic combat actions come from a System-owned catalogue, split in two:
  - **Mechanics** are closed, System-neutral rule kinds in `packages/shared` with the other core engine enums: a movement budget bonus equal to speed, suppressing opportunity attacks, disadvantage on attacks against the actor until its next turn, and advantage granted to an ally.
  - **The catalogue entries** (Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object, with their names and text) are authored System data in the SRD source, so homebrew Systems can rename, change or add them.
  - Hard-coding 'Dash' as a shared enum would put D&D terms into the core engine.
  - Every actor gets the catalogue through the normal action flow. Hide, Ready, Search and Use an Object are logged, not automated.
  - It ships as its own slice before closed beta.
- **Local backend secret (2026-09-26).** The local instance secret exposed in an agent transcript was rotated. The stored secret file was removed and the container restarted, which generated a new secret inside the container that was never printed. The container also dropped from about 6.6 GiB to 196 MiB of memory.
- **Q9 (2026-09-25).** V05.4 reworded: renewal keeps valid users and keeps room authority serving the remaining current members (ADR 0033).
- **Q10 (2026-09-25).** Shared Session notes show their author and handouts their uploader, resolved on the server. Both read "Deleted user" after account deletion, through the same function chat uses. The Encounter timeline keeps naming actors. F12.3's wording is unchanged.
- **Q8 (2026-09-25).** Keep 100 as the Encounter safety cap. One convex-test case proves the room's capture stays within Convex limits at the cap; speed targets (V15) use the typical 11-actor table.
- **Q6 (2026-09-25).** V11.4 reworded: in Assisted mode a player's save-forcing action pauses on the creature's save for its controller (the GM) unless that controller's auto-roll is on, in which case the save is rolled and the action continues. Manual mode raises no rules prompts. There is no separate Automatic mode since the modes redesign; the per-person auto-roll preference fills that role. Spell-specific proof becomes a Phase 8.3 spell-casting criterion.
- **Q7 (2026-09-25).** V09.7 reworded to 'development data is migrated or reset under the standing local-reset approval', matching the actual process.
- **Q1 (2026-09-25).** The connection string labeled production is non-live. The user will rotate the credentials before go-live (added to the release checklist).
- **Q2 (2026-09-25, amended).** Delete the whole Codex backup worktree only after the final R08 proof passes. 653 of the 725 evidence references in the acceptance ledger point at `.codex/validation/...` files that exist only in that worktree, so it is the only record behind the 59 accepted cases until R08 re-proves them on the final source.
- **Q3 (2026-09-25).** Done. Removed the 12 `supabase_*_artificer-toolkit` containers and their 3 volumes, the local `supabase/` folder (empty directories and the `.temp` generated secrets; migrations remain in git history), the 11 Supabase and database variables in `.env.local` (removed by name, values never read) and the dead `.gitignore` entry. Left alone: the `faye-frame` project's volumes and one unattributable `supabase_edge_runtime_` volume. `scripts/auditNativeBoundaries.mjs` keeps guarding against Supabase being reintroduced.
- **Q4 (2026-09-25).** Scene fog save retention is folded into S7.
- **Q5 (2026-09-25).** Done in the player-control slice (S6b): `CampaignSessionPlayerEncounters` is now `CampaignPlayerEncounterDecisions`.
