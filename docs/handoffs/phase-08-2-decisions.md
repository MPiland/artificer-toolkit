# Phase 8.2 decisions

> Decisions made on the user's behalf, approved implementation decisions and resolved questions. Open questions live in [phase-08-2-open-questions.md](phase-08-2-open-questions.md); the full reasoning for delegated decisions is in the [handoff Decision log](phase-08-2-convex-cutover.md#decision-log-delegated-for-user-review). Search this file by decision ID (for example `D72`) rather than reading it whole.

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

* **D15** `REACTION_COUNT SET_VALUE` (only SRD use: Shocking Grasp's "can't take reactions" on the target) ships with APPLY_GRANT. Superseded by D99, which gives it a consumer.
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
  - **Recording stays in Convex (superseded by D85/D88):** this entry first kept `ADJUST_FEATURE_RESOURCE`, `REPLACE_CREATURE_EQUIPMENT`, `REINFORCE`, `REVERT_LAST_ACTION` and `REMOVE_ACTOR` Convex-recorded. Today no Convex function executes Encounter commands: the room runs all of them through `recordEncounterCommand`, and `REVERT_LAST_ACTION` reads the room-held receipts. `REMOVE_ACTOR`'s cleanup is shared with account deletion, which runs without a room.
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
    - Dodge checking whether the dodger can see the attacker (closed for room attack rolls by D100).
    - Speed 0 from conditions such as Grappled (ships with condition mechanics).
    - Dodge benefits on saves forced by turn effects.

* **D47** R08-prep rulings:
  - **Binding while a room is live.** A GM can bind an Encounter to the presented Scene mid-session, the common "the fight starts here" case, so binding goes through the room like other Scene-owning changes. Today `sceneBindings:bind` refuses whenever a room owns the presented Scene, which is a product defect.
  - **V15 schedule.** An actor's turn may end without a reaction, as the criterion's "up to one reaction" wording allows. With two dispositions, not every turn can provoke one.
  - **Room replies:**
    - An exact replay reports `replayed: true`, matching Convex.
    - A capture timeout is reported as temporarily unavailable ("try again"), not as `STALE_STATE`.
    - When the initiator can't see the result of their own command, the room acknowledges only the version, which is correct redaction. Any decision owed to them must still reach them through their pending reads.
  - **Storybook failures are real defects to fix:**
    - Dimmed unavailable actions need 4.5:1 text contrast.
    - The GM Window story's token-binding select must offer the fixture's actors.
  - **Fog exploration along a move (defect found by the T3 fast tests).** A move explores continuously along the walked line, as Foundry does and as the code comment says. Today `deriveSceneTokenPathExplorationPatch` (`packages/shared/src/domains/vtt/exploration.ts:361`) samples only the path's corner points. A straight drag is a two-point path, so short-sighted tokens leave the middle unexplored. Fix it with a test that fails today.
  - **No commits during the final R08 run.**
* **D49** Rulings from the D47 fix batch:
  - **Unbinding.** Deleting a prepared, bound Encounter while a room owns its Scene also goes through the room, the same way binding does.
  - **Dimmed text.** Mantine's dimmed color now maps to the Forge secondary text token app-wide, raising contrast to at least 4.5:1 (light 6.26:1, dark 7.17:1). This is an accessibility improvement everywhere text is dimmed.
  - **R08 drivers.** The Effects, Disarm and Campaign lifecycle drivers get a room binding helper in `DevelopmentHttpClient`.
  - **Binding expiry window.** 10 seconds is accepted. The commit is refused once the binding's `expiresAt` has passed, and ABANDONED only after that. It relies on Convex and Worker clocks agreeing within the window: true locally, and NTP-synced in hosted environments.
  - **Query cost.** Handler JavaScript is about 1–10 ms per call. The cost is cold module evaluation per function call: `projectionReads:get` ~75 ms and the capture ~150 ms cold. First measure on the real backend, with the browserless load check, whether Convex reuses module state between executions. Then decide on shrinking each function's module graph. Decide nothing before that measurement.
* **D63 (blocks closed beta) 0 hit points.**
  - **Creatures:** a Creature reduced to 0 HP is defeated. It takes no actions, reactions or Legendary Actions, and its turns are skipped. It stays in the initiative order marked defeated (Foundry parity). The GM can revive it or set another HP value, for example "knocked out, not killed".
  - **Characters:** a Character at 0 HP becomes unconscious and dying, and enters the death-save flow (queued).
  - **Scope:** this applies everywhere: turns, reactions, opportunity attacks, Legendary windows, Cleaving targets and action eligibility.
  - **Legendary options through RESOLVE_ACTION:** the server refuses them, not only the drawer. A Legendary option can be used only in a Legendary window.
  - **Built** ([rules runtime](../architecture/rules-runtime.md#0-hit-points-d63-current)):
    - Creatures and custom actors store `defeated`, set by every hit-point write that takes them to 0, and the GM revives by editing hit points above 0. A 0-of-0 hazard is never defeated.
    - Turns, reactions and opportunity attacks, Legendary windows and targets, Cleaving targets, action choices and every acting command exclude defeated actors (`ACTOR_DEFEATED`). The GM may still move a defeated token.
    - Web target lists leave defeated actors out. Naming one anyway is the overridable `TARGET_DEFEATED` warning, because healing magic can target the dead. Help and Disarm refuse a defeated target.
    - Characters at 0 gain Unconscious, which suppresses actions and reactions, and lose it on regaining hit points. Their turns are not skipped.
    - The room refuses Legendary options with `LEGENDARY_WINDOW_ONLY`.
    - Tokens and turn order show "Defeated" to everyone.
  - **Gaps:**
    - ~~An actor defeated during a turn transition, by the outgoing turn's effects or Legendary Actions, still starts its turn.~~ **Fixed:** the room plans the next turn again once the outgoing effects and Legendary Actions settle, and the commit applies the advance after they commit ([live sessions](../architecture/live-sessions.md)).
    - Unconscious's automatic Strength and Dexterity save failures, advantage on attacks against it, and melee critical hits within 5 feet are not modeled for any condition yet.
  - **Decisions on the D63 questions (2026-09-27):** defeated targets are left out of lists, and naming one gives an overridable warning (accepted). The GM may move defeated tokens and players may not (accepted). The turn-transition gap gets fixed before closed beta, not accepted as permanent.
* **D62** Rulings on M8's questions, and slice M9:
  1. **Ranged range.** Ranged attacks author normal and long range (SRD).
     - Beyond normal and up to long range, the attack roll has disadvantage with the reason "Long range". This is derived automatically in Assisted mode, like other roll-mode reasons.
     - Beyond long range, it warns (D11).
     - The 32 older ranged attacks at SPECIAL range move to their printed normal and long range.

  2. **Timed conditions on one-time saves.** A one-time save's condition may carry a duration (for example the Homunculus's "poisoned for 1 minute"). This extends D57 ruling 3.
  3. **Size limits on hit riders** ("Medium or smaller", "Large or smaller") are checked together with the target-owned grapple work (D57 ruling 2, option b). Until then the rider applies to any size.
  4. **Swarm member size (swarmOf).** Deferred until something reads it. The six exceptions stay.
  - **M9 (blocks closed beta):**
    - Items 1 and 2.
    - Clear the remaining sweep categories wherever existing or small model extensions allow: OUTCOME_KIND (46, for example CLOSED_RULE riders such as Wight Life Drain and lycanthropy), SPECIAL_RANGE (55; the area parts wait on area targeting), and EQUIPMENT_BASE_DAMAGE (26 across 21 Creatures).
    - Each category gets an explicit design note.
  - **M9 done.** The SRD attack sweep's allowlist went from 126 to 44 entries; design notes per category are in the [rules runtime](../architecture/rules-runtime.md) ("M9 sweep categories").
    - **Ranged range.** A `DISTANCE` range may author `longAmount`. All 57 Creature ranged weapon attacks and every SRD weapon (including the Net and the Storm Giant Rock) author their printed normal and long range, and a source-data test holds each Creature attack to its printed range. Between the normal and long range a `RESOLVE_ACTION` rolls with disadvantage for "Long range", derived from the locked Scene positions like Dodge and Help; beyond the long range it warns (D11). Characters and Creatures share the rule. The Goblin, Drow, Deep Gnome and Guardian Naga long-range closed rules are removed.
    - **Timed one-time saves.** The Homunculus's Bite (1 minute), the Sprite's Shortbow (1 minute) and the Drow's Hand Crossbow (1 hour) author their poison's duration; an active effect removes the condition after the target's last counted turn, with no repeated save. Their "fails by 5" unconsciousness stays description-only (as for the Homunculus in M8). The Couatl's 24 hours exceeds the active-effect tick bound (10,000 turns) and stays unsupported. The Pseudodragon keeps its separate save action per D57.
    - **Several conditions on one hit.** A result path may apply up to four conditions, each with its own immunity fact: the Giant Toad's and Remorhaz's Bites grapple and restrain.
    - **Equipment weapons.** A Creature's printed weapon damage is authored on its Feature; the held Equipment gives identity and properties, and must share the attack trigger and damage types. 25 of 26 entries run; the Ogre Zombie's bludgeoning Morningstar (a morningstar deals piercing) stays allowlisted as a probable SRD printing error.
    - **Re-authored with existing shapes:** Tarrasque Tail (save or prone), Veteran and Wight Longsword and Druid Quarterstaff (one Effect per grip; Shillelagh stays description-only), Erinyes Longbow (a bare poisoned condition), Deep Gnome Poisoned Dart (repeating save), Mammoth Stomp (an action), the 14 attack-triggered Multiattacks (`ACTIVATED` closed rules). Removed: the Lich's duplicate Paralyzing Touch rule and the Horned Devil's object-ignition rider.
    - **Life Drain (approved 2026-09-27):** widen `recoveryTags` to allow `LONG_REST`, and a long `COMPLETE_REST` deletes those reductions. **Done:** the shared recovery-tag definition allows `LONG_REST` beside `RESTORE_HIT_POINT_MAXIMUM`, the three Life Drains author their save and reduction (allowlist 44 to 41), a long Sheet rest deletes those reductions, and a Character receipt now binds a reduction to its proposal ([rules runtime](../architecture/rules-runtime.md), "Life Drain"). A Creature whose maximum reaches 0 is defeated; a Character only drops to 0 (Character death is not modeled yet). The Wight, Wraith and Specter Life Drains reduce the hit point maximum "until the target finishes a long rest". The reduction contract (`recoveryTags`, active-effect contributions and receipts) recovers only through restoration magic. Recommendation: widen `recoveryTags` to allow `LONG_REST` beside `RESTORE_HIT_POINT_MAXIMUM`, and have `COMPLETE_REST` (long) delete those effects the way it deletes scalar reductions. Until then they stay `OUTCOME_KIND`.
    - **Sheet maximum (decided 2026-09-27, built):** the Character Sheet subtracts active hit point maximum reductions, the same way the Encounter does. Each reduction appears as its own line in hit point management, with "until long rest" or "until restored". The stored `maximumHitPoints` column keeps the maximum before reductions, and its readers subtract them ([rules runtime](../architecture/rules-runtime.md), "Effective maximum hit points").
      - **Source label (decided 2026-09-27, option a, built):** the reduction freezes the acting Feature or action label as a required `sourceLabel`, and the Sheet line reads "<label> · Until long rest" or "<label> · Until restored" with its amount. Local data is reset, not migrated.
        - **Privacy (decided 2026-09-27, fail closed, built):**
          - The reduction also freezes a required `sourceHidden`: whether the attacker was hidden from players at resolution.
          - The GM's Sheet view keeps the label; every other viewer gets no label and the web shows "Unknown source".
          - A player's roll prompt never names a hidden actor's effect or basic action; the advantage or disadvantage still applies and reads "Unseen source".
          - Tested: the hidden Wight gives the player no label and the GM "Life Drain"; a visible Wight names it; a hidden dodger's disadvantage reads "Unseen source" to the player and "Dodge" to the GM.
          - Known limit: a contributor from the roller's own rules policy names no Encounter actor, so it is never redacted.
    - **Manifest.** 89 of 1,057 subjects changed (73 Creatures, 16 Equipment); no subject or definition was added or removed.
    - **Not validated here:** the local Convex codegen push (Docker was out of scope for this slice).

- **D61** Rulings on the M7 model gaps, and slice M8:
  - **Flat skill bonus:** option (c). The four printed inconsistencies (Half-Red Dragon Veteran, Lich, Night Hag, Priest) stay allowlisted as probable SRD printing errors. No shared-grant field is added.
  - **Damage-defense conditions:** option (a) for spells, once damage carries its spell source, which is part of the spell-casting and area-targeting work. Option (b) for the Rakshasa (allowlisted; the GM sees the printed text) until alignment facts reach the damage pipeline.
  - **M8 (blocks closed beta):**
    - Author the 45 printed attacks on 31 Creatures that have no Effect at all (Ape, Behir, Polar Bear, Tyrannosaurus Rex, the Wyvern's Bite, the Young Brass and Young Green Dragon Bites, the Stone Giant's Rock and more), plus the Behir's Lightning Breath.
    - Add a guard so no printed attack can lack an Effect again: the stat-block table's action names must map to an Effect or to a listed description-only Feature.
    - Add a swarm model: attacks at 0 ft reach against creatures in the swarm's space, and half damage dice once the swarm is at or below half its hit points.
    - Verify the Night Hag Etherealness rule reference.
  - **M8 done.**
    - **Attacks.** 42 printed attacks on 29 Creatures now author an Effect (the Dryad's Club and the Duergar's War Pick and Javelin were already authored through options, so the list above counted them wrongly). Riders use existing shapes: further damage parts, a bare grapple, and save-or-prone or save-or-poisoned. Thrown spears add a ranged Effect, and ranged attacks author their normal range. Also authored: the Behir's Lightning Breath (a DC 16 Dexterity save at `SPECIAL` range until area targeting) and the Gladiator's Parry (the shared parry reaction). All 45 new Effects run in the sweep, which now covers 573 attack Effects. The allowlist lost its 5 `SWARM_SPACE` entries and gained nothing.
    - **Description-only riders (mechanics follow-up):** Fire Elemental and Magmin ignite, Gray Ooze armor corrosion, Gibbering Mouther absorption, the Otyugh's disease hit point maximum reduction, the Homunculus's "fails by 5" unconsciousness, and every "restrained until the grapple ends". Open questions 2 and 3 cover the Homunculus's 1-minute duration and printed size limits.
    - **Guard.** The stat-block audit fails when a printed action, reaction or legendary action has an authored source with no Effect, unless `creatureDescriptionOnlyActions.ts` lists it with a reason: 62 Multiattacks, 17 unmodeled mechanics, 3 legendary options that use the Creature's own action (D51 B), and 10 chromatic dragons' Detect (the metallic dragons author one).
    - **Swarms.** A melee attack may reach 0 ft., checked as overlapping footprints. An unscaled dice damage outcome may author `halfHitPointsDiceConfig`, rolled while the source has half of its hit points or fewer, from the source's locked hit points ([rules runtime](../architecture/rules-runtime.md)). The six swarms' bites run in the room, and a room test hits with the seeded Swarm of Rats at full and half hit points.
    - **Rule references.** The Night Hag's Change Shape, Etherealness and Nightmare Haunting each ran the next Feature's closed rule, and the Darkmantle's Crush and Darkness Aura ran each other's. Both are fixed.
    - **Manifest.** 37 of 1,057 subjects changed; no subject or definition was added or removed.

* **D60 (blocks closed beta) Monster completeness, following the M6 audit.** The audit fixed 388 of 457 stat-block differences. The printed content that is still missing is queued as slice M7:
  - **Breath weapons:**
    - The metallic dragons share one Breath Weapons action with one Recharge 5–6, per the SRD. Today each breath has its own charge.
    - Young Copper and Young Gold dragons are missing their second breath.
  - **Missing actions:**
    - Actions: Aboleth Tentacle, Tail and Enslave (and clean up the stray legendary Effects on its Multiattack); Ice Devil Wall of Ice; Kraken Fling; Oni Glaive; Solar Flying Sword; Succubus/Incubus Charm and Etherealness; Werebear Greataxe.
    - Reactions: Marilith Parry and Stone Giant Rock Catching.
    - Spellcasting: Androsphinx and Solar.
    - Legendary options: Aboleth, Kraken, Solar and Tarrasque.
  - **Missing creatures:** the six SRD swarms (Bats, Insects, Poisonous Snakes, Quippers, Rats, Ravens).
  - **Model gaps:**
    - A flat skill bonus on Creature proficiency grants.
    - Damage-defense conditions such as "from spells" and "from magic weapons wielded by good creatures".
  - **Mechanics** for description-only traits (Water Breathing, Sunlight Weakness, Rust Metal, Acid Absorption and similar) and the description-only Multiattacks.
  - **Extraction source:** `pdftotext` is accepted as a one-time authoring tool for the stat-block extractor. It isn't a runtime dependency.
  - **M7 done (authoring with existing shapes).** Stat-block exceptions went from 69 to 24: 12 legendary options (D51 B), 4 skill bonuses, 2 damage defenses and 6 swarm member sizes.
    - **Breath weapons.** All 20 metallic dragons author one Breath Weapons (Recharge 5–6) Feature with one charge and both breath Effects. Young Copper and Young Gold gain their second breath. Young Bronze and the Gold Wyrmling now author their breath Effects, and Young Bronze its Bite and Claw. Also fixed: Young Brass sleep lasts 5 minutes and the Brass Wyrmling's 1; the Bronze and Copper Wyrmlings' second breath ran a placeholder rule (now push and slow; `DRAGON_BREATH_WEAPON_CHOICE` is removed); the Young Silver and Silver Wyrmling repeat the Paralyzing Breath save. Breaths keep `SPECIAL` range, so the line or cone waits on area targeting.
    - **Actions.** Aboleth Tentacle, Tail and Enslave (3/Day); its Multiattack lost the stray legendary Effects. Oni Glaive and Werebear Greataxe. Succubus/Incubus Charm (save or charmed for 1 day). Ice Devil Wall of Ice (Recharge 6) manifests a zone, as the spell does. Marilith Parry uses the shared parry reaction. Androsphinx and Solar spell grants. The new attacks run in the room.
    - **Description-only (mechanics follow-up):** Kraken Fling, Solar Flying Sword, Succubus/Incubus Etherealness, Stone Giant Rock Catching, the Aboleth Tentacle's disease, Enslave's control and repeat saves, Charm's repeat saves and immunity, and Wall of Ice's save damage and frigid air.
    - **Swarms.** The six SRD swarms are seeded as Medium beasts with description-only Swarm traits. The Swarm of Ravens' Beaks run in the room. The other five bite at reach 0 ft. a creature in the swarm's space, which waits on a swarm model (sweep reason `SWARM_SPACE`).
    - **Found outside M7:** 45 printed attacks on 31 Creatures are description-only, with no Effect, so they never reach the sweep and the Behir's Lightning Breath has none either. They are the Ape (Fist, Rock), Behir (Bite, Constrict), Doppelganger (Slam), Dryad (Club), Duergar (War Pick, Javelin), Earth Elemental (Slam), Ettin (Battleaxe), Fire Elemental (Touch), Frost Giant (Greataxe, Rock), Gargoyle (Bite, Claws), Giant Crocodile (Bite), Gibbering Mouther (Bites), Gladiator (Spear, Shield Bash), Gnoll (Bite, Spear, Longbow), Gold Dragon Wyrmling (Bite), Gray Ooze (Pseudopod), Half-Red Dragon Veteran (Longsword), Harpy (Claws, Club), Hippogriff (Beak, Claws), Homunculus (Bite), Magmin (Touch), Otyugh (Bite, Tentacle), Polar Bear (Bite, Claws), Sahuagin (Bite), Salamander (Spear, Tail), Stone Giant (Rock), Tyrannosaurus Rex (Bite, Tail), Violet Fungus (Rotting Touch), Wyvern (Bite), and the Young Brass and Young Green Dragons (Bite).
    - **Model gaps, escalated.** See [the M7 model gaps question](#open).
* **D59** Adopt lazy schemas (spike branch `worktree-agent-a007a1dd573f90707`; write-up `d55-lazy-schema-spike-2026-09-27.md`).
  - **Measured:** module load drops 73–84% on every hot function, and all 2,168 exported schemas, Convex validators, JSON Schema, parse results and deploy metadata are identical.
  - **What's included:**
    - `lazySchema` wrapping applied by a committed codemod, with a lint `--check` so no new eager schemas creep back in. `z.json()` stays eager.
    - A test that builds every exported schema.
    - Content tables built on demand.
  - **Dropped:** the blanket args/returns getters. They measured no gain.
  - **Sequencing:** roll out last, by re-running the codemod on the latest branch after M2, M6 and D58 merge, to avoid conflicts in schema files.
  - **Proof required:** the equivalence script against the merge base, the full suites and codegen, then the browserless re-run. The 6-browser V15 runs only when both budgets pass with margin.
  - **Done (rolled out, 2026-09-27,** **[record](../validation/phase-08-2/d59-lazy-schema-rollout-2026-09-27.md)).**
    - The codemod (`scripts/lazySchemas.mjs`) re-ran on the current source and wrapped 2,321 initializers. That includes 17 calls to local schema builders, which the spike had left eager.
    - Shared shapes and variant lists use `lazySchemaParts`. `yarn lint` runs the `--check`. `lazy-schemas.test.ts` builds every exported schema and fails on an eager one. Content tables are built on demand.
    - **Module load:** 56–83% lower on five hot graphs. For example, the action commit falls from 159 to 28 ms and the router from 57 to 25 ms.
    - **Equivalence against** **`1822085c8`:** 0 differences across 2,172 schemas (fingerprint, Convex validator, JSON Schema, parse results including 1,057 SRD documents), `schema.ts` `export()` and all 553 functions' args and returns.
    - **Still open (user):** the local codegen push and backend reset, then the browserless re-run. The pattern is in [Transport](../architecture/transport.md#lazy-schema-construction).
* **D58 (blocks closed beta) Critical hits must double every damage die.** Found by M2: on a critical hit, Creature attacks roll normal dice and add only an authored `ON_CRIT` result. So a critical Adult Red Dragon Bite deals 2d10+8 and 2d6 instead of 4d10+8 and 4d6. The one exception, the hit-then-save shape, already doubles.
  - **Rule (SRD 5.1):** a critical hit doubles every damage die of the attack's damage parts, including extra dice such as Sneak Attack or Divine Smite. Flat modifiers are not doubled.
  - **Fix:** apply this in one place for Creature and Character attacks alike, with pure tests.
  - **Audit:** check whether any authored `ON_CRIT` data exists only to fake doubling. If it does, remove it.
  - **Done.** Every attack's hit damage is rolled in one OUTCOME specializer, so `diceGraphDefinition` is the one place that doubles: Creature and Character attacks, opportunity attacks (movement reactions run the same phased plan) and each part of a multi-part hit. Single-graph attacks carry only fixed amounts. The Adult Red Dragon Bite now crits for 4d10 + 8 and 4d6, and a STR 16 Fighter's Longsword for 2d8 + 3. The SRD sweep checks that every working Creature attack's critical rolls exactly twice its printed hit dice.
    - **Not doubled:** the damage of a save the hit forces (the Giant Spider's poison is the save's damage, not the attack's, which matches the prior shape), non-damage dice such as the Shadow's 1d4 Strength drain, and an authored `ON_CRIT` rider's own dice.
    - **`ON_CRIT`** **audit:** removed Arcane Sword's 6d10 and Spiritual Weapon's doubled dice. Both only faked doubling, and a critical would have added them to the hit (9d10 for the sword). Kept Barbarian Brutal Critical, a genuine crit rider (still a `CLOSED_RULE`). No Creature authors `ON_CRIT`.
    - **Bound:** an unscaled hit may author at most 15 dice, so its critical fits the 31-dice contract. It is checked when TEST is published.
    - **Not yet executable:** extra-dice riders such as Sneak Attack, Divine Smite and Brutal Critical are still `CLOSED_RULE`s. When they become executable `ON_HIT` damage they are doubled by the same code. Brutal Critical's extra die must not be, because it is a critical-only rider.
* **D56** Audit every SRD Creature stat block against the SRD 5.1 text, before closed beta. The D54 damage audit fixed 16 Creatures, and the Ice Devil also shows cold as a resistance where the SRD says immunity, plus a wrong passive Perception and senses. So the damage errors are probably not isolated.
  - **What to check:** AC, HP and hit dice, speeds, ability scores, saving throws (with M5), skills, damage and condition immunities, resistances and vulnerabilities, senses and passive Perception, languages, CR and XP, and trait, action and reaction text versus the mechanics.
  - **How:** extract the printed values once into committed tables by script, the same pattern as the attack-bonus and damage tables. Add a source-data test that compares every Creature against them. Fix mismatches in authored data, and allowlist any justified exceptions with a reason.
  - **Tracking:** slice M6 on the dashboard.
  - **Done (audit).** `stat-blocks.ts` holds all 311 authored Creatures' printed stat blocks, read from the PDF (the committed `.txt` interleaves stat blocks and drops lines, such as the Badger's ability scores). The source-data audit found 457 differences on 161 Creatures: 320 in header fields and 137 in trait, action and legendary action names. 388 are fixed in authored data, and 159 Creatures changed. The worst: the Stone Giant was Large with the wrong Constitution, Wisdom, Charisma and hit dice; the Ice Devil resisted cold instead of being immune, with invented skills and wrong senses; the Quasit had the Imp's speeds and no damage resistances; the Treant lacked its fire vulnerability and bludgeoning and piercing resistance; the Purple Worm had no walking speed; the Balor and Treant had a Perception skill they don't print; the Black Pudding and Rug of Smothering had the wrong hit dice; and 109 skills on 95 Creatures were authored as proficiency where the stat block prints expertise (every dragon's Perception). Saving throw proficiencies now match every stat block, and every printed save bonus equals the ability modifier plus the proficiency bonus.
  - **Remaining, allowlisted with reasons (69):** 37 metallic dragon breath weapons authored as separate Features with independent recharges (the stat block prints one shared Recharge 5-6; the Young Copper and Young Gold also lack their second breath). 26 printed actions, reactions, spellcasting traits or legendary options not authored: the Aboleth (Tentacle, Tail, Enslave, all legendary actions), Kraken, Solar and Tarrasque legendary actions, and single actions on the Ice Devil, Marilith, Oni, Stone Giant, Succubus/Incubus, Werebear and Androsphinx. 4 skill bonuses the model cannot reach (no flat skill bonus), and 2 damage defenses with conditions it cannot represent. Each needs a follow-up; none is a stat-block fact the audit could fix.
  - **Not in the corpus:** the six SRD swarms (Bats, Insects, Poisonous Snakes, Quippers, Rats, Ravens) have no authored Creature.
* **D55** Speed after D52: the browserless check re-run shows command p95 at 1,089–1,090 ms (budget 1,000; was 2,528–2,785) and convergence p95 at 251–252 ms (budget 250). Fixed per-call setup is about 58% of each call: Zod schema construction at module load, plus the HTTP router's full module graph (40–65 ms, paid twice per command).
  - **Ruling:** build schemas lazily (constructed on first use, memoized), covering the HTTP router path.
  - **Approach:** a design spike first. Prototype the pattern on the heaviest graphs (`projectionReads:get`, the capture bundle, one commit, the router). Measure the import saving, and prove types and validation are unchanged. Roll out only after that, then re-run the browserless check. The 6-browser V15 run follows only when both budgets pass.
* **D57 SRD hit riders, slice M2.** The 108 `SEQUENTIAL_PATHS` attacks were grouped by authored shape, and 67 of them now run, plus the Guardian Naga Bite, Scorpion Sting and Spider Bite. 376 of 516 SRD attack Effects work (309 before M2), and 247 Creatures have a working attack (was 215). The sweep allowlist shrinks from 207 to 140, and every SRD attack now resolves to its printed hit damage, so the damage-mismatch list is gone.
  - **Now running:**
    - Several damage parts on one hit (dragon Bites, Hell Hound, Deva Mace, Ettercap Bite and others) and single-damage sequences: one damage source, one Concentration check at the total (D50.4).
    - A hit followed by a Constitution save for poison damage, half on a success (Giant Spider, Wyvern, Scorpion and 7 more), or none on a success (Spider). Their stat blocks applied the poison with no save; they now author the save.
    - Save or prone (Mastiff, Giant Crocodile Tail), applied once.
    - Save or paralyzed/poisoned, repeating the save at the end of each of the target's turns and ending after 1 minute (10 turns): Ghoul, Ghast, Lich, Ettercap, Bearded Devil and the Quasit's Claws.
    - Grapple on hit (Constrictor Snake, Crocodile, Chuul, Giant Crab, Giant Scorpion Claw, Roc, Ankheg, Giant Constrictor Snake): a bare `GRAPPLED` condition (ruling 2).
  - **Still blocked, by their real blocker:** `CLOSED_RULE` riders and hits that apply two conditions (grappled and restrained) are `OUTCOME_KIND`; the Cockatrice and Dragon Turtle Tail saves (now authored) are unsupported follow-up saves; Mimic Pseudopod's unconditional grapple was removed because its Adhesive rule carries it.
  - **Not modeled:** "can't regain hit points while poisoned" (Bearded Devil) and the Pseudodragon's "fails by 5 or more" unconsciousness. The Pseudodragon keeps its separately authored save action with its `CLOSED_RULE`; merging it needs a "fails by N" result.
  - **Rulings:**
    1. **Versatile weapons (Drider and Erinyes Longsword,** **`CHOICE`).** The controller picks one- or two-handed when declaring the attack, offered as two action variants (Foundry-style). Not small (new action identities through discovery, choices and receipts), so both stay listed as `SEQUENTIAL_PATHS`.
       - **Done.** A Creature Feature authors a versatile attack as one effect per grip (an optional `grip`, the Equipment model), so each grip is its own action; action choices share one attack key and the drawer's grip control picks the variant. Characters already worked this way. Both `SEQUENTIAL_PATHS` entries are gone.

    2. **Grapples.** Option (a) for now: a bare condition the GM removes. Option (b), a target-owned grapple relationship with an escape DC, ending when the grappler is incapacitated or moves away, and size limits, is queued before closed beta.
    3. **Repeating saves** may carry a `ROUND` or `MINUTE` duration (a minute is 10 of the target's turns). Only the repeating shape may carry a duration. The SRD stat blocks that print one author it.
    4. **Critical hits** are their own slice (D58).

* **D54** D53 step 1 is merged: 290 of 491 SRD attack sources work (was 40), and 203 of 285 creatures have a working attack (was 31). Rulings on its findings:
  1. **Blast radius.** A Creature whose attack action lacks an ATTACK roll is rejected at publication (authoring validation). At runtime, one Creature's invalid action is unavailable, with a reason, instead of throwing for every Creature on the map during movement-reaction discovery.
  2. **Tests use seeded SRD records.** Tests and fixtures move from raw `srd/creatures/*.js` modules to the seeded records (T6).
  3. **Ice Devil.** Its Bite and Claws are authored.
  4. **Damage modifiers.** Creature damage matches the printed damage. Today the Wolf's Bite adds Strength +1, but it prints 2d4 + 2. The sweep asserts every SRD attack's damage expression against its printed damage, and any mismatches get fixed in authored data.
  - **Done (1, 3, 4).** Creature publication (`creaturePublicationDtoSchema`, SRD import and `publishDraft`) refuses an attack without exactly one ATTACK roll. Discovery lists one invalid Creature action as unavailable with its reason (action drawer, disabled), and the rest of the Encounter still moves and acts. The Ice Devil's Bite and Claws are authored. The generated `attack-damage.ts` table holds each attack's printed hit damage. Of 516 attacks, 26 resolved to the wrong damage and 10 still do. The fixes: a doubled flat modifier on 7 dragon Tail Attacks; the wrong ability on the Wolf, Wererat, Blink Dog and Bearded Devil; a printed bonus that no ability explains on the Saber-Toothed Tiger (a flat +5); wrong dice on the Warhorse and the Ogre's thrown javelin; and the Ettercap's missing poison damage. The 10 that remain author a save-gated follow-up as unconditional hit damage. They are allowlisted under the follow-up-save slice.

* **D53 (blocks closed beta) SRD creature attacks.** The E4 investigation found that only 31 of 285 SRD creatures have a working attack in the room, and 451 of 491 attack units fail. The end-to-end tests hid it because they rewrote the Wolf into a supported shape.
  - **Failures by cause:**

    | Cause                                                                 | Units | Stage                                                    |
    | --------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
    | No authored ATTACK roll definition                                    | 251   | Execution: `dnd5e.attack-modifier` missing               |
    | SEQUENTIAL/CHOICE paths                                               | 105   | Compile                                                  |
    | SPECIAL range (thrown), attack-triggered Multiattack, follow-up saves | 41    | Compile                                                  |
    | Equipment base-damage mismatch                                        | 39    | Discovery; the whole creature is unusable (21 creatures) |
    | Legendary options sent as `RESOLVE_ACTION`                            | 12    | Compile (D51)                                            |
    | Unsupported outcome kinds                                             | 3     | Compile                                                  |
    | Zero-damage hits                                                      | 5     | Execution                                                |

  - **Rulings:**
    1. Author an `ATTACK` roll definition with the printed bonus on every attack-triggered Creature Feature and option. A one-time authoring script generates it from the printed "+N to hit" (365 units). The 28 without a printed bonus take it from their base attack. It's committed as authored data, and the runtime never parses prose.
    2. Add a source-data invariant test, and fail early: discovery or compile rejects an attack-triggered action that has no ATTACK roll definition.
    3. Add a permanent SRD-wide sweep test: every SRD Creature attack must prepare, execute and plan through the room's functions. Known-unsupported shapes get an explicit, shrinking allowlist that fails if it grows.
    4. Follow-up slices, tracked by the sweep test: SEQUENTIAL/CHOICE paths, SPECIAL/thrown range and Multiattack, the Equipment base-damage mismatch, Legendary options as the creature's own actions (D51 B), outcome kinds and zero-damage hits.

  - **Rejected:** deriving the bonus from CR and ability scores. It is wrong in 22 or more cases against the printed values.

* **D52** Command speed, from the browserless V15 check ([v15-browserless-2026-09-26](../validation/phase-08-2/v15-browserless-2026-09-26.md)).
  - **Findings:**
    - The self-hosted backend re-evaluates each function's modules on every call, a fixed cost of about 55–150 ms that is 58–74% of each call.
    - Command p95 is 2.5–2.8 s against a 1 s budget.
    - A bound move makes about 7 serial Convex calls.
    - Each commit re-runs `projectionReads:get` once per subscribed player, about 6 times.
  - **Rulings:**
    1. Shrink per-call setup for the capture bundle, the commits, `encounterMovement:*`, `projectionReads:get` and the rules capture. Use narrower or lazy imports, and build no large schemas at module load. Prove it with per-function user execution time on the backend.
    2. Collapse the bound-move and reaction chain to at most 2 serial Convex calls per step. Fold route, begin, observe, capture and prepare into one call, and prepare into commit. This changes only the private room↔Convex routes, and keeps the write-ahead, fence and replay semantics.
    3. Re-run the browserless check. The 6-browser V15 runs only when command p95 is comfortably under 1 s and convergence p95 is under 250 ms.

  - **Caveat:** hosted Convex may cache modules differently, and the staging run (R09) will measure that. Both fixes help either way.

* **D51** D50 follow-ups:
  - **Legendary attack options.** Option B: a Legendary option names the creature's own action (Tail Attack runs the Tail action) and supports target selection. Area options wait on the area-targeting work. Until then, discovery skips options it can't execute instead of crashing.
    - **Done.** A Feature option authors `actionReference: { featureId, chargeCost }`. Every SRD "makes a <X> attack" option now names its action: the 20 adult and ancient dragons' Tail Attack, the Unicorn's Hooves, both sphinxes' Claw Attack, the Vampire's Unarmed Strike and Bite (Costs 2) and the Lich's Paralyzing Touch (Costs 2). The Vampire and Lich options stay unoffered until their actions' riders run (`OUTCOME_KIND`); Wing Attack and the Mummy Lord's "Attack" (fist or glare) are unchanged. The controller (the GM, or a granted player, D30) picks the option and its target; the action runs through the same prepared, phased path as `RESOLVE_ACTION`, with its attack, damage and critical dice, a forced save rolled by the target's controllers, Character or Creature targets, and the target's Concentration check. The sweep's 12 `LEGENDARY_OPTION` entries are gone.
  - **Stored-format changes.** `CANCELLED` is renamed to `RESISTANT_AND_VULNERABLE`, and Concentration `damageTypeId` is now nullable. Local data is reset under the standing reset approval, with no migration.
  - **E4, open: do SRD creature attacks work?** 381 of 471 SRD creature attack features have no attack-roll definition, and on the pure path they fail at execution ("dnd5e.attack-modifier is missing"). A read-only investigation is checking the room path. If it fails there too, it blocks closed beta and is fixed next.
* **D50** Rules defects found by the T2 fast tests. All get fixed, each with a test that fails first:
  1. **HIGH: Legendary discovery throws on SRD dragon attack options.** `encounterTurnLegendaryDiscovery.ts:33` calls `adapter.compile`, which throws on anything that isn't a self action (`effectActionCompiler.ts:1646`). So ending a turn in an Assisted Encounter with an SRD dragon crashes. Legendary options that are attacks (Tail Attack, Wing Attack) must be offered and resolve as actions. Discovery must never throw on one option.
  2. **Initiative tie-break.** The tie-break roll only orders the tied creatures, and their initiative count stays the same (SRD 5.1). Today `encounterInitiativeStateEvaluation.ts:54` overwrites the score, which breaks reinforcement placement.
  3. **Initiative roll log.** Log `1d20+modifier` as stored, and honor advantage on initiative (Barbarian Feral Instinct). Today `commands.ts:400-434` logs a bare 1d20.
  4. **Concentration saves.** One save per damage source, not per damage part (SRD 5.1). The DC comes from that source's total damage. First confirm whether the compiler emits several damage rows for one attack.
  5. **SRD data: Legendary costs.** Options authored "Costs 2 Actions" or "Costs 3 Actions" use those costs, fixing the adult and ancient dragons and the Unicorn. The SRD manifest diff must show only those changes.
  6. **Resistance and vulnerability together.** When both apply, halve (round down) and then double. They don't cancel (SRD 5.1), and today every odd amount comes out 1 too high (`effectActionCompiler.ts:4720-4737`).
  7. **Cleaving reach** uses the fixed D48 grid measure (`encounterCleavingFacts.ts:205-209`). This goes into the D48 batch.
  8. **Smaller fixes:**
     - Cleaving continues from a target at full HP that has temporary hit points, when the rules allow it.
     - A `CONDITION_REMOVE` receipt reports `applied` correctly when the condition is on both the Sheet and the Campaign.
     - `inMemoryInitiativeRepository` doesn't leak `expectedVersion` into DTOs or checksums.

  9. **Heal multipliers** apply the same way damage multipliers do, rounded down. This was found during the D48 fixes.
  10. **Ranged single-target** **`ON_USE`** **actions.** A `DISTANCE` range warns when out of range (D11). It isn't refused.
  11. **Gridless Scenes** measure the edge-to-edge gap plus the System's base square (5 ft). That matches the grid rule, where adjacent is 5 ft, so reach means the same thing on every Scene.
  12. **Area actions** (breath weapons, lines, cones, spheres) are confirmed as part of the queued area-targeting work (Phase 8.3, before closed beta). D48 proved Acid Breath's half damage on a single-target copy only.
  13. **Tests typecheck.** Add a repo typecheck config for `packages/rules-runtime/src/__tests__`, run through turbo and CI. Fix the two existing errors it finds: `dnd5eCombatMath.test.ts:815` and `encounterMovementReactionDecision.test.ts:47`.

* **D48** Rules defects found by the T1 fast tests. All are to be fixed, each with a test that fails first:
  - **Half damage on a successful save.** An `ON_SAVE_SUCCESS` outcome's `multiplier` (for example 0.5) must apply to direct saving-throw actions, such as the Black Dragon Wyrmling's Acid Breath. Today only the nested follow-up save shape halves damage, so the tabletop disagrees with the Sheet.
  - **Several non-dice outcomes on one save result.** Two or more fixed or condition outcomes on the same result path must not crash. Give every outcome group a unique node id, as dice groups already have.
  - **Grid distance.** Range and reach use the SRD grid rule: count squares to the nearest occupied square of the target, so adjacent is 5 ft. Today the gap between footprints undercounts by one square: a 5-ft reach reaches a target two squares away. The same measure drives opportunity-attack reach, so fix both from one shared measure. This supersedes the documented "between complete occupied rectangles" choice.
  - **Touch range.** A single-target Touch action (for example the Unicorn's Healing Touch) behaves as a 5-ft range that warns when out of reach (D11). It is not refused.
  - **Wording:** "This actor can't take an action right now."
  - **Creature saving-throw proficiencies.** Stat blocks with a Saving Throws line must use those modifiers. This needs a creature schema field and SRD data. It's queued as its own slice before closed beta. Its source-identity check requires a frozen tree.
* **D64** (2026-09-27) Reaction answers must be fast. After D59, `REACTION_RESPONSE` p95 sat at the 1 s V15 budget (1,008 and 987 ms).
  - **Why they are slow:** the answer runs a movement stage and then a commit on the critical path. Together they read about 400 documents and 1.5 MB, while an attack reads 62.
  - **Step 1, now:**
    - one transaction read memo that is aware of writes;
    - the room reuses its cached Run System when the stamp matches, so Convex stops resending it;
    - duplicated validation in the commit is removed.

    Every fence still reads within the transaction, and no check is removed.

  - **Step 2, next:** stage the held movement's inputs when the decision is issued, while the player decides, so the answer is one commit.
    - D26 already pauses play while a decision is pending, so the prefetch goes stale only if the GM cancels.
    - A stale prefetch fails closed on the commit fences and falls back to today's stage-and-commit.
    - Rules and dice still run in the room at answer time, so D41 and D27 are unchanged. This amends D52's stage timing.
    - **Outcome (2026-09-27): step 1 kept, step 2 built, measured and reverted.**
      - Step 1 halved the documents the stage and commit read, but their user time stayed at about 164 ms each: they are bound by CPU. `REACTION_RESPONSE` p95 moved to 956 and 986 ms.
      - Step 2's one-call answer took 468 ms and read 179 documents, the same work as stage plus commit. To verify the prefetched reads it has to re-read them, so the only saving is one route's overhead.
      - The prefetch queries (935 per run, about 6 per decision, p95 283 ms) competed for the same CPU, and the overall command p95 rose above 1 s.
      - The extra subject type, prefetch cache and query were not worth keeping for no gain, so step 2 was reverted: `611757d95`, `aef5acfdf` and `221fce311`, reverted by `91682875e`, `394511fbf` and `5d715e46e`.
    - **Next:** cut handler CPU in the movement stage and commit, guided by a CPU profile. Collapsing the calls is revisited only if the fences can check versions instead of re-reading content.
    - **Superseded (2026-09-27) by** **[ADR 0035](../adr/0035-room-authoritative-live-encounters.md).** The per-command Convex path is being replaced, so further tuning on it has stopped (user direction).
      - The CPU cuts that already landed stay, because the room reuses the same checksum and validation code: the inlined SHA-256 and the once-per-transaction derivations.
      - The last run of the old path (`v15bl-cpu1-r1`) had `REACTION_RESPONSE` p95 at 1,027 ms and command p95 at 799 ms, on a busy machine.
      - The 6-browser V15 runs only against the room-authoritative design.
    - The prefetch is admitted for the responder, and the answer command comes from the room instead of the staged save.
  - **The 6-browser V15** runs only once the browserless `REACTION_RESPONSE` p95 is clearly under 1 s.

* **D65** (2026-09-27, user-approved in Q16) The web app moves from Netlify to Cloudflare, and content snapshots and media are served from Cloudflare R2.
  - **Why:** egress is free, and the Worker, room, R2 and web app end up on one provider. Netlify's 300 monthly credits (15 per production deploy, 20 per GB of bandwidth) would limit a free launch.
  - **Before moving:**
    - confirm that TanStack Start SSR runs on Cloudflare Workers with the current SSR proxy and auth cookies;
    - check the Workers Free request and CPU limits for SSR pages (the 10 ms CPU limit applies to plain Workers);
    - migrate the DNS and domain.
  - **Sequencing:** its own slice, after ADR 0035 S0.
  - **Progress (2026-09-28):** the local steps are done ([ADR 0037](../adr/0037-web-app-on-cloudflare-workers.md); results in [the D65 record](../validation/phase-08-2/d65-cloudflare-web-hosting-2026-09-28.md#local-prototype-steps-13-2026-09-28)). The cloud steps wait for your approval; what you must do is in the [web Worker hosting runbook](../runbooks/web-worker-hosting.md), including choosing the staging and production web hostnames.
* **D66** (2026-09-27) Relationships (edges) on the future Campaign node map do not count against the Q18 per-Campaign entries limit. Only entries (nodes) count.
  - **Why:** edges are a few bytes each, and connecting records is the whole value of the board. Counting them would penalize the behavior the feature exists for.
  - **Safety:** a hidden cap on edges per Campaign guards against abuse.
  - **Source:** [market research](../market-research.md), "Implications for the Campaign node map".

- **D67** (2026-09-28) Content snapshots (ADR 0036) use one `SOURCE` scope per content source, PLATFORM sources such as the SRD included, plus `CAMPAIGN` scopes for shares.
  - **Why:** a Campaign's rules catalogues choose which PLATFORM sources it sees (for example 2014 vs 2024 in one System), and snapshot documents carry no source id. One System-wide object would leak another catalogue's content into the pickers.
  - **`SYSTEM` scope:** holds only System-level data (the System document, its vocabulary and reusable definitions), with its own object format, added in a later slice when a reader needs it. Until then no `SYSTEM` head is built.

* **D68** (2026-09-28) Replay after later commands (ADR 0035 Amendment 12).
  - Command rows keep a small replay receipt instead of the full result.
  - A retry replays with byte-identical bytes while the Run is still at that command's version, which is the retry window.
  - After later commands, a replay returns the receipt plus the current projection.
  - Idempotency is unchanged: no second effect and no reroll.
  - Run CREATE and decision replays already worked this way.

* **D69** (2026-09-28) Heavy chat is the expected case for remote play, and the Social Hub promotes remote tables (user direction). Two problems today:
  - `campaigns/chat:list` reads up to 500 entry headers on every re-run, to find the page and count unread entries.
  - It throws past 500 ("Stored conversation history mismatch.").
  - Because it is a subscription, every message re-runs it for every member.
  - **Decisions:**
    1. **Convex chat reads are bounded now.** Pages come through the index from a cursor. The unread count is a stored per-member counter. The 500 cap goes, and older history is paged.
    2. **During live play, chat goes through the room.** Messages fan out to the table at once and are persisted to Convex in batches with each checkpoint (ADR 0035 Amendment 8 extended from roll cards to all live chat). Chat outside live play keeps the bounded Convex path.
    3. **Cost models include heavy chat.** The V15 workload and the beta telemetry include heavy chat, and every cost figure states the chat volume it assumes.
  - **Decision 1 implemented 2026-09-28, with one change.** The unread count is derived, not stored: `min(50, visible entries after lastReadAt)` read from the room's time index, and the badge shows `50+` at the cap. A stored counter would make every send and unsend write every member row, contending with each reader's mark-read, and would still need a bounded recount on mark-read and on a new access epoch. The web subscribes to the newest page only and reads older pages once. With 2,000 messages, a new message costs each reader's newest page about 40 KB (was 224 KB at the old 500 cap) and `send` about 3 KB (was 187 KB). See [persistence.md](../architecture/persistence.md#conversations-and-chat).

* **D88** (2026-10-04) Encounter history is live rules state for the whole Run, so the room carries it (A35-S10d, ADR 0035 Amendment 22).
  - **Finding:** the Run's command rows, rule receipts and evidence rolls are not timeline-only. Pending decisions (Concentration chains, Cleaving, movement reactions, turn responses), the GM's void and undo, and replay read them.
  - **Decision:** the room keeps them in its own storage for the whole Run and carries them through every reload and re-activation instead of re-reading Convex. Checkpoints stop sending them; Convex keeps only the compact replay index. At COMPLETE both are deleted.
  - **Convex-side Encounter writes stay** (Run creation, departure and account reconciles while no room holds the Run). They are rare and small; the room merges them in at hydrate.
  - **Cost of the rare storage loss** (D85 accepts it): the timeline restarts, undo of earlier actions is refused, and a retry of an earlier command returns "applied" plus the current state.

* **D89** (2026-10-05) A room woken from hibernation keeps its players (REL-5, ADR 0035 Amendment 24). Decided by the product owner.
  - **Finding:** Cloudflare hibernates a room after about 10 s idle. Every wake asked every socket to sign in again, dropped the message that woke it, emptied the map cache and cost Convex calls. That failed the V15 browser percentiles. Keeping the room awake instead would bill wall-clock time for every session and still not cover deploys or evictions.
  - **Decision:** a sleeping room keeps who is admitted, each socket's feed subscriptions, its authorization lease and its map cache's identity in its own storage, and rebuilds the map from its own rows. A wake within the lease costs no sign-in round and no Convex call. No token is stored. The room's map reads use the Worker secret and the active epoch, not a player's token.
  - **Unchanged:** token expiry and the proactive re-challenge (Amendment 23), Campaign removal, `INVALIDATE_INPUTS` and Scene presentation changes.

* **D90** (2026-10-05) Convex receives a running table at save points, not every 30 s (REL-5, ADR 0035 Amendments 25–28). Decided by the product owner.
  - **Finding:** the passing six-browser V15 run a76 measured the 30 s checkpoints. Modelled on the session plan (2,000 combat commands and 120 minutes out of combat), they cost about 96 MB of Convex I/O per session against the Q16 budget of 4.3 MB. The model scales a76's per-command costs; it was not measured at real pace.
  - **Where the cost came from:**
    - Scene movement evidence: about 15 KB per move, re-read twice by the commit.
    - Whole actor documents rewritten.
    - The room reloading its own inputs after each of its own checkpoints.
    - Convex Scene reads re-running after every checkpoint.
  - **Decision:**
    - The room saves at save points only: Encounter START and COMPLETE, the other hold-changing moments, a Scene presentation change, table close, and a backlog bound for chat and roll cards.
    - Scene undo and replay evidence stays in the room, as Encounter history does (D88).
    - Commits stop re-reading what they wrote.
    - Nothing reads a running table's state from Convex.
  - **Why:** the room is the source of truth while the table runs; Convex is the record once it stops. Amendment 19 had already moved live readers to the room. The interval copy only guarded against losing the room's storage, a software-defect risk that applies equally to Convex.
  - **Cost of the rare storage loss:** changes since the last save point are lost, at most the current fight, and undo of earlier Scene moves is refused. This replaces D85's "about one round".

* **D91** (2026-10-05) Account deletion keeps the notes the GM can read, as Deleted user (PLT-7). Amends D87's Notes and Q10. Decided by the product owner.
  - **Rule:** content only its author could read is personal and is erased with the account. Content anyone else could read (the GM or the party) is Campaign history and stays, attributed to "Deleted user" the way chat and shared notes are.
  - **Effect:** a private note is visible to its author and the GM (D87), so private notebook entries and private Session notes are Campaign history. Account deletion keeps them, and leaving a Campaign already did. The purge (`purgeAuthorPrivateNotes`) is removed. Players still never see another member's private notes; the GM reads them under "Deleted user".
  - **Unchanged:** the account's profile, homebrew, drafts and Characters are still deleted (D74, D81).

* **D92** (2026-10-07) The GM plays a Character of their own like any player (CAMPAIGN-7, PLT-9). Party chat scope decided by the product owner.
  - **Rule:** the Campaign owner may assign, change and remove their own Character. It trades inventory, shares its Sheet through "Party can view", reads its own SUBJECT history and appears on the party roster and live summary exactly as a player's Character does.
  - **Chat:** "party chat" here means the public TABLE chat, where the GM's Character speaks in ROLEPLAY mode. The private PARTY room and PARTY announcements stay players-only (ADR 0013); DIRECT messages are unchanged. A member speaks in character only as their own Character: the GM's authority over other Characters does not extend to speaking as them, in Convex or in the room.
  - **GM authority:** the owner keeps full GM control of Encounters, other Characters and party inventory; owning a Character adds the player paths, it removes none.
  - **Ownership transfer:** the incoming owner keeps their assigned Character; acceptance no longer detaches it. The former owner keeps theirs as a player.

* **D93** (2026-10-07) Multiattack and Extra Attack are one authored attack-slot mechanic (ATTACK-8, ATTACK-11, ATTACK-7). Decided by the product owner.
  - **Finding:** every attack spends the Action, so each second attack of a Multiattack or Extra Attack raises a false `ACTION_ECONOMY_UNAVAILABLE` warning. The 142 SRD Multiattacks are closed-rule markers or text, and Extra Attack is a closed-rule marker.
  - **Model:** an action that grants attack slots spends the Action once and opens its slots for the turn. It is authored as alternatives, each a list of slots; a slot has a count, the actions that fill it, whether it is optional and whether it comes first. Swaps ("instead of its bite") are authored alternatives. Slot conditions are generic authored predicates (earlier slots in this action hit the same target; target size at most X). Nothing is special-cased per creature: anything SRD data uses is authorable in the editor.
  - **Runtime:** after each attack, only alternatives consistent with what was done stay feasible, and only actions that fill a remaining slot of a feasible alternative are offered. An action that is unavailable for its own reason (a Recharge not ready) is not offered. Auto-sequence comes from the same evaluation: the drawer shows what is left, preselects the only possible next attack and keeps the last target; the GM or player confirms each attack (Assisted means assisted). Each attack keeps its own roll, receipt, reactions and undo.
  - **Assisted mode:** an attack that doesn't fit the open action is not offered. "Do it anyway" stays only for attacking outside the action (ADR 0034). Manual mode tracks only.
  - **Characters:** the Attack action is one slot of weapon attacks (grapple and shove join it in ATTACK-7). Extra Attack is an authored "attacks per Attack action" total; several sources don't add together and the highest wins (SRD multiclassing; Thirsting Blade likewise).
  - **Engulf:** grapple riders ("on hit, grappled, escape DC 14") and "grappled by this creature" targeting are authorable effects built in ATTACK-7, which closes on the full Shambling Mound turn. Engulf is never offered before its target can really be grappled.
  - **Implementation (integration owner, 2026-10-07):** an open action is stored on the actor as `resources.attackAction` with the run's `turnSequence`, its total and the attacks made (action and targets). An action from another turn is closed, so starting a turn writes nothing. Extra Attack is a new `ATTACKS_PER_ATTACK_ACTION` value domain authored as SET_VALUE and folded highest-wins; Fighter gains the SRD table's "Extra Attack (2)" and "(3)" features at 11 and 20. Each attack receipt records the before and after state, so undo restores it like the Action allowance.

* **D94** (2026-10-07) Conditions apply their mechanics through one authored, System-owned condition policy (SPELLS-2). Decided by Claude under the AGENTS.md escalation rules; the behavior is the SRD's, and the contract is additive.
  - **Model:** a condition-rule-state definition carries `mechanics`: `D20_ROLL_MODE` (attacks by the holder, attacks against it within or beyond a distance, its saves, its ability checks), `SAVE_AUTO_FAIL` (abilities), `SPEED` (a fraction, rounded down) and `HITS_AGAINST_CRITICAL` (within a distance), each with an optional `minimumLevel` for leveled conditions such as Exhaustion. The SRD seeds Poisoned, Frightened, Prone, Restrained, Paralyzed, Unconscious, Stunned, Petrified and Exhaustion 1, 2, 3 and 5; homebrew conditions author their own. There is no per-condition code.
  - **Runtime:** the room pins held conditions' definitions on each Character and Creature target and derives their mechanics from the pins (`rules-runtime/encounterConditionMechanics`). Attack, save and check contributors join the derived roll mode with the condition as the reason (generic for a hidden holder). Without a Scene, melee counts as within a distance and ranged as beyond it.
  - **Outcomes:** the D&D test operation (v2) takes an `outcomeRule` (`NONE`, `SAVE_AUTO_FAIL`, `HIT_IS_CRITICAL`) bound to the `dnd5e.test-outcome-rule` fact, which the server binds from the pinned conditions. Single-graph verification recomputes the result path from it, and a two-phase save seals it in its TEST-phase bound-facts checksum, so a rewritten rule is rejected as stale. The d20 is still rolled and shown on an automatic failure.
  - **Speed:** condition speed applies to the movement budget before Dash and suspends Dodge at speed 0, in Convex and in the room (`readCurrentDefinition` is a base Encounter read port).
  - **Limits:** Frightened applies while present (the source of fear is not tracked); Blinded and Invisible stay with perception (attack-roll sight is D100); an Unconscious creature does not fall Prone; a condition gained after a target loads applies from the next load; concentration saves take no condition contributors or outcome rule; Convex-side action preparation reads do not apply conditions (the room resolves). Petrified resistance, Exhaustion 4 and 6, a Creature condition-level editor, the automatic-failure roll UX and concentration under conditions are registered as SPELLS-10.
  - **Cost:** a session-state read adds one Campaign-condition read per controlled Character; definitions are read only for held conditions. Hidden Campaign conditions still apply to the budget, as the GM's state does.
* **D95** (2026-10-08) Concentration ends, with no check, when its holder is incapacitated or defeated (SPELLS-9, SRD 5.1). Decided by Claude under the AGENTS.md escalation rules; the behavior is the SRD's, and the contract is additive.
  - **Trigger:** after a room commit's mechanics, an actor that holds concentration and can't act (the System's actor-action capability is unavailable: Incapacitated, Paralyzed, Petrified, Stunned, Unconscious, so a Character at 0 HP) or is defeated (a Creature at 0 HP, D63) loses it. Speed 0 alone (Grappled, Restrained) does not end it. Damage checks bound to that concentration in the same commit are not rolled. Creatures can hold concentration, and for them this is the only way it ends early.
  - **Paths:** direct actions, turn effects, cleaving and its response, movement reactions and spatial effects, the GM's actor edits, and Sheet condition or hit point edits on a Character in a running Encounter.
  - **Record:** each ending is a child receipt `CONCENTRATION_END` (`ownerActorId`, `maintainedStateId`, `reason` `INCAPACITATED` or `DEFEATED`, and the lost-check `cleanup` shape) on the commit that caused it, persisted through `applyLiveConcentrationCleanup`. Persistence re-derives the reason from the committed actors instead of trusting the planner. Chat shows it with the visibility of a concentration check card, without dice.
  - **Undo:** treated like a failed concentration check ("lost Concentration").
  - **Cleaving:** a Cleaving first target is always at 0 hit points, so its Concentration ends in the attack commit and no concentration check is pending before the Cleaving choice.
  - **Movement:** an end observes the state after the contact that caused it and is persisted as a `CONCENTRATION_END` child of the movement root. Later contacts of the same move roll nothing for that holder. A contact that applies a condition now interrupts the move for the Concentration pass like damage does. The receipt's cumulative spatial span ignores a later contact that changes nothing (a 0 HP holder taking more damage), and an end's owner `before` may add conditions the System derived from the contact's hit point change (D63).
  - **Edits:** a GM actor edit that sets a Creature or custom actor's hit points or conditions, and a Sheet edit (a player's, or the GM's, standalone or inside a GM actor edit's `characterCommand`) on a Character held by a running Run, end the holder's Concentration in the edit's own commit when it left the holder defeated or unable to act. The end is a `CONCENTRATION_END` child receipt whose `parentOccurrenceId` is the edit's command id (an edit has no rule occurrence), cleaned up through `applyLiveConcentrationCleanup`. On the Sheet path the edited Character's stream-version increment is shared with the cleanup (no second bump), and the table chat entry fans out in the commit. An edit that leaves the holder able to act ends nothing, and a later Undo of an earlier action reports the end as a later rule result. Persistence derives the reason itself, so these paths carry no stated reason to forge.
  - **Limits:** MANUAL Runs end nothing automatically (the GM tracks it). The chat entry names the holder, not the spell or condition, and a hidden Creature's end posts no entry (the receipt still records it). A movement contact scans one holder, its batch target; movement reactions are single-target today, so a future multi-target reaction must scan every holder it changes.
* **D96** (2026-10-08) Dying, death saves and death for Characters (SPELLS-3.2–3.6, SRD 5.1). Decided by Claude under the AGENTS.md escalation rules; the behavior is the SRD's, the Sheet-edit revival follows Foundry, and the persisted change is one required play-state field (dev data is reseeded).
  - **State:** Character play state gains a required `deathSaves` `{ successes: 0–3, failures: 0–3, stable: boolean }`. Dying means 0 HP, not stable and fewer than 3 failures; dead means 3 failures. There is no separate dead flag, so nothing can disagree.
  - **Damage:** damage that takes a Character to 0 with remaining damage of at least its effective maximum HP kills it (failures 3). Damage at 0 adds one failure, two from a critical hit, and kills it if it is at least the maximum; it also ends stability. The critical flag travels with the damage application into the Character mechanics batch.
  - **Healing and stability:** regaining any HP resets the death saves (and removes Unconscious, as today). Becoming stable resets successes and failures. A stable Character makes no death saves. Regaining 1 HP after 1d4 hours is left to the GM (a Sheet edit), as Foundry does.
  - **Death:** a dead Character is skipped like a defeated Creature (D63: turns, reactions, opportunity attacks, action eligibility, targets warn) and shows "Dead". Healing applications leave it unchanged. Any Sheet hit point edit above 0 (the GM's, or the owner's on their Sheet) revives it and resets the death saves; revival spells come with spellcasting.
  - **Death saves in an Encounter:** in an Assisted Run, a dying Character's turn starts with a death save, a turn stage after Recharge and before start-of-turn effects. It is a d20 with no modifiers that the actor's controller rolls through the ADR 0034 roll prompt, or that auto-rolls by their preference. 10 or more is a success, a 1 two failures, a 20 regains 1 HP. The roll card is Table or To GM, never hidden from the GM. MANUAL Runs prompt nothing; the table tracks death saves on the Sheet. Turn-stage rolls are not undoable, like Recharge.
  - **Stabilizing:** the STABILIZE effect (Spare the Dying, a Healer's Kit use) gets an executor: a dying target becomes stable; a target not at 0 HP, or dead, is the overridable `TARGET_NOT_DYING` warning and changes nothing. First aid is an authored System basic action: an action and a DC 10 Wisdom (Medicine) check by the helper that stabilizes on success.
  - **Sheet:** at 0 HP the Sheet shows three success and three failure marks that its editors can set, and a "Roll death save" button that rolls on the server outside an Encounter (always visible to the GM, like hit dice). Inside a held Run these are room Sheet commands like any other.
  - **Sheet commands (slice D, 2026-10-08):** `SET_DEATH_SAVES {successes, failures}` sets the marks at 0 HP only (three successes stabilize, three failures kill; same editor authority as `SET_HIT_POINTS`). `ROLL_DEATH_SAVE {}` is valid only while dying: the server rolls the one d20 (Convex, or the worker room for a held Run), applies the same rules as the turn-start save, and records the roll card in the same transaction with roll source kind `DEATH_SAVE` (label "Death save"). The card follows the roller routing of any Character roll: a player's goes to the Table, a GM's follows the GM's stored preference, so the GM always sees it; there is no per-roll "To GM" choice. The Encounter turn-start save uses the same `DEATH_SAVE` kind. A frozen actor's state carries a required `deathSaves`, so a departed or completed-Run Character that died still shows "Dead".
  - **Slices:** A — state, damage, massive damage, healing, death, undo (3.2, 3.3); B — the turn-start death save (3.4); C — the STABILIZE executor, proved with the Healer's Kit (3.5), and first aid (3.7; split 2026-10-08 with the user's approval, because Encounter spell casting arrives with SPELLS-8, which now owns casting Spare the Dying as SPELLS-8.2); D — Sheet tracker and roll (3.6) with the journey, plus showing Dead for a frozen actor (a departed Character or a completed Run), whose frozen state now carries a required `deathSaves`.

* **D97** (2026-10-08) Item counts: uses, quantity and price (AUTHORING-16; Q21). The user ruled that uses and quantity are different things and that there are no merchants: players add items and pay coin by hand. Claude decided the pricing.
  - **Uses** are an item's charges: the Healer's Kit is one item with 10 charges, named "Healer's Kit".
  - **Quantity** counts identical pieces: ammunition and Iron Spikes are single-piece items ("Arrows"), and firing one lowers the inventory quantity.
  - **Price** is per piece, derived from the SRD bundle price (Arrows 5 cp, Crossbow Bolts 5 cp, Blowgun Needles 2 cp, Sling Bullets 0.2 cp, Iron Spikes 1 sp). No sale-unit field is added: a future merchant interface ([future enhancements](../roadmap/future-enhancements.md#merchant-interface)) lists a line as item, quantity and price (Arrow, quantity 20, 1 gp), so the item never needs one.
  - Fixed measurements stay in names (Rope (50 ft, hempen), Pole (10-foot), Rations (1 day)): they never change.
* **D99** (2026-10-08) Grants apply through APPLY_GRANT (SPELLS-5; supersedes D15 and the future-enhancements lifetime sketch). The user approved the ACs and chose carry-over (Q1 A) and the visibility list (Q2 A). Claude decided the contract under the AGENTS.md escalation rules; the behavior is the SRD's.
  - **One pipeline.** An APPLY_GRANT outcome creates an active effect like any other compiled effect: the System compiler emits its plan, the room persists it in the action's receipt, and GM undo deletes it. A version-2 definition carries a `MODIFIER_GRANT` state contribution with the grant's modifier operations frozen at creation (in the Character grant fold's operation shape), its label ("Antitoxin") and whether its source was hidden. Senses use the existing `SENSE_GRANT` perception contribution. Proficiency grants stay manual: no SRD effect grants one.
  - **Readers.** A Character holder's active grants enter its grant fold as `ACTIVE_EFFECT` sources, so the Sheet and every Encounter flow derive AC, maximum hit points, speeds, senses, defenses, condition immunities and scoped save modes from the one fold. A Creature holder's grants overlay its Encounter target the way D94 condition mechanics do (AC, speeds, save modes, defenses, condition immunities, maximum hit points). The reason shown on a roll is the grant's label.
  - **Scoped saves.** A save is "against poison" (Antitoxin) when failing it applies Poisoned or deals poison damage; the save's prompt reads its failure consequences.
  - **Lifetimes.** A grant does not recur. Its TICKS expiration names an anchor, the holder or the source actor, and a boundary, the start or end of that actor's turn; "until the start of your next turn" is one tick at the source's start of turn, "1 minute" is 10 ticks at the holder's end of turn. The turn commit ticks every grant anchored to the boundary actor, wherever it is held, outside the kernel turn-effect phase: a grant has no per-turn behavior. `consumeOnFirstEvent ON_ATTACK_ROLL` deletes the grant when its holder's next attack roll is made, after that roll reads it. Authored durations gain a `turnAnchor {actor: TARGET | SOURCE, boundary: START_OF_TURN | END_OF_TURN}` on the result block's lifecycle; dev data is reseeded.
  - **Every attack roll consumes.** Opportunity attacks, Disarm and every other attack roll consume `ON_ATTACK_ROLL` grants the same way as an action's attack (a Legendary Action's attack at its window's turn commit). Undo follows the command: GM undo of an action restores what its roll consumed; opportunity attacks, Disarm and Legendary Action windows have no GM undo, so their consumption stands.
  - **Skipped turns and departure.** A defeated or dead actor whose turn is skipped still ticks both boundaries at its initiative place; undo is whatever the turn commit restores. A grant anchored to an actor removed from the Run (REMOVE_ACTOR) ends at that removal and is listed in its removed-effects receipt; removal has no GM undo. A Character removed from an active Run only leaves initiative (D82), so its grants count down through its skipped turns instead.
  - **Targeting yourself (SRD-derived).** The SRD's "Targeting Yourself" rule lets a creature choose itself as the target of a single-target effect unless the effect must be hostile or names another creature. So a self target is no `TARGET_DISPOSITION` warning unless the target's disposition is `HOSTILE`, the entry makes an attack roll (most SRD attacks are authored `ANY`, so the policy derives this from the roll rather than from data), or the authored targeting sets `excludesSelf: true` ("another creature", "a creature other than you": Bardic Inspiration, Healing Touch, Modify Memory). `excludesSelf` is authorable: it is a Targeting node beside Target Eligibility in the effect form. Help keeps its existing code refusal of a self target. The Antitoxin self-target warning was a bug.
  - **Reactions.** A creature under `REACTION_COUNT SET_VALUE 0` is offered no reaction (opportunity attacks included) while the grant lasts. The grant suppresses the System's reaction-allowance capability the way a relationship's capability suppressions do. An attack applies at most one grant, on a hit (`ON_HIT`) or only on a critical hit (`ON_CRIT`), like Shocking Grasp; the grant is the attack's one active effect.
  - **Concentration.** A grant whose result block names a `maintenanceDefinitionId` depends on the caster's maintained effect and ends with it (a failed check, D95 incapacitation, a new Concentration). A maintained grant on a Character holder is `OWNER`-scoped from creation (SPELLS-5.7) but keeps its Run link (`sourceEncounterId`, `maintainedEffectStateId`) so the in-Run Concentration end paths still remove it. When the Run completes the link is detached instead of the grant deleted: the grant is stamped with its caster's Character id (`lifecycle.concentrationCasterCharacterId`, `null` for a Creature caster) and the Campaign clock carries it on like any other grant (option B, below). A grant held by a Creature stays Encounter-scoped. A carried grant ends when its stamped caster starts another Concentration (SPELLS-5.7 slice 2): the room ends the carried grants held by the Run's Characters in the casting command, listing them in the maintenance receipt's `endedCarriedGrants` (CHARACTER-only; each owner also gets a transition, so a hit-point maximum the grant raised clamps current hit points and the Character stream moves). A null stamp (Creature caster) is never ended. There is no GM undo for a Concentration start that ends carried grants, the same as a replaced maintained effect (undo refuses with "a replaced maintained effect"); an undo after the checkpoint is moot. The movement-reaction path ends them the same way (it loads holders from the reaction's targets); a Character in another ACTIVE Run is held by that room and is never touched from this one. Deferred: ending a carried grant when its caster is admitted mid-Run (no such admission command exists yet). Built, rule 3 (Characters outside the Run): the room records every Character that commits a Concentration start in the Run row's append-only, bounded `concentrationCasterCharacterIds` (`MAX_ENCOUNTER_ACTORS`), through the one seam both the action and the movement-reaction paths use (`prepareEncounterActionMaintenance`). Each checkpoint compares that set on the previous and the next Run row and `endOutsideCarriedGrants` ends the grants stamped with the newly added ids on Characters outside any ACTIVE Run; a repeat on a handled id is a no-op. A Concentration cast and lost before the first checkpoint still ends them, because the id is recorded when the Concentration starts, not read from the maintained states later. Proven end to end by a real room Run (a Wizard concentrates, a Fighter outside the Run loses the stamped grant, the unstamped one survives) and by a movement reaction that starts a Concentration. The set is append-only except for one case: the stored `RESOLVE_ACTION` command records `addedConcentrationCasterId` (the id this command newly added, null when the Character was already in the set), and the GM's undo of that command removes exactly that id, so an undo before the checkpoint never ends outside grants, and undoing a later Concentration start leaves an id an earlier one recorded. Known edges: if a checkpoint already ended outside grants before the undo, the undo does not restore them (the same as a replaced maintained effect, which undo also refuses); a Character in another ACTIVE Run is skipped, as above; mid-Run admission (rule 2) stays deferred; a Concentration start that ends carried grants has no GM undo, so there is nothing to restore after the checkpoint. The SRD Fly, Heroism (its grant path), Protection from Energy (now a Concentration spell, as in the SRD) and Shield of Faith link the SRD Concentration maintenance definition. Heroism's per-turn temporary hit points stay unlinked until one cast can carry both of its entries under one Concentration (SPELLS-8.3).
  - **Carry-over (Q1 A).** When a Run completes, a Character's remaining grants become Character-owned and expire at an absolute Campaign-clock minute (the clock at completion plus 6 seconds per remaining round), processed by clock recovery. Without a Campaign clock they last until the GM ends them. A Creature's grants end with the Run. The room has no Campaign clock, so the checkpoint that completes the Run converts them in Convex (rounding up to whole minutes) and the room reloads those Characters; COMPLETE deletes the Character effects the Run itself sourced (contract change: the lifecycle gains an optional, nullable `expiresAtCampaignMinute`: absent while in a Run, a minute once carried, `null` when carried without a Campaign clock). Advancing the clock ends the carried grants it reaches, except on Characters in a live Run, which the next advance checks.
  - **Visibility (Q2 A).** Active grants are listed on the token, the turn tracker and the Sheet with their label and time left; the GM can end one by hand. A hidden source's label stays hidden from players. Contracts: Encounter actors and the Sheet overview carry `activeGrants`; a COMPLETED Run lists none (it reads no effects). The Campaign owner ends a Character's grant with the Sheet command `END_ACTIVE_EFFECT {effectId}` (gated on Campaign ownership, so it works on the GM's own Character under D92; refused for a grant a running Run's Concentration still maintains, which that Concentration ends; allowed once the Run completed and detached it) and a Creature's with `UPDATE_ACTOR.endActiveEffectId`. The Sheet's `capabilities.endActiveEffects` tells the UI. Ending a grant has no GM undo.
  - **Speeds, hit points and senses (SPELLS-5.6).** A grant raises its holder's speeds, maximum hit points and senses wherever they are read; when a maximum hit point grant ends, current hit points above the new maximum fall to it. Contract change: the `MODIFIER_GRANT` contribution gains a required `senses` list (granted senses such as the Darkvision spell's 60 ft), and a contribution needs at least one modifier or sense. A grant row stored by an earlier SPELLS-5 build fails to parse until it gains `senses: []`; only a local backend that ran those builds can hold one. The tabletop movement readout keeps one total `used` and gives one allowance per speed type the actor has (after grants and condition scaling, times Dash); a voluntary move may name its `speedId`, an unknown id is refused, and the allowance is still displayed, never enforced. Aid's bonus scales with the slot it is cast with, which grants do not record yet, so the compiler leaves it manual until spell casting (SPELLS-8) resolves cast-time amounts.
  - **Shared-contract notes (slice A2, for review).**
    - _No application, by design._ A grant proposal's trace marks `changesTargetState: false`, and stored-result application coverage skips such a candidate. A grant creates an active effect, which the receipt records, but it writes nothing to the target's stored state, so it never has a target application.
    - _Counted turns with no application._ A turn-effect batch accepts a counted turn that has zero applications and an unchanged target when its only source trace is `dnd5e.condition-duration`. This closes a gap that predates SPELLS-5: a timed condition's non-terminal tick (D62.2) already returned an empty, allowed result, but the batch DTO rejected it. No journey advanced a multi-turn timed condition before the Antitoxin journey did. Grant ticks move out of the turn-effect phase in the lifetimes slice; timed conditions keep relying on this rule.
    - _Reason labels._ Grant contributors carry the Character mechanic key `ACTIVE_EFFECT:<id>` (the same key the Character grant fold uses), so the roll-reason reader resolves that key, like `active-effect:<id>`, to the grant's frozen `sourceLabel`. The label is the granting item's authored label (for example "Antitoxin (vial)").

* **D98** (2026-10-08) First aid, a basic action with a check (SPELLS-3.7, follows D45 and D96). Decided by Claude under the AGENTS.md escalation rules: D96 fixes the behavior; this entry fixes the shape.
  - **Catalogue:** a new closed mechanic `STABILIZE_TARGET`. A basic-action entry gains a required, nullable `check` `{ checkDefinitionId, dc }`, set exactly when a mechanic needs one. The SRD System authors "First Aid" (Action; Wisdom (Medicine), DC 10). Checks use the System's check definition, so Medicine's total, roll mode and contributors come from the same facts as contest checks.
  - **Target:** the command's `allyActorId` becomes `targetActorId`, the one target of Help (an ally) and of first aid (a dying Character). Help's stored effect keeps `allyActorId`. A first-aid target that isn't dying is the overridable `TARGET_NOT_DYING` warning and changes nothing, as for the Healer's Kit. Touch range uses the same warnings as the kit.
  - **The roll:** the helper makes the check through the ADR 0034 roll prompt (its controller rolls in the app or types the result) or auto-rolls by their preference. The roll card is credited to the helper and is never hidden from the GM. Help's ally advantage and condition check modes apply, and a used Help is consumed. A paused first aid has already spent its Action. Reaching the DC makes the target stable; a failure changes nothing.
  - **Limits:** a custom actor has no check facts and is refused. In a MANUAL Run a basic action that carries a check is refused as `ASSISTED_ONLY` (ENCOUNTER-2), because the table tracks death saves on the Sheet. GM undo restores the Action, a used Help and the target's death saves; the roll itself stays on the record.
* **D100** (2026-10-09) Attack-roll perception: unseen attackers and targets, and Dodge's sight check (ATTACK-10.1; closes the sight gap in D45 and D46, follows D62's derived roll-mode reasons and the D94 neutral-environment convention). Decided by Claude under the AGENTS.md escalation rules: D94 and D45 fix the behavior; this entry fixes the shape.
  - **Where (current):** the room's `RESOLVE_ACTION` (`nativeEncounterRules.ts` in `apps/session-worker`) passes an optional `loadAttackPerception` to rules-runtime `prepareEncounterActionMechanics`; the module is `packages/rules-runtime/src/encounterAttackPerception.ts`. It applies to attack rolls only.
  - **Both directions:** combat perception (requirement SEE) is resolved for "does the target see the attacker" and "does the attacker see the target". Each sight is `SEES | UNSEEN | UNKNOWN`.
  - **Effects:** a target that can't see the attacker gives ADVANTAGE (contributor `rule:unseen-attacker`, reason "Unseen attacker"). An attacker that can't see the target gets DISADVANTAGE (`rule:unseen-target`, "Unseen target"). Dodge's `DISADVANTAGE_ON_ATTACKS_AGAINST` is dropped only when the dodger definitively can't see the attacker.
  - **Inputs:** the ordinary-sight baseline, Character pinned senses, active effects, pinned condition definitions (Invisible is an emission suppress of VISUAL that perceives-invisible senses such as truesight bypass; Blinded is a sense suppress of VISUAL) and, with a Scene, its tokens, effective grid, lighting, darkness, barriers and spatial effects. Without a Scene the environment is neutral (bright, unobscured, line of effect), so conditions and senses still apply (D94 convention). The Scene read must match the action's locked Scene id and version.
  - **UNKNOWN:** a Creature observer with authored free-text senses whose ordinary sight fails. Those senses aren't structured, so there is no contributor and Dodge stays. Characters, and Creatures without senses, are definitive.
  - **Never inputs:** fog and viewer projection (an actor public or hidden from players). The "Unseen source" redaction of player roll prompts is viewer redaction and unrelated to this rule.
  - **Not automated:** "hidden" through the Hide action (a Stealth check, with the hidden state ending on attack) stays unautomated.
  - **Not wired (current):** Convex action preparation, Disarm, and opportunity attacks (movement-owned; the movement reaction's perception also doesn't pass condition contributions).
  - **Believed vs true mode (user ruling 2026-10-09; the interpretation below is Claude's):** a roller is never told sight facts their Character can't know.
    - **Prompt:** the player's roll prompt shows the _believed_ mode. The GM (Campaign owner) sees the true mode.
    - **Believed sight (`encounterAttackBelief.ts`, `resolveEncounterBelievedAttackPerception`):** uses only the attacker's own facts on the neutral environment.
      - Does the target see the attacker? Modeled as a stripped target (System baseline sight only) looking at the attacker as it is, so the attacker's own Invisible counts.
      - Does the attacker see the target? Modeled as the attacker as it is (its own Senses, Blinded) looking at a stripped target.
      - The target's Senses and conditions and the Scene's lighting are never inputs.
    - **Believed contributors:** the true contributors with the sight-decided ones (Dodge and the unseen contributors) swapped for the believed ones. The belief is stored in the pending action context.
    - **On commit:** a _sight-governed_ d20 always settles in the true mode, whatever mode was chosen (the GM changes sight by changing facts). A d20 is sight-governed when the belief differs or an unseen contributor is present. Other overrides are unchanged.
    - **Settling the dice:**
      - Two dice rolled, true mode normal: the first die is kept and the second is cancelled.
      - Two dice rolled, mode flipped (advantage to disadvantage or the reverse): the kept die changes.
      - One die rolled, true mode needs two: the app rolls the second for an app roll. For entered dice, the action goes back to pending on the same request, keeping the face, and asks for one more d20.
    - **Cards:** a d20 whose mode changed carries `modeAdjustment` (all dice, cancelled and added indexes, captions). It is always carded at commit, with `ruleCheck` `D20_MODE_ADJUSTED`.
      - **Table card:** a generic player caption that never names a Sense, e.g. "Advantage cancelled: the target can sense you".
      - **GM copy:** the GM's history gets a copy, already revealed, with the specific reason, e.g. "Gorgon senses Mira with Blindsight". A private card carries only the reason.
    - **Not covered here:** saves (ATTACK-10.5) and the cancelled-die animation (ENCOUNTER-8).
* **D101** (2026-10-09) A caster ends their own Concentration by choice (SPELLS-5.11; follows D95 and D99). Decided by Claude under the AGENTS.md escalation rules; the SRD fixes the behavior (a caster can end Concentration at any time, no action) and the coordinator ruled R1-R2 and Q1, Q3-Q5.
  - **Command:** a Sheet command `END_CONCENTRATION` (no fields), owned by the caster (`managePlayState`) and allowed for the GM. It is a live play command, so in a live table it goes through the room and is gated by the Convex hold (`assertConvexOwnsCharacterPlay`). A Creature or custom actor has no Sheet; the GM ends its Concentration with Encounter `UPDATE_ACTOR { endConcentration: true }`. A Character is refused there, so there is one path per actor kind.
  - **In a Run:** the end writes the same `CONCENTRATION_END` child receipt as D95 with reason `CHOSEN`, keyed on the command id (a chosen end is a distinct occurrence; involuntary ends keep the D95 key), takes no check and no dice, ends every dependent grant, and posts "<name> ends Concentration." to chat. The caster joins the Run's `concentrationCasterCharacterIds`, and a carried-over grant held by a Run Character ends in the same command.
  - **After the Run (carried):** a finished Run leaves the slot behind as grants stamped with the caster (D99). Convex ends every grant stamped with the caster; the caster's own is deleted before the Sheet write so the HP clamp applies, and every other holder's stream moves once. This end has no maintained state, so it records no `CONCENTRATION_END` receipt; the Sheet command receipt is its record. It throws when nothing is carried.
  - **Index (R1):** Character effects keep the caster in an indexed column (`by_concentrationCaster`), mirrored from `lifecycle.concentrationCasterCharacterId`; readers and the SPELLS-5.7 ending of outside grants use it, and nothing scans assigned Characters.
  - **Caster outside the Run (Q1, resolved):** a carried-grant holder in an ACTIVE Run belongs to that room, and one Durable Object serves the Campaign, so the end goes through it. The web asks Convex `characters.sheetSlices.concentrationRoomRoute` which Encounter holds a carried grant of the caster, and one user action sends `END_CONCENTRATION` twice under the same command id: Convex first (`endCarriedConcentration` ends the caster's own grant and every holder outside an ACTIVE Run, and skips a holder an ACTIVE Run holds instead of refusing), then the room, even though the caster is not held. The room checks the caller (the caster's owner player or the GM, through Campaign Character authority) before the hold check, then `endOutsideCasterConcentration` ends the stamped grants of held holders at once with no GM approval and appends the caster to the Run's `concentrationCasterCharacterIds`. Every holder therefore ends at once, the caster's own included. Any other command for a non-held Character is still refused. Range does not matter (SRD). Convex replays by the Sheet command receipt and the room by its journal receipt, so each is idempotent by command id. A room failure after Convex succeeded leaves the held holders' grants and the caster still concentrating; the user retries and the checkpoint remains the safety net, since the caster is in the Run's caster set once the room has run. A caller that sends only the Convex command leaves a live holder's grant until a room command or the caster's next Concentration.
  - **Exact retry:** the room's journal receipt keeps the synthesized acknowledgement, and `nativeLiveSessionRoom.ts` replays it for a non-held caster (the held Character path still re-reads its receipt); an exact retry ends and records nothing twice.
  - **Visibility (Q3):** the Sheet shows `overview.concentration` (label and `sourceHidden`) to the caster and the GM only; a hidden source's label is null for the caster. A party member sees none. The Encounter actor projection carries `concentration` for the actor's controllers and the GM (null for other players); the drawer shows an End control for it, a Character through the live Sheet lane and a Creature or custom actor through `UPDATE_ACTOR { endConcentration: true }`.
  - **GM notice (ruled 2026-10-09):** an Encounter history entry visible to the GM only. When the outside-caster end ends a held holder's grant, `endOutsideCasterConcentration` writes a Run command row of the new kind `CONCENTRATION_DROPPED_OUTSIDE` (`label`: "<caster> dropped Concentration: <label> ends on <holders>", at most 160 characters), keyed on the command id, and advances the Run version by one. The kind never reaches a client as an Encounter command, so it sits outside `encounterCommandInputDtoSchema`; its stored input is `encounterConcentrationDroppedOutsideInputSchema`. The timeline entry is PRIVATE like every command except a public enemy roll, so only the GM's timeline reads it. The version bump makes another client's in-flight Encounter command read the Run as changed; it refreshes from the room push.
* **D102** (2026-10-09) A single-use item is used up in Assisted play (SPELLS-11; follows D101). Decided by Claude under the AGENTS.md escalation rules; the coordinator ruled the behavior and the overlay design.
  - **Behavior:** in an Assisted Run, using an item whose authored `CONSUMED_ON_USE` attribute is set removes one from the holder's equipment, whether it is drunk or administered. The last one removes the item. The item is used up even when the GM overrides an Undead or Construct warning. A Manual Run leaves the count for the table. There is no Campaign toggle. The attribute is set only on single-use SRD items: Potion of Healing, Antitoxin, Acid, Alchemist's Fire, Holy Water, Oil flask and basic Poison. Caltrops and Ball Bearings are not single-use. The SRD corpus holds no other potions or vials with a use effect (Perfume, Vial and Flask or Tankard have none).
  - **Overlay (Option A):** the play record carries `itemUsage: [{ itemInstanceId, used }]` next to `resourceUsage`. The effective quantity is the stored quantity minus `used`, and a row whose effective quantity is 0 is hidden. `readCharacterRecord` returns the effective inventory, so every reader sees the lower count through one pure helper (`effectiveInventory`). Convex never writes play to fold usage into structure: it would break the room's play-only write rule while a Run holds the Character.
  - **Structural editors:** they work on the effective quantity, and the writer translates back (`storeInventory`): stored quantity = edited effective quantity + used. A hidden row that the edit cannot see is reinserted at its original position. Deleting an item prunes its usage. The room's reconcile keeps equipped, attuned and usage entries for any row the structure still stores, hidden ones included, so an undo restores them.
  - **Stale and offered:** a used-up item is not an offered action. A stale request is refused with the domain rejection `VERSION_STALE` ("That action is no longer available"), never offered as "do it anyway".
  - **Undo:** the GM undo gives the item back by lowering its usage to the recorded `beforeUsed`; it is fenced by the Character stream version and refuses if the usage changed.
  - **Receipt:** the action receipt records `sourceItemConsumption` (before and after usage and quantity). The room's commit input carries `itemConsumption`, which Convex checks against the receipt exactly as it does `resourceConsumption`. A movement reaction refuses an item consumption.
  - **Stale drafts:** a Builder edit commit builds from the active record's current play state, and a Sheet inventory command carries `itemUsage` through and refuses a stale `expectedVersion`, so neither gives back an item used after it was read. Normalizing usage into structure at a quiet point (a write where Convex owns both records with no live room) is a candidate, not built.
* **D103** (2026-10-10) Point-origin area actions (SPELLS-7; follows D19 and D100; effect outcomes are refused until SPELLS-19). Decided by Claude under the AGENTS.md escalation rules; the user's 2026-10-10 rulings fix the behavior (every save asked at once, each by its creature's own roller; the caster learns only what they perceive) and this entry fixes the shape.
  - **Target and origin (current):** the action `target` is a closed union, `{ kind: 'ACTOR', actorId }` or `{ kind: 'POINT', point }`, with no flat alias. A POINT target with an area-contents action opens an area; a creature target for one is refused. The cube origin is the center of its bottom face, so the footprint is centered on the point, and cylinder height is ignored on a flat Scene (`packages/rules-runtime/src/encounterAreaAction.ts`). A point beyond range is the overridable `TARGET_OUT_OF_RANGE` warning (`TARGET_RANGE_UNCHECKED` without the caster's token). A point the caster cannot see is the overridable `TARGET_OUT_OF_SIGHT` warning, listed after the range warning and acknowledged through the same `acknowledgedWarnings`. Sight of a point is the D100 perception rules with the point as a subject with no conditions, effects or extent (`resolveEncounterPointSight`, reading the same live Scene as attack perception): the caster's conditions (Blinded) and Senses, Scene lighting and darkness at the point, and light-blocking barriers decide, and without a Scene only the caster's conditions do (D94). An undecided sight (a Creature's unmodeled free-text Senses) counts as seen and raises nothing, as D100 does not penalise it either. Self and Touch areas belong to SPELLS-13.2.
  - **One pending occurrence, atomically:** the room opens one `ENCOUNTER_AREA_ACTION` AGGREGATE_CHOICE occurrence (`encounterAreaPending.ts`, `nativeEncounterAreaRules.ts`). It catches every actor with a token touching the area from the Scene the caster saw, once each, the caster and allies included (`catchEncounterAreaActorIds`, `encounterAreaActionExecution.ts`), fenced by the Scene version (`ACTION_AREA_SCENE` capture). Each caught creature gets its own sealed save under an occurrence id derived from the area's and its own (`encounterAreaTargetOccurrenceId`). `caughtChecksum` seals the Scene version, the area and the caught creatures with their token footprints (sorted by actor id). Nothing is rolled for damage at open.
  - **Saves, any order:** each save is answered by its creature's own roller (the creature's controllers or the GM, D19), in any order; the others stay as sealed. A roller who auto-rolls has their save rolled for them as the area opens; `SYSTEM_ROLL` admits an area save by request id. A creature that has already rolled cannot be removed.
  - **Legendary Resistance, per target and interstitial:** a failed Creature save opens a sealed offer (the failed execution, the creature's facts, the d20 policy and the pinned resistance; `encounterAreaLegendaryResistance.ts`, sharing `encounterLegendaryResistanceChoice.ts` with movement). It is answered by `AREA_LEGENDARY_RESISTANCE { actorId, decision }` from the GM or the creature's controller, in any order, and the caster never sees it. A decision is checked against the offer, the failed save and the creature's pool as they are now, and a used resistance turns the failure into a success. The area does not settle while an offer is undecided.
  - **Frozen damage:** at settlement damage is rolled once across the area: the first creature that needs die n rolls it and every later creature replays it, and an outcome that would roll a different die is refused. Each creature takes the outcome its own save selected (full on a failed save, half on a success, as the action's plan says) after its own resistance, immunity and vulnerability.
  - **GM removal:** `REMOVE_AREA_TARGET { encounterId, occurrenceId, actorId, expectedVersion, expectedOccurrenceVersion, expectedCaughtChecksum }` is GM-only (`GM_ONLY`) and takes one creature out of a pending area (`areaTargetRemoval.ts`). It is not a Run command: it records nothing and does not move the Run version while the area still waits on another creature. The occurrence version moves, the checksum is sealed again over those still caught and `removedActorIds` is kept, so a save answer or removal composed against the earlier set is stale. A creature that has answered, or that the area never caught, is refused (`TARGET_UNAVAILABLE`). A repeat of an applied removal is answered from the current state, after the stale-version check.
  - **Commit:** the last save answer, the last Legendary Resistance decision, a removal that leaves nothing to wait on, or the open itself when every save auto-rolls, commits the area in one transaction (`areaCommitPersistence.ts`, `planNativeLiveEncounterAreaCommit`). The root is an `AGGREGATE_CHOICE_COMPLETE` receipt (output `ENCOUNTER_AREA_ACTION`) under the command that opened the area. It holds the source spend (resource, item, stow, action economy) once, plus one child batch per kept creature (`ENCOUNTER_ACTOR_MECHANICS_BATCH` or `CHARACTER_MECHANICS_BATCH`) under that creature's derived occurrence id. A Legendary Resistance charge sits on the creature's own child. A Character caster caught by their own area carries the spend in their own batch, so it lands in the same Sheet write as their outcome. Each damaged creature gets one Concentration check. An area that keeps no creature commits the root with the spend only: no children, no damage card. The Encounter version moves once.
  - **Undo:** `REVERT_LAST_ACTION` reverts the child batches in reverse of the order the root's `targetOccurrenceIds` names, then the root's spend (`actionRevert.ts`).
  - **Refused outcomes (SPELLS-19):** an area whose plan or settled outcome would leave a condition, a lasting or recurring effect, a relationship condition or a maintained effect is refused whole with `TARGET_UNAVAILABLE`, at open from the plan and at commit from the settled outcome (`refuseAreaEffectOutcomes`); nothing persists. Action receipts do not yet spend a spell slot (SPELLS-8.1).
  - **Visibility per role:**
    - **Perception sealed at open:** the caster's D100 sight of each caught creature is stored on the occurrence as `perceivedByCaster` (an UNKNOWN sight counts as perceived).
    - **Pending summary (`AREA_SAVES`):** `caught` is labels only. The GM reads every caught creature, the caster's controller reads those perceived, nobody else reads any. `caughtChecksum` is the GM's alone. `casterActorId` is null unless the viewer controls the caster or the caster is public. A roller reads only their own creature's saves and Legendary Resistance offers; the GM reads all.
    - **Timeline (`ISSUER`):** the stored `RESOLVE_ACTION` carries `issuerLines` and `gmLines`. An entry with `issuerLines` has visibility `ISSUER` (otherwise `PRIVATE`): the GM and the user who issued the action read it, other players do not, and a player's copy has empty `gmLines`. `issuerLines` hold "<label> failed its save" or "<label> succeeded on its save" for a perceived creature, "An unseen creature failed its save" for an unperceived one that failed, and nothing for an unperceived success; a used Legendary Resistance counts as a success. `gmLines` hold "GM removed <label> from the area" in the order made, written at commit.
    - **Roll cards:** the save card of a creature the caster cannot perceive is routed as a hidden roller's is (`rollerAsPerceivedByCaster`, D62): the GM's private history only. The player who rolled it gets no card yet (ATTACK-17.5). The area's one damage roll is carded once, with the first creature.
  - **Proof and follow-ups:** Creature casters only: no Character spell reaches `RESOLVE_ACTION` yet, so the Character-caster proof moves to SPELLS-8.4. Registered: SPELLS-18 (Legendary Resistance on a single-target action save, which then threw; done in D104), SPELLS-19, ATTACK-17.5 and SPELLS-13.2. The web does not yet render the caught list, the area saves and Legendary Resistance offers, `issuerLines` or `gmLines` (the web round in the handoff).
* **D104** (2026-10-10) Legendary Resistance on a single-target action save (SPELLS-18; follows D103's per-target interstitial ruling). Decided by Claude under the AGENTS.md escalation rules.
  - **Hold:** when a `RESOLVE_ACTION` TEST ends `ON_SAVE_FAIL` against a Creature with an available Legendary Resistance, the room does not run the OUTCOME. The `ENCOUNTER_ACTION` pending context keeps a sealed `legendaryResistance` offer (the failed TEST execution and d20, the TEST d20 policy, the target state checksum and the resistance pin); the snapshot continuation is the Legendary Resistance choice and `rollerActorId` is the creature. Nothing is spent while it waits. The offer is made even when the creature auto-rolls: it is a decision, not a roll.
  - **Answer:** the existing `DECLINE` / `OPTION { optionId }` resolution, from the GM or the creature's controller; the caster's player neither reads nor answers it. Read as the existing `LEGENDARY_RESISTANCE_CHOICE` summary, so the decision drawer is unchanged. The room rebuilds the TEST from the retained faces without rolling, checks the offer against the creature's current pool and state, and continues the OUTCOME: USE takes the success branch, DECLINE the failure.
  - **Commit and undo:** the action receipt records the decision and, on USE, the charge as `targetFeatureResourceConsumption`, written in the same transaction; GM undo returns it. Area, movement and single-target paths share `decideEncounterLegendaryResistance`, candidate discovery and the TEST reconstruction.
  - **Proof:** `nativeRoomActionLegendaryResistance.test.ts` (room), `encounterActionLegendaryResistance.test.ts` and `encounterAreaActionExecution.test.ts` (stale offer, pool and pin refusals). Undo writes a restored charge as `0` rather than removing the key, the same as every other charge revert; both read as unspent.

* **D105** (2026-10-10) Grapple, shove, escape and forced movement (ATTACK-7; replaces D57 ruling 2 option (a) and settles D62.3). Product choices decided by the product owner 2026-10-10; the contract is Claude's under the AGENTS.md escalation rules.
  - **Grapple is a relationship.** A grapple is an Encounter active effect on the grappled creature whose `ACTOR_RELATIONSHIP` contribution has the grappler as `origin.sourceActorId`, owns its conditions (Grappled, plus any printed "until this grapple ends" condition) and seals the grappler's reach at creation. Ending the effect removes those conditions. Hit riders and the Grapple basic action produce the same shape.
  - **Checks are authored, never implied.** `ESCAPE_CHECK` replaces its single ability with a non-empty list of allowed check definitions (skills or abilities) and a DC that is either `FIXED` or a `CONTEST` against the grappler's authored checks. SRD data follows SRD 5.1 (lines 5353-5359): the Grapple and Shove basic actions author the grappler's Athletics against the target's Athletics or Acrobatics (target's choice), Grapple's escape is Athletics or Acrobatics contested by the grappler's Athletics, and every monster "escape DC N" authors that fixed DC with Athletics or Acrobatics. The Cloaker keeps its authored check. Homebrew authors anything.
  - **Grapple and Shove** are basic actions that fill one slot of the Attack action (D93), against a creature within reach and no more than one size larger. A Grapple without a free hand is an overridable warning (wield state); monster riders are exempt. Shove's winner chooses prone or a 5-foot push away.
  - **Escape** costs the grappled creature its Action (the module's authored activation); the escaper picks one allowed check. FIXED rolls against the DC (the First Aid check path); CONTEST uses the two-roller contest engine (the Disarm path).
  - **Ending:** the grappler releases with no action; the grapple ends when the grappler can't act (`encounterActorCannotAct`, swept after each commit like D95) or when any movement leaves the grappled creature outside the sealed reach.
  - **Drag:** a grappler's voluntary move takes each grappled creature along at the same displacement; the move costs double unless the creature is two or more sizes smaller. A blocked destination for a dragged creature is refused (release first). Dragged creatures do not use their movement and provoke no opportunity attacks.
  - **Forced movement** is one path: the authored directive's direction (`AWAY`, `TOWARD`, `ASIDE`, `ANY`) and distance (`EXACT` or `UP_TO`) bound the legal unoccupied squares. `AWAY` and `TOWARD` move the target along the straight line from the source through the target (Sage Advice: Shove and push effects are directly away); the mover chooses only how far, and only when the distance is `UP_TO`. `ASIDE` moves the target to a different space within the source's reach (the DMG Shove Aside option, p. 271: the shove's Athletics check is made at disadvantage and a win moves the target 5 feet to such a space; built in MOVE-2). `ANY` lets the mover pick any legal square within the distance (a later 2024 rules module authors its own direction). It provokes no opportunity attacks. Shove is `AWAY`, exactly 5 feet; Pushing Attack would be `AWAY`, up to 15 feet; the Crusher feat (not SRD, a homebrew test case) is `ANY`, exactly 5 feet.
  - **Slices, in order:** A riders and the `ESCAPE_CHECK` contract (ATTACK-7.8); B Escape against a fixed DC (7.3); C the Grapple action and contested escape (7.1, 7.3); D release and ending (7.4); E forced movement (7.7); F Shove (7.6); G drag (7.5). Each slice ships its room, Convex and web parts. ATTACK-7.2 (Engulf) waits for ATTACK-11; swallow riders stay with ATTACK-5.

## Approved implementation decisions

- **D70 (2026-09-29): packed history with indexed receipt headers. Decision maker: Codex.**
  Codex chose and recommended storing immutable history payloads once per checkpoint while retaining
  small per-command indexed receipt headers pointing into the checksummed ledger. The user approved
  this decision on 2026-09-29. Existing replay, command-ID collision checks, public UUIDs, privacy and
  complete timeline pagination remain required; headers do not duplicate history bodies or results.
  Native ledger/header persistence and reader adapters are integrated locally; checkpoint publication
  and final acceptance remain unfinished. The rationale and implementation
  boundary are recorded in [ADR 0035 D70](../adr/0035-room-authoritative-live-encounters.md#d70-packed-history-with-indexed-receipt-headers--2026-09-29).
  **Clarification approved 2026-09-30, decision maker: Codex:** pack each Character's private
  receipts separately from shared Campaign/Encounter receipts. Include the additional ledger
  metadata in Q16 measurements.
- **D72 (2026-10-01): live rate limits per account within each room. Proposed by Codex; the user
  approved it with one change on 2026-10-01.**
  - **Why per room:** an account-global counter across Campaign rooms would need a Convex or
    cross-room call on every warm command, which contradicts ADR 0035's zero steady-state Convex
    calls.
  - **Where counters live:** inside each live Campaign room, shared by all of that account's
    sockets and committed atomically in room SQLite, so a reconnect does not reset them.
  - **Allowances:**
    - Players: chat, public, TABLE and evidence rolls share 30/minute, burst 30.
    - **The Campaign's GM gets 60/minute, burst 60 in their own room** (the user's change), so
      hand-rolling for a large fight does not hit the limit.
    - Scene writes: 240/minute, burst 80.
  - **What is not charged:** exact retries and rolled-back commands. Rules-generated messages
    follow their enclosing command's admission.
  - **Lifecycle:** recovery within an epoch keeps the counters. Eviction, deletion and room cleanup
    remove them.
  - **Outside live play:** the existing account-global Convex buckets in
    `apps/apis/convex/lib/rateLimits.ts` remain.
  - [Codex proposal](../../local-validation/live-rate-scope-proposal.md).
- **D73 (2026-10-01): the room pushes the held Sheet. Proposed by Claude; approved by the user
  on 2026-10-01.**
  - When `sheetSlices.liveAuthority` is non-null, the Sheet page opens the room socket and
    subscribes to its Character. Only the Character's owner or the Campaign GM may subscribe.
  - After every commit that changes that Character's play stream version (Sheet or Encounter
    commands), the room recomputes the viewer-projected Sheet with the same rules-runtime
    projector Convex uses and pushes it unsequenced. The web derives slices from that push with
    `projectCharacterSheetSlice` and takes `expectedVersion` from its stream version.
  - Notes, drafts, rests and structural edits stay on Convex.
  - Party readers keep the checkpoint view.
  - Alternatives rejected: sending only the play record leaves values derived from equipment,
    attunement and conditions wrong; notify-then-read adds a round trip for the same computation.
- **D74 (2026-10-01): the room reconciles held actors after commits and authorization reloads,
  and Convex reconciles open Runs at release. Proposed by Claude; approved by the user on
  2026-10-01. Current source, unverified.**
  - While a Campaign has live authority, Character departure, controller removal and account
    departure change only Convex membership and assignment for every open Run (PREPARED or
    ACTIVE). Convex skips its Run actor writes and sends the existing `EVICT_USER` /
    `INVALIDATE_INPUTS`.
  - The room freezes or unlists held actors whose assignment or controller is gone, natively in one
    SQLite transaction. It runs from the post-commit task (after every committed transaction and
    authorization reload, before the Sheet push), so a Run hydrated later is corrected too. A failed
    reconcile is logged and retried by the next trigger.
  - A Run the room never hydrated this epoch is reconciled at authority release in the same Convex
    transaction, from current membership and assignment: remove actors of deleted Characters,
    freeze unassigned Character actors, unlist departed controllers.
  - Account deletion (A35-S7b): the room tells it apart without a new signal. Its CHARACTERS input
    read answers `DELETED` for a Character that no longer exists, and the reconcile removes that
    actor (with a checkpoint before the receipt) instead of freezing it. Remaining gap: an actor
    frozen earlier whose account is deleted later is removed only at release.
  - As a backstop, checkpoint ingestion rejects actor rows that still name departed controllers or
    unassigned Characters.
  - No new control operation; Convex membership remains the single source of truth.
- **D76 (2026-10-01): Scene commands are admitted on Scene state, not the room sequence. Decided by
  the user on 2026-10-01 (A35-S8a).** All room commands, chat included, commit through one durable
  journal sequence. Scene commands no longer fail with `STALE_SEQUENCE` when an unrelated Sheet,
  Encounter or chat commit advanced that sequence; the Scene version check (`STALE_STATE`) and the
  planners' authoritative reads guard them. `expectedSessionSequence` stays in the command
  fingerprint. A separate chat sequence was rejected because recovery and checkpoints would track a
  second ordering. Evidence rolls are charged against the D72 bucket at room admission but stay
  Convex-recorded until A35-S8c.
- **D75 (2026-10-01): web app on Cloudflare Workers Free with skeleton SSR for signed-in pages
  (resolves Q20). Decided by the user on 2026-10-01.**
  - **Hosting:** move the web app from Netlify to a separate Cloudflare Worker, as the
    [D65 record](../validation/phase-08-2/d65-cloudflare-web-hosting-2026-09-28.md) plans.
  - **Signed-in pages render a skeleton on the server.** `_authed` route loaders stop prefetching
    Convex data on the server; the server renders the layout and skeleton, and the browser fills it
    from the Convex subscriptions it opens anyway. This removes the duplicated queries and keeps
    signed-in SSR near the anonymous pages' 2–8 ms CPU. Public and marketing pages keep full SSR.
    Loading states use Mantine's `Skeleton` from `@mantine/core` directly, as `AuthoredListPage` and
    `CharacterSheetInspector` already do; no custom skeleton component or wrapper.
    Staging measures the result, including cold-isolate first requests; Workers Paid ($5/month)
    stays the fallback after revenue.
  - **Better Auth focus refetch off** (`sessionOptions.refetchOnWindowFocus: false`). It only
    refreshed the browser's cached session for the UI; the session is still checked on load and
    navigation, and Convex authorizes every call by JWT.
  - **Request pool protection:** Bot Fight Mode, WAF custom rules that block scanner paths, one
    rate-limiting rule on navigations and `/api/auth/*`, fail closed when the daily pool runs out,
    and an alert at 60%. Verify the free plan's rule allowances and that edge-blocked requests do
    not count against the Workers pool before configuring.
- **D81 (2026-10-02): leaving a Campaign ends everything the Campaign or its Runs own on the
  Character. Decided by the product owner on 2026-10-02.**
  - **Ends at departure:** Run-applied effects and the conditions only those effects held; Campaign
    settings such as extra attunement slots (the earliest attunements are kept up to the System
    limit); GM/Campaign adjustments to maximum HP and stats (current HP is clamped).
  - **Kept:** play history (damage taken, items given, XP).
  - **Not live-held:** Convex settles in the departure mutation (`settleDepartedCharacters` in
    `apps/apis/convex/campaigns/characterDeparture.ts`). It ends the Character's effects from the
    Campaign's Runs, terminates emptied maintained states (by their empty-dependent policy) only in
    Runs the room does not hold, reconciles source loss with no targets to trim attunement and clamp
    HP, and rewrites the record to refresh stats.
  - **Live-held (D74):** play stays the room's. Settlement runs when the hold drops at a checkpoint
    (`reconcileCharacterHolds`) or at room release (`releaseCharacterHolds` through authority
    release). The room ignores maintained-effect dependents whose Character owner is no longer
    assigned to the Campaign; Convex ends them. A checkpoint accepts writes for an unassigned
    Character this epoch still holds.
  - **Scope:** D81 covers leaving the Campaign only. Leaving a Run is D82.
- **D82 (2026-10-02): leaving a Run never changes the Character, and the room holds it until the
  Run ends. Decided by the product owner on 2026-10-02.**
  - **Why a GM removes a Character mid-Run:** it flees or is carried off, its player leaves the
    session, or it was added by mistake. None of these ends what the fight did to it.
  - **Rule:** a GM removal takes the Character out of initiative (it takes no turns) but keeps its
    actor in the Run, so the room keeps holding it and its Sheet play stays in the room. Effects the
    Run applied run their course on Encounter time (rounds); a session paused for the night pauses
    them too. The hold is released when the Run completes, as before.
  - **Mechanism (CURRENT):** a Character Run actor carries `outOfInitiative`. REMOVE_ACTOR on an
    unfrozen Character of an ACTIVE Run sets it instead of deleting the actor; the initiative
    participant rows stay (the actor/participant invariant holds) and turn advancement skips the actor
    through the same skip set as D63 defeat (`skippedEncounterActorIds`). The GM returns it with
    `UPDATE_ACTOR` `returnToInitiative`, into its old slot. A pending decision refuses the removal.
    Frozen (departed) Characters and PREPARED Runs still delete the actor. Persisted shape: new required
    `outOfInitiative` on Character run actors and their projection facts, so dev data needs a reseed.
  - **Not D82:** account deletion removes the actor (D74) and leaving the Campaign freezes it; both
    end Campaign-owned state by D81.
  - **Why held:** a released Character could change in Convex while room-owned effects still write
    it, so the room would write from a stale base and its checkpoint would be refused.
- **D87 (2026-10-03): Campaign content is hidden from players until the GM reveals it. Decided by
  the product owner on 2026-10-03 (VS-8).**
  - **Rule:** everything a GM authors or prepares in a Campaign is GM-only by default: Encounters
    and their actors before they run, Scenes not presented, NPCs, locations and notes. Players see
    it only when the GM reveals or runs it. This follows Foundry, where players see nothing without
    a permission grant.
  - **Applies to:** every player-facing read, the room's live feeds (D86), and all future world
    content.
  - **Existing visibility unchanged:** ADR 0034's Party can view, roster basics and health
    display, and the D62/Q14 projection.
  - **Audit (2026-10-03).** Players cannot list hidden content. Three by-ID gaps exist:
    - `encounters.projectionReads.get`, the timeline and the pending reads have no status or role
      check, so a player with a prepared Encounter's ID sees its player view;
    - player Scene and fog reads (`recipientReads.header`, `fogReads.layers`/`chunks`) do not
      require the presented Scene;
    - `attachments.list` returns every Campaign file to every member.
  - **Gates (decided):**
    - Players read only the ACTIVE Encounter, plus a pre-start decision addressed to them.
      Actors stay player-visible by default once a Run is active, like Foundry's combat tracker.
    - Player Scene and fog reads require the presented Scene, or a Scene the GM is showing as an
      image (below).
  - **Campaign Files removed (decided).** The `campaignAttachments` feature is removed entirely:
    uploads, handout maps, the web Campaign Files area, its media profiles and retention hooks.
    Pre-launch, so there is no compatibility layer, and local data is reset. Images on notebook
    entries go to the
    [post-launch backlog](../roadmap/future-enhancements.md#images-on-notebook-entries-d87).
  - **Show to players (decided, before launch).** The GM can show a Scene's map to players as a
    view-only image, with that Scene's fog, without changing the Scene being played. This replaces
    handout maps; a world map is a Scene.
  - **Notes (decided).**
    - The GM and players each keep private and shared notes, in the Campaign notebook and in
      session notes.
    - New notes are private by default.
    - A private note is visible to its author and the GM. As in Foundry, the GM can read every
      note.
    - D91 amends this: account deletion keeps private notes the GM can read, as Deleted user.
    - A shared note is visible to the whole Campaign.
    - Today the notebook is GM-only and a player's session notes are always public. Both change.
  - **Work:** slices PLT-6 (read gates and Campaign Files removal), PLT-7 (private and shared
    notes for everyone) and PLT-8 (Show to players), in VS-11.
- **D86 (2026-10-03): write-behind state flush; live views read the room. Decided by the product
  owner on 2026-10-03 (VS-8). Amends ADR 0035 Decisions 3 and 7, Amendments 1, 4, 7, 12, 13 and
  14, D70 for Encounter-scoped history, and implements D85's history rule.**
  - **Flushes:**
    - Commands never call Convex. The room persists the state they changed, dirty-only and
      coalesced, at most once per N (30–120 s, set by REL-5 from V15).
    - Only hold-changing lifecycle commands flush synchronously: START, COMPLETE, DELETE, adding or
      removing a Character actor, and the departure reconcile.
    - Binding, admission and round change no longer force a checkpoint. Drain and release still
      flush.
  - **Flush cost scales with the delta:**
    - no Campaign-wide roster reads;
    - the lease is renewed separately, at most once per 120 s while sockets are connected;
    - each flush records per-section I/O.
  - **Live views read the room:**
    - While a table is running, every view of room-owned state reads the room: the table, the Sheet
      from any window, and summary pages through one live Campaign summary feed.
    - The feed never widens a viewer's visibility (D87).
    - Views return to Convex when the table ends. Each window holds its own connection.
  - **Sheet edits** show at once, revert with the reason on a refusal, and are never blocked by a
    pending Encounter decision.
  - **Edits made outside the room** reload into the room immediately while sockets are connected.
  - **Encounter history:**
    - The timeline, command log and receipts stay in the room and are discarded at Run end.
      Character receipts from Encounter commands are dropped too.
    - A Run-scoped replay index serves cross-epoch retries.
    - Chat and roll cards ride the regular flush.
  - **Sign-in expiry:** the room re-challenges each socket 60 s before its admission expires.
  - **Where:**
    - [ADR 0035 D86](../adr/0035-room-authoritative-live-encounters.md#d86-write-behind-state-flush-live-views-read-the-room--2026-10-03);
    - slices A35-S10a–d, then REL-5 ([plan](adr-0035-implementation-plan.md#write-behind-flush-slices-d86)).
- **D85 (2026-10-03): measure live-play cost before changing checkpoints; Encounter history follows
  Foundry. Decided by the product owner on 2026-10-03 (VS-8).**
  - **Finding:** S0 modelled checkpoint I/O at about 5.9 MB per session at N = 120 s and 2.4 MB at
    round and lifecycle boundaries only, against the 4.3 MB Q16 budget. Nothing is yet measured on the
    room design. Separately, the web still polls Convex every 5 s for Encounter state during live play
    and subscribes to `activeReads`, so turns and pending decisions lag until a checkpoint (A35-S6d).
  - **Decision:** change nothing that is not proven waste. Instrument everything: each checkpoint's
    Convex bytes read and written by trigger (timer, round, lifecycle, release), room rows and
    requests, and every Convex call during live play. Remove known waste (the live-play polling and
    subscriptions, A35-S6d). Then measure V15 and decide cadence, `patch` versus `replace` and record
    shapes from real numbers. Losing up to one round on a rare Durable Object storage loss is
    acceptable for the MVP.
  - **Encounter history:** like Foundry, where ending combat deletes the Combat and the chat log
    remains, chat and roll cards persist (D69) and the turn-by-turn Encounter timeline need not
    outlive the Run. Implementation is sequenced with the measured changes.
- **D84 (2026-10-03): the Builder commit budget is per distinct Class, not a flat 300 KB.
  Decided by the product owner on 2026-10-03 (VS-6).**
  - **Finding:** the native local run measured commit at 782 KB (Fighter 2 / Rogue 1) and 955 KB
    (Life Cleric 1). The convex-test counter had counted payload chunk bytes as zero and its fixtures
    lacked the Class compilation. On the SRD, reading one Class once costs 240–330 KB (root, version,
    payload), so a commit that revalidates against Convex content cannot fit 300 KB.
  - **Decision:** read each referenced document once per commit, move the Class compilation off the
    version document (table `authoredVersionCompilations`) so commit does not pay for it, and budget
    commit database I/O (read plus write) at 450 KB for one Class plus 200 KB for each further
    distinct Class (650 KB for two). After both changes convex-test measures Fighter 5 at 328 KB and
    Wizard 5 at 376 KB of reads. Recheck the free-tier cost model with measured numbers. ADR 0036 and
    P02.3 are amended to match. A commit that stops reading Class payloads is not pursued.
- **D83 (2026-10-02): the GM's Blind roll is removed; GM rolls are Public or Private only.
  Decided by the product owner on 2026-10-02 (VS-5).**
  - Q14's toggle is confirmed as recorded: one Public/Private toggle beside the GM's roll controls
    (action drawer and chat), remembering the last choice, starting on Public, for manual and
    automatic rule rolls.
  - The Blind option (a GM roll hidden from the GM too until revealed) goes from the contract,
    Convex, the room and the web. ADR 0034 and P06.5 are amended to match.
- **D80 (2026-10-02): the open queue becomes ten vertical slices. Re-slicing approved by the
  user on 2026-10-02; the cut by Claude (integration owner).**
  - **Rule:** each slice (stream `VS` in the [work-slice registry](../roadmap/08-2-work-slices.json))
    names the criteria it closes and the older open slices it finishes. It is done when those
    criteria are READY_FOR_ACCEPTANCE with a focused proof, and the slices it includes become done
    with it. Integrating slices no longer wait for one REL-4 batch. `acceptanceProgress.mjs`
    refuses an open criterion without exactly one open owner, and an open slice that is neither
    queued nor included.
  - **Order:** VS-1 Scene history (S3c2 before S3c3), VS-2 movement and passage, VS-3 Encounter
    decisions and journeys, VS-4 held Sheet, recovery and deletion, VS-5 chat and rolls, VS-6
    Builder budgets, VS-7 web on Workers, VS-8 budgets, faster suites, one full test-and-fix run and
    the V15 load run, VS-9 final proof, VS-10 promotion. Test-only slices fold into the case slice
    whose suites they serve; hot-path slices check row and byte counts in focused tests. The D78
    room defects are fixed in VS-2 (maintained-effect owner) and VS-3 (tied-initiative base).
  - **VS-7 (PLT-5, D75)** closes no new criterion: moving off Netlify makes R05.1's packaging
    evidence stale, so it re-proves R05.1 on the Worker build. Its code must precede VS-8 and VS-9,
    because R08.2 requires one final source. The Cloudflare edge rules move to VS-10 with the
    staging deploy. D75's checks attach to existing criteria without changing the denominator:
    R05.2's request audit covers signed-in pages without server Convex prefetch and with focus
    refetch off, and R09.1 measures signed-in SSR CPU, including cold isolates, on staging.
- **D79 (2026-10-02): GM Scene edits become room commands; A35-S3c splits into four slices.
  Room-native editing decided by the user on 2026-10-02; the split by Claude (integration owner).**
  - **Evidence:** D77 assumed S6c would delete the Convex Scene live-command writers; S6c3 deleted
    only the Encounter path. Token moves, doors and move undo already go through the room, but the
    GM live editor in `CampaignVttStage.tsx` (`sceneCommand`) still sends `UPSERT_`/`REMOVE_SCENE_*`
    (token, light, barrier, darkness, annotation), measurement removal, `SET_SCENE_FOG_MODE`,
    `SET_SCENE_VISION_REVEAL_MODE` and `PATCH_SCENE_FOG` to `scenes/commands:execute`,
    `fogCommands` begin/append/publish and `geometryFastCommands`/`geometryActions`. `commands` and
    `fogCommands` carry no live-authority fence, so an edit while the room holds the presented Scene
    advances the Convex Scene version under it, and the room's next checkpoint (which also carries
    its Encounter changes) is refused as stale. The guarded geometry writers refuse instead.
  - **Ruling (user):** the room is the only writer of a presented Scene, including GM edits, as in
    Foundry. Rejected: refusing Convex edits during play (the GM could not edit the presented map),
    and Convex edits that force a room flush and rehydrate (two writers racing).
  - **S3c0:** the room gains commands for every GM editor command and for fog painting (chunked
    upload into the room); the web sends them through the live socket.
  - **S3c1:** delete the Convex Scene command path (functions, staging cleanup, their tests and
    development-script calls). Tests whose subject is the deleted path are deleted, not ported (the
    S6c2 rule); tests that only used it to set up state move to the room movement harness or
    checkpoint fixtures. Shared `packages/encounter-persistence` Scene publication/undo code stays:
    the room uses it.
  - **S3c2:** pack Scene command history into Scene-scoped receipt ledgers (`SCENE` scope, one
    ledger per Scene per checkpoint, small indexed `sceneLiveCommands` headers), and move room
    hydration, the 30-day retention (whole ledgers) and Campaign deletion onto them.
  - **S3c3:** the room builds its Scene cache from its store instead of the Convex `capture`/`hydrate`
    Scene reads (D78 S6c3 ruling); the socket-admission authority capture stays.
- **D78 (2026-10-01): A35-S6c splits into three slices and absorbs A35-S8c. Decided by the user
  on 2026-10-01.**
  - **S6c1:** every ACTIVE-Run Encounter command becomes room-native: evidence rolls and
    table-visible enemy rolls (a room table-roll port, superseding D76's "Convex-recorded until
    A35-S8c"), `UPDATE_ACTOR` carrying a Sheet command (through the room's held-Sheet path), and
    decisions the room does not own (native refusals). Tests move to a convex-test harness that runs each command room-natively
    and writes it back through the real checkpoint mutation; assertions on the per-receipt ledger
    shape move to the checkpoint's per-scope ledgers.
  - **S6c1 rulings (integration owner, 2026-10-01):**
    - A retried commandId replays its journaled result. A fresh commandId against a settled
      decision is VERSION_STALE, and reusing a commandId with different input is INVALID_COMMAND.
      Replay no longer re-validates Convex receipt records: the room journal is the authority.
    - A Sheet command bridged through `UPDATE_ACTOR` runs only on a room-held Character (an ACTIVE
      Run). On a PREPARED Run it is refused with "Make this change from the Character Sheet."; the
      web sends no such bridge.
    - One ACTIVE Run per Campaign: the room refuses START from its RUN input
      (`activeEncounterId`), and checkpoint ingestion refuses a checkpoint that would leave two.
    - The room's settlement reads a detached owner Character through its port, so it refuses the
      same way the Convex path did.
  - **S6c2:** a room movement harness; the movement tests leave the Convex-first commit. Actor-token
    binding becomes a room command (the room has none, so S6c1 could not fence
    `actorTokenBindings.execute` without breaking live GM binding); then the Convex writer is fenced.
  - **S6c2 rulings (integration owner, 2026-10-02):**
    - A fresh answer to a settled movement decision is VERSION_STALE in the room, as for any other
      decision. A fresh GM void of a settled decision is DECISION_NOT_PENDING, because the shared
      void planner refuses it first.
    - A replayed command returns its journaled result with the Run's current projection, not the
      decision's later settlement. Tests that tampered with a Convex receipt to break a replay were
      deleted: the room journal, not the receipt, is the replay authority.
    - Checkpoint record keys accept occurrence version 0, matching the stored schema.
    - Tests whose subject was the Convex-first commit (staging refusals, the D42 clone check,
      spatial-commit mechanics) were deleted, not ported. The Convex refusals of a move while
      another decision is pending and of a root replay were not re-proved in the room harness.
  - **S6c3 follow-ups from S6c2:** three unbound-token `externalCommit` tests still drive
    `prepareExternalSceneCommit`/`commitExternalSceneCommit` and need a room-native unbound
    geometry harness before that path is deleted. Delete the harness's Convex-first helpers
    (`stageRoomMovement`, `executeConvexFirstCommand`, `executeConvexFirstInRoom`,
    `nextExternalAuthority`, `expectedMovementScene`) with it, and recheck the D43 test that still
    calls `scenes.geometryActions.execute`.
  - **Room defects found in S6c2 (must fix before REL-4):**
    - A detached, unassigned maintained-effect Character owner is refused ("Character is no longer
      assigned to the Campaign.", `RoomInputs.character`): the CHARACTERS scope returns
      `UNASSIGNED`, while [live-sessions.md](../architecture/live-sessions.md) lets a real
      dependent read it and the Convex path settled it. Red: `movementMaintenanceCharacters` and
      one `movementMaintenance` test. Proposed fix: the room reads such an owner authorized by its
      live dependent, as turn capture's `maintenanceCharacterOwners` input already names it.
    - Each tied-initiative order choice rewrites the whole pending-snapshot base (about 300 KB at
      100 actors) instead of a delta; red: `encounterWriteSets` 100-actor budget (17 MB against
      2 MB). Trace `writePendingSnapshot` in the room transaction.
  - **S6c3:** delete the per-command Convex path (routes, commit modules, external commit, the S5
    parity test), then docs and acceptance.
  - **S6c3 rulings (2026-10-02):**
    - The Scene cache hydrate moves to A35-S3c (user, 2026-10-02). The room's `capture` and
      `hydrate` routes load the presented Scene and its vision on admission, resync, presentation
      and after an actor removal; they are not per-command. S3c builds the Scene cache from the
      room store when it repacks Scene hydration, so that code is rewritten once.
    - The Convex-first external-commit record and its `externalCommitResolve` drain are deleted
      outright (integration owner): no production code writes the record, and pre-launch there is
      no deployed room storage to drain.
    - The room-supplied rules and Character reads become required; the Convex `encounterRules`,
      `encounterBundle` and `characterRules` capture routes go with the per-command path.
  - Alternative rejected: keeping the roll routes as an exception would leave R06.1 incomplete.
- **D77 (2026-10-01): A35-S5 becomes a differential test; A35-S3c follows A35-S6c. Decided by
  Claude; the user delegated slice order on 2026-10-01.**
  - **S5:** the room already commits nearly every Encounter and Scene command natively, so the
    planned live shadow (Convex authoritative, room comparing) no longer matches source. S5 is a
    convex-test suite that drives one command sequence through the room-native path and the
    protected Convex comparators from the same hydrated state, comparing results, logical
    Encounter documents and Character play after every command. It is deleted with the comparators
    in S6c.
  - **S3c after S6c:** packing `sceneLiveCommands` before S6c would rewrite about five Convex Scene
    writers, ten readers and forty test files that S6c deletes. Nothing in S6c depends on Scene
    packing. Afterwards S3c packs only the checkpoint writer, room hydration, retention and Campaign
    deletion, in Scene-scoped ledgers so the 30-day Scene retention never rewrites shared Encounter
    ledgers.

- **D71 (2026-09-30): bounded deferred purge of retired private receipt payloads.
  Decision maker: Codex. User approval: 2026-09-30.** Codex recommended this change after native
  deletion of three private 4 MiB ledgers failed: the real account-deletion hook reached its
  execution limit, and fixture deletion exceeded the 16 MiB transaction read limit. Private
  history has no lifetime retention cap.
  Account/Character state and private receipt headers are removed atomically, together with the
  durable purge intent. Unreachable private ledger payloads are then physically removed in bounded,
  retryable steps through the existing deferred-cleanup lifecycle. Current clients immediately lose
  access to that private history. Shared Encounter history is retained. The purge must verify private
  ownership and the absence of live receipt references before deleting payload storage.
  This intentionally changes D70's physical-payload cleanup transaction boundary; it introduces
  no private-history retention cap. Source integration and focused local native
  success/rollback/retry/privacy proofs passed; see the
  [2026-09-30 validation record](../validation/phase-08-2/private-receipt-retirement-2026-09-30.md).
  Final integration, the complete local lifecycle and Q16 remain pending. See
  [ADR 0035 D71](../adr/0035-room-authoritative-live-encounters.md#d71-bounded-deferred-private-payload-purge--2026-09-30).
  _Amendment (2026-10-05, A35-S11h):_ "Shared Encounter history is retained" no longer holds for
  finished Runs. D85 and D88 (ADR 0035 Amendment 22) keep Encounter history in the room for the Run only,
  and ADR 0035 Amendment 30 deletes every Run child row at COMPLETE except the Run, its actors and their
  source facts. Account and Character deletion still leave all Encounter rows untouched; what they leave
  is now only that finished view.

## Resolved

- **SPELLS-5.7 Concentration grants after the Run (2026-10-09).** Option B. A Concentration grant on a Character carries over to the Campaign clock when the Run ends, like any other grant, and lasts until its clock expiry. Following the SRD's one-Concentration rule, a carried-over Concentration grant ends when its caster starts concentrating on another spell. This replaces the built option A (the grant ending with the Run).
- **SPELLS-5.6 per-speed-type movement (2026-10-09).** Option B. Authored speeds and grants are already typed (walk, fly, swim, climb, burrow), and in Assisted mode the tabletop allowance is how a player knows how far they can move, so a fly or swim grant must give the holder that allowance. The turn readout carries an allowance per speed type, and a move names the speed type it uses. Built under SPELLS-5.6, before SPELLS-11.
- **Character aggregate checksums (2026-10-06).** The user adopted the proposal. Aggregate hashes are derived at assembly rather than persisted on the Character head, so a note edit reads only its notes and groups, collection counts, clocks and receipt. Typed records, identity, ownership, order and count checks, and canonical full-capture hashes all remain. Convex transactions are atomic, and per-edit full reads cost free-tier I/O. Tracked as SHEET-7 in the Phase 8 ledger.
- **D81 departure split (2026-10-06).** Confirmed. GM play history (damage taken, items given, XP) stays with the Character when it leaves a Campaign. GM modifiers (maximum HP and stat adjustments, Run-applied effects, Campaign settings) end at departure.
- **D81 spell-source customizations (2026-10-06).** Kept. `customName` and `displayAsAttack` survive departure as player-facing presentation.
- **Better Auth session-read rate limits (2026-10-06).** Kept as they are. The web client's token retry with backoff covers load spikes. Revisit with real usage data.
- **Combat and the Campaign clock (2026-10-01, A35-S3b).** The clock is the GM's own control and stays in Convex, outside the live room.
  - Combat pauses a running clock automatically. When the last ACTIVE Run ends, it resumes only if combat paused it.
  - If the GM moves time past dawn, dusk or midnight during combat, Characters outside the fight recover as before. For Characters in the fight, the GM gets a prompt that names the condition and lists their matching charges, and decides which to refresh. Nothing in the fight recovers automatically.
  - Rejected: the room applying recovery itself, which would make the room clock-aware for an edge case (ten rounds is one minute), and refusing to cross a boundary during combat.
  - Scene lighting from world time (as in Foundry) is a post-launch enhancement.
- **Q19 (2026-09-28).** Match Roll20 to keep hosting costs down for launch.
  - There are no live cursors shared on hover.
  - A long-press **ping** replaces the press-and-drag streaming pointer. A ping is one message per press, so it costs almost nothing.
  - Token-drag previews stay as built (at most 10 Hz, only while dragging).
  - Shared cursors are recorded as a post-launch enhancement, to revisit when revenue supports a paid Workers plan.
  - **Implemented 2026-09-28:** a 500 ms long press or `P` sends one `PING`; GM pings follow the preview share toggle, player pings reach members who can see the point under fog, and each socket pings at most once per 500 ms. See [live-sessions.md](../architecture/live-sessions.md#transient-previews).

- **Q18 (2026-09-27).** The user accepted the recommendations. The [tier research](../roadmap/tier-research-2026-09-27.md) proposal is adopted:
  - **Prices:** Free `$0`, Player `$2.99`, GM `$9.99`, Pro GM `$24.99`.
  - **Media:** 100 MB, 1 GB, 5 GB and 25 GB.
  - **Hosted Campaigns:** 1, 1, 5 and 25.
  - **New per-Campaign limits** on Free and Player: 150 entries and 5 Scenes. GM and Pro GM are unlimited, with hidden safety caps.
  - **Saved Encounters:** 10, 10, unlimited and unlimited.
  - **Unchanged:** Characters, homebrew roots, seats, listings, paid tables and fees.
  - **Uploads** count against whoever uploaded them (Q17), not against the hosting GM.
  - **After a downgrade,** creating new content is refused, and existing content over the limit stays readable and editable. Nothing is deleted.
  - **Implemented 2026-09-27** (`21ee0cff8`…`d1bbca914`):
    - per-Campaign counters in `campaignContentUsage`, maintained by triggers;
    - limits enforced against the owner's plan;
    - hidden safety caps of 5,000 entries and 250 Scenes for the unlimited tiers.
  - **Follow-ups:**
    - a specific message when a copy is refused by the limit;
    - a per-Campaign usage count in the Campaign header.
  - **Cost target:** free hosting tiers first. Small pay-as-you-go overages are tolerated, rather than cutting below the market's 100 MB of free storage.
  - **Follow-up:** R06.4 was reworded so that direct Convex writes are fenced for the presented Scene, live Runs and held Characters' play state. This follows directly from the approved ADR 0035 Amendments.

* **Q16 (2026-09-27).** The free hosting tier must carry the launch cohort: 100 Free users, 20 of them hosting tables that play four 4-hour sessions a month, plus 50 Character builds a month, with 50% headroom.
  - Budgets are each provider's free allowance (checked 2026-09-27) divided by that load model. Convex database I/O is the binding constraint.
  - Content snapshots and media are served from Cloudflare (R2), where egress is free.
  - The web app moves off Netlify to Cloudflare (D65).
  - The tiers will be redesigned from competitor evidence (Q18).
* **Q17 (2026-09-27).** Media: content art is capped at 2048 px, maps keep full resolution, and the Free media quota is 100 MB.
  - A "My images" picker lets people reuse their uploads; each asset counts once, and identical uploads by the same owner are de-duplicated.
  - The user wants tier limits for both hosting cost and upgrade incentive ("all of the above"), so a count limit on Free Campaign content is designed as part of Q18.
  - Invisible safety caps and retention pruning guard against abuse.

- **Q15 (2026-09-27).** Architecture for a free-tier product. The user chose (b), (c) and (d), recorded in [ADR 0035](../adr/0035-room-authoritative-live-encounters.md):
  - **(b):** while a table is live, the room is the source of truth for the Encounter and combat play state. Commands never call Convex, and Convex receives checkpoints as the record of truth.
  - **(c):** development and tests use the local backend only.
  - **(d):** read budgets are gated in V15 and the Builder.
  - **Still open:** option (a), versioned static content snapshots and a Builder preview in the browser. It is recommended next, and ADR 0035 already assumes it for loading System content into the room.
  - **Constraint from the user:** the launched product stays on free tiers until paying customers justify a paid plan.
- **Q14 (2026-09-27).** GM rolls are Public or Private, chosen with a toggle beside the GM's roll controls (the action drawer and chat). The toggle remembers the last choice, starts on Public (as in Foundry), and has no settings page.
  - A Private roll shows players nothing, not even that a roll happened.
  - The GM's private card offers two reveals, both logged, neither retractable: "Show roll" (the full card) and "Show that I rolled" (a vague notice with no result or reason).
  - The notice names a creature only for players who can currently see it; everyone else sees "The GM made a roll".
  - Consequences stay visible: a player hit by a private roll still sees the damage and any save prompt, but not the roll, its total or a hidden source.
  - It ships in the S6i rule-roll chat cards slice.

* **Q13 (2026-09-27).** Option (a): R03.1's corpus clause now reads "the protected SRD corpus matches the current SRD manifest checksum reported by the seed audit, with every corpus change since the removal tracing to a recorded ruling". R03.1 is READY: the seed audit passes, and all 21 corpus commits since the fourth pass cite a ruling.
* **Q11 (2026-09-26).** Basic combat actions come from a System-owned catalogue, split in two:
  - **Mechanics** are closed, System-neutral rule kinds in `packages/shared` with the other core engine enums: a movement budget bonus equal to speed, suppressing opportunity attacks, disadvantage on attacks against the actor until its next turn, and advantage granted to an ally.
  - **The catalogue entries** (Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object, with their names and text) are authored System data in the SRD source, so homebrew Systems can rename, change or add them.
  - Hard-coding 'Dash' as a shared enum would put D&D terms into the core engine.
  - Every actor gets the catalogue through the normal action flow. Hide, Ready, Search and Use an Object are logged, not automated.
  - It ships as its own slice before closed beta.
* **Local backend secret (2026-09-26).** The local instance secret exposed in an agent transcript was rotated. The stored secret file was removed and the container restarted, which generated a new secret inside the container that was never printed. The container also dropped from about 6.6 GiB to 196 MiB of memory.
* **Q9 (2026-09-25).** V05.4 reworded: renewal keeps valid users and keeps room authority serving the remaining current members (ADR 0033).
* **Q10 (2026-09-25).** Shared Session notes show their author and handouts their uploader, resolved on the server. Both read "Deleted user" after account deletion, through the same function chat uses. The Encounter timeline keeps naming actors. F12.3's wording is unchanged. D91 applies the same label to the private notes the GM can read, which account deletion now keeps.
* **Q8 (2026-09-25).** Keep 100 as the Encounter safety cap. One convex-test case proves the room's capture stays within Convex limits at the cap; speed targets (V15) use the typical 11-actor table.
* **Q6 (2026-09-25).** V11.4 reworded: in Assisted mode a player's save-forcing action pauses on the creature's save for its controller (the GM) unless that controller's auto-roll is on, in which case the save is rolled and the action continues. Manual mode raises no rules prompts. There is no separate Automatic mode since the modes redesign; the per-person auto-roll preference fills that role. Spell-specific proof becomes a Phase 8.3 spell-casting criterion.
* **Q7 (2026-09-25).** V09.7 reworded to 'development data is migrated or reset under the standing local-reset approval', matching the actual process.
* **Q1 (2026-09-25).** The connection string labeled production is non-live. The user will rotate the credentials before go-live (added to the release checklist).
* **Q2 (2026-09-25, amended).** Delete the whole Codex backup worktree only after the final R08 proof passes. 653 of the 725 evidence references in the acceptance ledger point at `.codex/validation/...` files that exist only in that worktree, so it is the only record behind the 59 accepted cases until R08 re-proves them on the final source.
* **Q3 (2026-09-25).** Done. Removed the 12 `supabase_*_artificer-toolkit` containers and their 3 volumes, the local `supabase/` folder (empty directories and the `.temp` generated secrets; migrations remain in git history), the 11 Supabase and database variables in `.env.local` (removed by name, values never read) and the dead `.gitignore` entry. Left alone: the `faye-frame` project's volumes and one unattributable `supabase_edge_runtime_` volume. `scripts/auditNativeBoundaries.mjs` keeps guarding against Supabase being reintroduced.
* **Q4 (2026-09-25).** Scene fog save retention is folded into S7.
* **Q5 (2026-09-25).** Done in the player-control slice (S6b): `CampaignSessionPlayerEncounters` is now `CampaignPlayerEncounterDecisions`.
