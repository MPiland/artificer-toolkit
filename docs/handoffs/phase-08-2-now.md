# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01.

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (P14 reopened for room chat) (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger with the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json). Slice IDs below are registry IDs. To update: change the slice states (and `queue`) in the registry, write the script's `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` with `path` fetches both).
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the slice registry and republish the dashboard;
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**A35-S8a Chat and rolls through the room (D69, D72, D76).** State: integrating. Gate9 clean (builds, local codegen, typechecks, web) and lint clean on touched files. Summary in [live-sessions.md](../architecture/live-sessions.md).

- While the room holds authority, chat, public and TABLE rolls are `CAMPAIGN_CHAT` room commands (`roomChatCommands.ts`), committed through the journal with the D72 bucket charge (`roomRateLimits.ts`) and fanned out at once. Convex `chat.send` and `rolls.execute` are fenced while the room holds authority.
- Scene commands are admitted on Scene state (D76); `STALE_SEQUENCE` is gone.

Follow-ups for the test cycle (REL-4):

- **Room test suite is red before this slice:** `nativeLiveSessionRoom.test.ts` fails 76 of 89 at `9a3540915` too, almost all in the fixture with "The durable Session authority is not active". Fix first in REL-4.
- No dedicated tests yet for `RoomAccountBuckets` or the chat command (nonce replay, rollback not charged, GM vs player allowance).
- A nonce already used before this epoch (no journal receipt) is refused as "already sent" rather than returning the original entry.
- Carried from A35-S7a: interim deletion exposure, Sheet pushes lagging reconciliation, the checkpoint-race retry, and the earlier compile-repair items (see git history of this file at `b88b7f800`).

## Current slice

**A35-S8b Pages outside the room show checkpoint freshness (nullable `checkpointedAt`).** See the [source-first handoff](phase-08-2-claude-source-first.md#remaining-implementation-and-sequence), item 3.

## Next slices

The registry `queue` holds the order: A35-S3b recovery and cleanup, A35-S6b Scene retirement and fixtures, A35-S7b held-actor removal on account deletion, A35-S3c packed Scene history, A35-S5 parity, A35-S6c the switch (approved for Opus), A35-S9 budgets, then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**Not scheduled (needs your call):** CP-S6i rule-roll chat cards, A35-S8c room-planned evidence rolls, A36-S10 room content from snapshots, A36-F1, RUL-9, TST-0/4/5/6, PLT-5 (D75 web hosting), PLT-6.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
