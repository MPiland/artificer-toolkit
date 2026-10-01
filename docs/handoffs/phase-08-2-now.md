# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01.

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 51/75 cases and 190/276 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. To update it, read the published `data.json` (Artifact `read` with `path`), edit it with a small script, and republish it with `index.html` from the current session's scratchpad.
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the dashboard data by script;
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**S7 Sheet through the room (D73, D74).** Gate8 clean: package builds, local codegen, every typecheck and web. **No tests have run.** Source summary is in [live-sessions.md](../architecture/live-sessions.md) (held Sheet and D74 paragraphs).

- **D73:** The room pushes the viewer-projected Sheet (`roomCharacterSheetFeed.ts`, `roomCharacterSheetProjection.ts`) to the owner and the GM after each commit that changes play. The web (`useLiveCharacterSheet.ts`) routes the 19 play commands to the room and holds play controls until the first push.
- **D74:** Convex skips actor writes for open Runs under live authority. The room reconciles departures after every commit and on authorization reload (`roomActorReconcile.ts`). Convex reconciles at release (`releaseReconcile.ts`), and checkpoint ingestion rejects departed controllers.

Follow-ups for the test cycle:

- **Interim deletion exposure:** a deleted account's Character stays frozen, not removed, in a held Run until release.
- **Pushes can lag reconciliation:** Sheet pushes run without a transaction, so they can show HP or usage reconciliation only after the next command.
- **Checkpoint race:** a checkpoint that arrives before the room reconciles a departure is rejected and should pass on retry. Confirm this.
- **Earlier compile-repair items:** Sheet replay's Campaign status, the `nativeLiveSessionRoom` admission-expiry rollback test, and the `developmentCheckpointScenes.capture` `returns` validator.

## Current slice

1. **Chat and rolls through the room.** Uses the per-room rate limits in decision D72 ([decisions](phase-08-2-decisions.md)). See the [source-first handoff, Remaining implementation](phase-08-2-claude-source-first.md#remaining-implementation-and-sequence), item 2. Delegate to one Sonnet implementer and run the compile gate at the end.

## Next slices (in order)

2. **`checkpointedAt` freshness, recovery and cleanup.** Also the remaining Scene retirement, the movement and Sheet input fixtures, and the account-deletion removal of held actors.
3. **Packed Scene history and checkpoint integration.** Then S5 parity and the S6 authority switch (approved for Opus).
4. **Test and fix cycles.** Local reset, seed and codegen first, then affected suites, full suites, end-to-end journeys, `yarn validate:pre-staging:local`, and V15/Q16.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
