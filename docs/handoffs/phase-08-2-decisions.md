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

## Resolved

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
* **Q10 (2026-09-25).** Shared Session notes show their author and handouts their uploader, resolved on the server. Both read "Deleted user" after account deletion, through the same function chat uses. The Encounter timeline keeps naming actors. F12.3's wording is unchanged.
* **Q8 (2026-09-25).** Keep 100 as the Encounter safety cap. One convex-test case proves the room's capture stays within Convex limits at the cap; speed targets (V15) use the typical 11-actor table.
* **Q6 (2026-09-25).** V11.4 reworded: in Assisted mode a player's save-forcing action pauses on the creature's save for its controller (the GM) unless that controller's auto-roll is on, in which case the save is rolled and the action continues. Manual mode raises no rules prompts. There is no separate Automatic mode since the modes redesign; the per-person auto-roll preference fills that role. Spell-specific proof becomes a Phase 8.3 spell-casting criterion.
* **Q7 (2026-09-25).** V09.7 reworded to 'development data is migrated or reset under the standing local-reset approval', matching the actual process.
* **Q1 (2026-09-25).** The connection string labeled production is non-live. The user will rotate the credentials before go-live (added to the release checklist).
* **Q2 (2026-09-25, amended).** Delete the whole Codex backup worktree only after the final R08 proof passes. 653 of the 725 evidence references in the acceptance ledger point at `.codex/validation/...` files that exist only in that worktree, so it is the only record behind the 59 accepted cases until R08 re-proves them on the final source.
* **Q3 (2026-09-25).** Done. Removed the 12 `supabase_*_artificer-toolkit` containers and their 3 volumes, the local `supabase/` folder (empty directories and the `.temp` generated secrets; migrations remain in git history), the 11 Supabase and database variables in `.env.local` (removed by name, values never read) and the dead `.gitignore` entry. Left alone: the `faye-frame` project's volumes and one unattributable `supabase_edge_runtime_` volume. `scripts/auditNativeBoundaries.mjs` keeps guarding against Supabase being reintroduced.
* **Q4 (2026-09-25).** Scene fog save retention is folded into S7.
* **Q5 (2026-09-25).** Done in the player-control slice (S6b): `CampaignSessionPlayerEncounters` is now `CampaignPlayerEncounterDecisions`.
