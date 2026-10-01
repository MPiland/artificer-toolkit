# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01.

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 51/75 cases and 190/276 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. Its data lives in the scratchpad `dashboard/data.json`; update it with a small script, without reading the page back.
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**Compile repair of the Codex batch.** Gate clean: package builds, local codegen, every typecheck (including the session-worker test tsconfig) and web. **No tests have run on the batch yet.** Known follow-ups for the test cycle:

- The Character Sheet replay no longer re-checks Campaign status from the room store, which is empty on a cold start. Member admission already implies an ACTIVE Campaign.
- `test/nativeLiveSessionRoom.test.ts` "rolls back a local Encounter command when admission expires": the removed `SYSTEM` invalidation was dropped. The test relies on the `revisions.system` bump to force the SYSTEM read; confirm when it runs.
- `developmentCheckpointScenes.capture` lost its `returns` validator (TS2589); the handler still parses its result.

## Current slice

1. **S7 Sheet through the room.** Web routing of held Sheet commands to the room, plus moving the held lifecycle (Character departure, controller removal, account departure, checkpoint filtering) into native eviction. See the [source-first handoff, Remaining implementation](phase-08-2-claude-source-first.md#remaining-implementation-and-sequence). Delegate to one Sonnet implementer and run the compile gate at the end.

## Next slices (in order)

2. **Chat and rolls through the room.** Uses the per-room rate limits in decision D72 ([decisions](phase-08-2-decisions.md)).
3. **`checkpointedAt` freshness, recovery and cleanup.** Also the remaining Scene retirement and the movement and Sheet input fixtures.
4. **Packed Scene history and checkpoint integration.** Then S5 parity and the S6 authority switch (approved for Opus).
5. **Test and fix cycles.** Local reset, seed and codegen first, then affected suites, full suites, end-to-end journeys, `yarn validate:pre-staging:local`, and V15/Q16.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
