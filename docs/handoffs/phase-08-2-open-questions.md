# Phase 8.2 open questions

> Living list of questions waiting for the user's answer. Answer inline under **Answer** (or in chat); answered items move to [Resolved](#resolved) with the decision. Decisions made on the user's behalf are summarized in [Decisions to review](#decisions-to-review); the full reasoning is in the [handoff Decision log](phase-08-2-convex-cutover.md#decision-log-delegated-for-user-review).
>
> Updated: 2026-09-25.

## Open

- **Q6: acceptance wording for V11.4.** The criterion says "a player's spell against a creature pauses on the creature's save for the GM". Spell casting in Encounters is Phase 8.3 (ADR 0034), so it can't be proven literally in 8.2. The mechanism is built and tested with a granted creature's save-forcing Bite, and it doesn't care whether the save comes from a spell or an ability.
  - **Recommendation:** reword V11.4 to "a player's save-forcing action", and add a matching spell criterion to the 8.3 spell-casting work so nothing is dropped.
  - **Alternative:** leave V11.4 open until 8.3 spells land.
- **Q7: acceptance wording for V09.7.** The criterion says "development rows are migrated" for `controllerUserIds` and `disposition`. Under your standing reset approval, local development data was reset and reseeded instead of migrated. The migrations were removed as unused code, and no live data exists.
  - **Recommendation:** reword to "development data is migrated or reset under the standing local-reset approval".

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
* **D29** Movement decisions on a Scene that isn't presented keep the native Convex path. Nothing about that Scene is live-owned.
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

## Resolved

- **Q1 (2026-09-25).** The connection string labeled production is non-live. The user will rotate the credentials before go-live (added to the release checklist).
- **Q2 (2026-09-25, amended).** Delete the whole Codex backup worktree only after the final R08 proof passes. 653 of the 725 evidence references in the acceptance ledger point at `.codex/validation/...` files that exist only in that worktree, so it is the only record behind the 59 accepted cases until R08 re-proves them on the final source.
- **Q3 (2026-09-25).** Done. Removed the 12 `supabase_*_artificer-toolkit` containers and their 3 volumes, the local `supabase/` folder (empty directories and the `.temp` generated secrets; migrations remain in git history), the 11 Supabase and database variables in `.env.local` (removed by name, values never read) and the dead `.gitignore` entry. Left alone: the `faye-frame` project's volumes and one unattributable `supabase_edge_runtime_` volume. `scripts/auditNativeBoundaries.mjs` keeps guarding against Supabase being reintroduced.
- **Q4 (2026-09-25).** Scene fog save retention is folded into S7.
- **Q5 (2026-09-25).** Done in the player-control slice (S6b): `CampaignSessionPlayerEncounters` is now `CampaignPlayerEncounterDecisions`.
