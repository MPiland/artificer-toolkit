# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01 (after A35-S6b).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (P14 reopened for room chat) (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger with the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json). Slice IDs below are registry IDs. To update: change the slice states (and `queue`) in the registry, write the script's `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` with `path` fetches both).
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the slice registry and republish the dashboard;
  - stop every background shell and agent this session started (`TaskStop` each ID; check that none are still running, including ones that seemed to finish or were killed with `pkill`);
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**A35-S6b Retire the remaining Scene paths; author the movement and Sheet input fixtures.** State: integrating. Gate17 is clean (builds, local codegen, typechecks, web). The full session-worker suite passes 200/200 (12 files). It includes the room tests, the new `nativeCharacterSheet.test.ts` and the D26 hold tests.

- **Retired in the room:**
  - The fast-only undo copies (`undo_json`, dropped by migration). Undo now reads native Scene history, and an exhausted undo answers INVALID_COMMAND.
  - The Convex movement-hold capture (`sceneMovementDecisionPending`). The D26 hold reads the PENDING occurrence from room SQLite (`readMovementDecisionPending`) before any move, door change or undo.
  - The held-movement Convex stage.
- **Bugs fixed:**
  - `RoomEncounterStore.transact` logged every set. A native geometry save (RECEIVING then PUBLISHED in one command) broke the append-only checkpoint, so reauthentication failed. It now logs each record's net change.
  - Strict parses failed on undo `restoredFogOwners` and geometry `fogPatches`.
  - The play-authorization `...bound` field leaked.
  - `oldestUnpublishedCommandTime` threw in a fresh room.
- **Fixtures:**
  - `characterSheetInputsFixture.ts` and `pendingMovementFixture.ts` (real persisted schemas).
  - Shared native Scene inputs in `roomInputsFixture.ts`.
  - `nativeRoomAdmission` and `nativeTransientFanout` had been red since the unvalidated WIP batch: activation reads native Scene inputs, which neither fixture served. Both now serve them.

Follow-ups:

- **For A35-S6c:**
  - Convex `encounterMovement.stage` has no worker caller.
  - `fastOnly` in `sceneUndoPublication` remains for Convex.
  - The preview Scene cache (`#refreshSceneCache` → `hydrateNativeTransientScene`) still reads ENTITIES, fog and vision pages from the Convex hydrate route after a flush. Activation already reads native Scene inputs. Move the cache to room-store reads and delete the hydrate route (cuts Convex reads per cache rebuild).
- The D26 hold fails open if the bound Run is missing.
- **Two old D26/D52 tests were not restored.** The ROUTED stage handoff no longer exists. Room-local Encounter tool commands now refuse while any occurrence is PENDING (`recordEncounterToolCommand`).
- The pending-movement fixture's checksums are placeholders, so it cannot resume a decision.
- `nativeCharacterSheet.test.ts` duplicates the room harness; a shared `roomHarness.ts` is possible.
- `apps/apis/convex/_generated/api.d.ts` was regenerated.
- **Carried from A35-S3b (REL-4):**
  - Add a mixed fighter/non-fighter clock-prompt case, plus web prompt tests.
  - `recoveryPrompts` collects without a bound.
  - The system pause and resume write no receipt.
  - Old clock rows lack `pausedForCombat` (reseed).
  - A35-S8b notice tests and 5 s polling.
  - Older items: see this file at `7a8c45f59`.

## Current slice

**A35-S7b Account deletion removes held actors** (F12, [D74](phase-08-2-decisions.md)). Deleting an account must remove that user's actors from Runs the room holds, through the room's departure reconcile, not a direct Convex write.

## Next slices

The registry `queue` holds the order: A35-S3c packed Scene history, A35-S5 parity, A35-S6c the switch (approved for Opus), A35-S9 budgets, then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**Not scheduled (needs your call):** CP-S6i rule-roll chat cards, A35-S8c room-planned evidence rolls, A36-S10 room content from snapshots, A36-F1, RUL-9, TST-0/4/5/6, PLT-5 (D75 web hosting), PLT-6.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
