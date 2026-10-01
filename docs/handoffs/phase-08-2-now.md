# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01.

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 51/75 cases and 190/276 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger with the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json). Slice IDs below are registry IDs. To update: change the slice states (and `queue`) in the registry, write the script's `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` with `path` fetches both).
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the slice registry and republish the dashboard;
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**A35-S7a Sheet through the room (D73, D74).** State: integrating. Gate8 clean: package builds, local codegen, every typecheck and web. **No tests have run.** Source summary is in [live-sessions.md](../architecture/live-sessions.md) (held Sheet and D74 paragraphs).

- **D73:** The room pushes the viewer-projected Sheet (`roomCharacterSheetFeed.ts`, `roomCharacterSheetProjection.ts`) to the owner and the GM after each commit that changes play. The web (`useLiveCharacterSheet.ts`) routes the 19 play commands to the room and holds play controls until the first push.
- **D74:** Convex skips actor writes for open Runs under live authority. The room reconciles departures after every commit and on authorization reload (`roomActorReconcile.ts`). Convex reconciles at release (`releaseReconcile.ts`), and checkpoint ingestion rejects departed controllers.

Follow-ups for the test cycle:

- **Interim deletion exposure:** a deleted account's Character stays frozen, not removed, in a held Run until release.
- **Pushes can lag reconciliation:** Sheet pushes run without a transaction, so they can show HP or usage reconciliation only after the next command.
- **Checkpoint race:** a checkpoint that arrives before the room reconciles a departure is rejected and should pass on retry. Confirm this.
- **Earlier compile-repair items:** Sheet replay's Campaign status, the `nativeLiveSessionRoom` admission-expiry rollback test, and the `developmentCheckpointScenes.capture` `returns` validator.

## Current slice

**A35-S8a Chat and rolls through the room.** Uses the per-room rate limits in decision D72 ([decisions](phase-08-2-decisions.md)). See the [source-first handoff, Remaining implementation](phase-08-2-claude-source-first.md#remaining-implementation-and-sequence), item 2. Delegate to one Sonnet implementer and run the compile gate at the end.

## Next slices

The registry `queue` holds the order: A35-S8b freshness, A35-S3b recovery and cleanup, A35-S6b Scene retirement and fixtures, A35-S7b held-actor removal on account deletion, A35-S3c packed Scene history, A35-S5 parity, A35-S6c the switch (approved for Opus), A35-S9 budgets, then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**Not scheduled (needs your call):** CP-S6i rule-roll chat cards, A36-S10 room content from snapshots, A36-F1, RUL-9, TST-0/4/5/6, PLT-6. PLT-5 waits on Q20.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
