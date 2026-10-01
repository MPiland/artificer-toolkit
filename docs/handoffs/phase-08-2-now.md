# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01 (after A35-S7b).

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

**A35-S7b Account deletion removes held actors** (F12, [D74](phase-08-2-decisions.md)). State: integrating. Gate18 is clean (builds, local codegen, typechecks, web). Affected tests: Convex `liveSessions/roomInputs.test.ts` 36/36; Worker `src/roomInputs.test.ts` and `src/roomCharacterReload.test.ts` 72/74 (the 2 failures predate this slice; see below).

- **Contract:** the CHARACTERS room input answers `DELETED` (new part) for a Character that no longer exists, `UNASSIGNED` otherwise (`liveRoomInputs.ts`, Convex `readCharactersPage`).
- **Room reconcile** (`roomActorReconcile.ts`, `#reconcileActorDepartures`): when an unfrozen Character actor's assignment is gone, the room asks Convex once which of those Characters are deleted. It removes their actors with the shared `removeMissingCharacterActors` (now given an `isMissing` predicate; Convex release passes its own) as the Campaign owner, then freezes the rest. A removal checkpoints before the receipt, drops cached play and Scene, and challenges every socket so members resume.
- **Hydrate fix:** a Run first opened mid-epoch with a departed or deleted Character used to throw "unassigned but not frozen" (Convex no longer freezes held Runs under D74). It now hydrates the assigned Characters and leaves the rest to the reconcile.
- **Docs:** live-sessions D74 section, the D74 decision bullet, persistence and character status lines, F12.3/F12.4 ledger entries.

Follow-ups:

- **Remaining gap:** an actor frozen earlier whose account is deleted later is removed only at release.
- **Not covered by tests yet (REL-4):** an integrated room test of deletion during a held Run (reconcile removal, checkpoint, socket challenge). The S7a reconcile itself has no room test either.
- The S7a freeze receipt is still `delta: null` with no resync, so clients see a frozen actor only after a resume.
- **Stale Worker unit tests (REL-4):** `src/roomInputs.test.ts` "commits a parent play mutation and stale Character refresh as one journal entry" and "replaces a Character’s effects and record in one room command, once" expect a refresh to replace active effects. The code keeps room-owned effects on a Builder refresh (`roomInputs.ts`, "Active effects are room-owned while held"). They fail on HEAD too; the `src/` unit tests were not part of the S6b suite run.
- **Carried from A35-S6b and A35-S3b:** see this file at `2a96c51f8` (S6c Convex movement stage and preview Scene cache, D26 fail-open, pending-movement fixture checksums, room harness duplication, clock-prompt and recovery items).

## Current slice

**A35-S3c Packed Scene history and checkpoint integration** (V05, V07, [D70](phase-08-2-decisions.md)). Scene receipts still use their native payload format; pack them per D70 (packed history with indexed receipt headers) and carry them through room checkpoints, as `docs/architecture/live-sessions.md` ("history packing remains required before S6") and `docs/architecture/persistence.md` ("Packed history per checkpoint (S3) is not done yet") record.

## Next slices

The registry `queue` holds the order: A35-S5 parity, A35-S6c the switch (approved for Opus), A35-S9 budgets, then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**Not scheduled (needs your call):** CP-S6i rule-roll chat cards, A35-S8c room-planned evidence rolls, A36-S10 room content from snapshots, A36-F1, RUL-9, TST-0/4/5/6, PLT-5 (D75 web hosting), PLT-6.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
