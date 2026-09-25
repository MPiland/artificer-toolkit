# Phase 8.2 open questions

> Living list of questions waiting for the user's answer. Answer inline under **Answer** (or in chat); answered items move to [Resolved](#resolved) with the decision. Decisions made on the user's behalf are summarized in [Decisions to review](#decisions-to-review); the full reasoning is in the [handoff Decision log](phase-08-2-convex-cutover.md#decision-log-delegated-for-user-review).
>
> Updated: 2026-09-25.

## Open

### Q1. Exposed "production" database connection string
An agent's redaction failed while inspecting the root `.env.local` and printed two connection-string passwords that its report labeled production and staging (local session output only; nothing written or sent). You said the keys are for staging, a separate project.

- **Question:** does the value labeled production also point at a non-live project? If it points at anything real, rotate it.
- **Recommendation:** confirm; rotate only if it is real.
- **Answer:**

### Q2. Codex backup worktree
`.codex/worktrees/phase-08-2-convex-cutover/` is Codex's read-only backup. It still holds `local.credentials.json` with the local Docker Convex admin key (local backend only) and the old evidence packet the pre-staging gate no longer uses.

- **Options:** keep it as a historical backup / delete the whole worktree / delete only the credentials file.
- **Recommendation:** delete the whole worktree once 8.2 is committed; everything worth keeping is in git.
- **Answer:**

### Q3. Retired Supabase leftovers
The `supabase_vector` Docker container is still running, and `supabase/.temp/` (generated secrets, git-ignored) remains until R10 retires Supabase.

- **Options:** stop the container now / leave both until R10.
- **Recommendation:** stop the container now (nothing uses it); leave `supabase/.temp/` for R10.
- **Answer:**

### Q4. Scene fog save retention task
A background task chip ("Design Scene fog save retention") is waiting: derived fog saves keep a `geometrySaveId` after their geometry save is pruned at 30 days, and superseded fog saves and chunks are never garbage-collected.

- **Options:** start it now in its own worktree / fold it into S7.
- **Recommendation:** fold it into S7 so it lands with the retention audit.
- **Answer:**

### Q5. Rename `CampaignSessionPlayerEncounters`
Since ADR 0033 made Encounters Campaign-owned, this web component is misnamed (it lists a player's pending Encounter decisions, not Session content).

- **Recommendation:** rename it during the player-control slice (e.g. `CampaignPlayerEncounterDecisions`).
- **Answer:**

## Decisions to review

Made on your behalf while you were away (Foundry baseline, Roll20 as a second reference). Say "override Dn" to change any of them.

- **D1** Development proofs drive Encounter commands through the Session room, not admin-key shortcuts.
- **D2** Local deploys and resets are part of local validation (staging and production still need approval).
- **D3** Domain rejections carry a code and a user-safe message; the room forwards the message.
- **D4** Magic ammunition is chosen per weapon, auto-selected when only one stack fits, and counted down per attack (Phase 8.3).
- **D5** `maxBonus` is removed (unused; duplicates authored +N modifiers).
- **D6** Unarmored AC formulas choose the best instead of stacking.
- **D7** Character maximum HP is stored on the Character through one persistence helper (updates after a content republish on the Character's next write; the Sheet is always live).
- **D8** Displayed maximum HP includes active reductions (for example a vampire's bite).
- **D9** "Auto-roll my dice" defaults on and is stored server-side (it only rolls; it never chooses).
- **D10** GM void: a paused action is cancelled whole, declinable choices resolve as decline; turn-flow steps aren't voidable because the GM can answer any prompt.
- **D11** Soft enforcement: action economy, resources, range, `requiresEquipped` and target disposition warn with a logged "Do it anyway" (GM badge); authorization, stale versions, missing targets and a player acting out of turn stay hard.
- **D12** GM undo reverts the last action exactly, or refuses and explains when an exact undo isn't possible.
- **D13** Every Run actor has a GM-editable disposition (Friendly, Neutral, Hostile), like Foundry token disposition; flanking uses the same field.
- **D14** The action drawer marks already-unavailable actions with their reason before selection.

## Resolved

Answered questions move here with the date and decision.
