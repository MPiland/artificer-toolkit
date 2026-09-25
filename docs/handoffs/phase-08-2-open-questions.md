# Phase 8.2 open questions

> Living list of questions waiting for the user's answer. Answer inline under **Answer** (or in chat); answered items move to [Resolved](#resolved) with the decision. Decisions made on the user's behalf are summarized in [Decisions to review](#decisions-to-review); the full reasoning is in the [handoff Decision log](phase-08-2-convex-cutover.md#decision-log-delegated-for-user-review).
>
> Updated: 2026-09-25.

## Open

*(none)*

## Decisions to review

Made on your behalf while you were away (Foundry baseline, Roll20 as a second reference). Say "override Dn" to change any of them.

* **D1** Development proofs drive Encounter commands through the Session room, not admin-key shortcuts.
* **D2** Local deploys and resets are part of local validation (staging and production still need approval).
* **D3** Domain rejections carry a code and a user-safe message; the room forwards the message.
* **D4** Magic ammunition is chosen per weapon, auto-selected when only one stack fits, and counted down per attack (Phase 8.3).
  * **Override (user, 2026-09-25):** ammunition tracking is a Campaign option the GM sets, because some GMs don't track ammunition. With tracking off, the chosen ammunition's bonuses still apply but nothing is counted down.
* **D5** `maxBonus` is removed (unused; duplicates authored +N modifiers).
  * **User question answered (2026-09-25):** capped bonuses such as medium armor's "Dex (max 2)" are expressed with the **Min**/**Max** fields on the modifier's value (`packages/shared/src/domains/grants/maps/modifier.ts`), which the rules enforce, and a magic item's +N is its modifier's value. `maxBonus` was an unconsumed duplicate, so homebrew authors lose nothing. The decision stands.
* **D6** Unarmored AC formulas choose the best instead of stacking.
* **D7** Character maximum HP is stored on the Character through one persistence helper (updates after a content republish on the Character's next write; the Sheet is always live).
* **D8** Displayed maximum HP includes active reductions (for example a vampire's bite).
* **D9** "Auto-roll my dice" defaults on and is stored server-side (it only rolls; it never chooses).
* **D10** GM void: a paused action is cancelled whole, declinable choices resolve as decline; turn-flow steps aren't voidable because the GM can answer any prompt.
* **D11** Soft enforcement: action economy, resources, range, `requiresEquipped` and target disposition warn with a logged "Do it anyway" (GM badge); authorization, stale versions, missing targets and a player acting out of turn stay hard.
* **D12** GM undo reverts the last action exactly, or refuses and explains when an exact undo isn't possible.
* **D13** Every Run actor has a GM-editable disposition (Friendly, Neutral, Hostile), like Foundry token disposition; flanking uses the same field.
* **D14** The action drawer marks already-unavailable actions with their reason before selection.
- **D15** `REACTION_COUNT SET_VALUE` (only SRD use: Shocking Grasp's "can't take reactions" on the target) ships with APPLY_GRANT in Phase 8.3, when granted effects start applying. Until then it stays accepted with no consumer.
- **D16** Barbarian Fast Movement has no mechanics yet; it's queued with the class-mechanics follow-ups.
- **D17** Disposition is the single source of hostility. Targeting, flanking and movement reactions all read actor disposition; sides remain only for side-initiative ordering.
- **D18** A recommended roll mode's reason ("Advantage: Flanking") is labelled from the contributor evidence the engine already records, not from a separate labeling system.
- **D19** A roll on an actor the initiator doesn't control goes to that actor's controllers, even when the GM initiated the action; the GM can still answer any prompt. (Foundry: players roll their own saves against the GM's Fireball.)
- **D20** "Waiting on the GM" survives a page reload (server signal), and bound-token drag previews follow actor control, the same rule as commits.
- **D21** Contest rolls keep the rules-derived roll mode for now (contest evidence stores faces only); the roll-mode override applies to ordinary d20 rolls.
- **D22** V07 (movement) is reopened for player agency: player token moves outside Encounters, bound-token moves that follow actor control, and remaining movement shown but not enforced. Every ADR 0034 item is attached to a ledger case, so no pre-beta scope sits outside the acceptance count.
- **D23** Auto-roll applies to every roll: remaining sibling Concentration checks honor the roller's controller preference. Queued for the next Encounter slice.
- **D24** Recharge and Legendary Action dice for a creature the GM granted to a player go to that player, consistent with D19. Queued.
- **D25** A player's bound-token drag preview reuses the short-lived authority capture cache instead of one Convex capture per preview. Queued with S4's capture cache.
- **D26 (please review)** While a movement decision is pending on the presented Scene (an opportunity attack, a passage choice, a save), the room holds other token moves and door changes on that Scene. Players see "Waiting on a movement decision". The GM can answer for anyone or void the decision to release the hold.
  - **Why:** the pending decision is planned against that exact Scene. Any Scene change underneath it would make the decision unanswerable.
  - **Tabletop parity:** this matches a real table, which pauses for a reaction. Foundry and Roll20 don't automate reactions, so they have no such hold.
  - **Rejected:** re-planning the decision against a changed map. That silently changes what the player was asked.
  - **Scope:** only that Scene is held. Chat, Sheets, other Scenes and GM tools keep working.
- **D27** Bound-token movement through the room commits to Convex first. That commit also advances the room's authority sequence, so Convex itself enforces ordering.
  - Before calling Convex, the room writes a write-ahead record. A new Worker-secret `resolve` route then settles any uncertain outcome (a timeout or crash) as COMMITTED or ABANDONED.
  - This replaces "reload the Scene and verify its checksum". That check breaks as soon as a Sheet write changes Character vision.
  - Movement responses also advance the room sequence.
- **D28** Movement responses skip the session-sequence check, because the Scene version pin already fences them.
- **D29** Movement decisions on a Scene that isn't presented keep the native Convex path. Nothing about that Scene is live-owned.

## Resolved

- **Q1 (2026-09-25).** The connection string labeled production is non-live. The user will rotate the credentials before go-live (added to the release checklist).
- **Q2 (2026-09-25, amended).** Delete the whole Codex backup worktree only after the final R08 proof passes. 653 of the 725 evidence references in the acceptance ledger point at `.codex/validation/...` files that exist only in that worktree, so it is the only record behind the 59 accepted cases until R08 re-proves them on the final source.
- **Q3 (2026-09-25).** Done. Removed the 12 `supabase_*_artificer-toolkit` containers and their 3 volumes, the local `supabase/` folder (empty directories and the `.temp` generated secrets; migrations remain in git history), the 11 Supabase and database variables in `.env.local` (removed by name, values never read) and the dead `.gitignore` entry. Left alone: the `faye-frame` project's volumes and one unattributable `supabase_edge_runtime_` volume. `scripts/auditNativeBoundaries.mjs` keeps guarding against Supabase being reintroduced.
- **Q4 (2026-09-25).** Scene fog save retention is folded into S7.
- **Q5 (2026-09-25).** Done in the player-control slice (S6b): `CampaignSessionPlayerEncounters` is now `CampaignPlayerEncounterDecisions`.
