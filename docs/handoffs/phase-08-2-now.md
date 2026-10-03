# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after VS-3).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria accepted; 65 criteria READY_FOR_ACCEPTANCE (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger, the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json) and a burn-up history from git.
  - To update it, change slice states in the registry and write the `--json` output to `data.json` in the session scratchpad.
  - Then list the Artifact's files (`scope: files`) and publish with `files: {"data.json": <scratchpad>/data.json}`.
- **Slices (D80):** a slice is done when its criteria are READY_FOR_ACCEPTANCE with a focused proof. The script treats READY and ACCEPTED as closed.
  - Active slices may run in parallel only when they close disjoint cases. The script errors when two active slices share a case.
  - Done slices leave the `queue`.
- **Slice start:** set the slice `active` in the registry and republish the dashboard before any slice work.
- **One slice per session.** At the boundary:
  - commit;
  - rewrite this file;
  - set the slice and its `includes` to `done` and remove it from the queue;
  - republish the dashboard;
  - stop every background shell and agent;
  - give the user the `/clear` line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, then the compile gate.
  - The gate is `local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate47 is the last one used. It takes the validation lock itself and runs the build, the local codegen push and the typechecks, web included.
  - Then run the focused proofs: worker `test/` suites use the worker's own vitest config. Full suites run once, in VS-8.
- **Docker:** agents may now start Docker Desktop and the `phase82-convex-local-linux` container ([AGENTS.md](../../AGENTS.md) Windows Process Execution). After an unclean shutdown the backend takes about 3 minutes to answer `/version`.

## Last slice

**VS-3 Encounter decisions and journeys through the room** is done: R06.1, R06.2, R06.4, V13.1 and V13.2 moved to READY; V10.5–V10.11, V12.4–V12.8, V14.1, V14.3 and V14.4 were already READY. It finishes A35-S6c1 and A35-S6c3.
- **Journeys:** `liveSessions/encounterJourneys.test.ts` runs four journeys through the room and a recovery after a release (`discardRoomJournal()` in the Convex worker fixture). A "Roll dice" replay returns only its evidence roll.
- **Decision replay fix:** after a release, a decision answer is a retry when its Run command receipt or its rule receipt is recorded (`roomEncounterCommands.ts`).
- **Private-roll fix:** only committed rolls expire, so a command past twenty rolls checkpoints them all (`roomPrivateRolls.ts`). The set-then-delete netting had dropped them from the journal.
- **Run fence:** `encounters/runs:deletePrepared` refuses a room-held Run.
- **Tied initiative:** the pending-snapshot base is canonicalized (`pendingSnapshots.ts`), and the write-set budget test covers it. Enemy rolls replay after a release in `commands.test.ts`.
- **Worker test rot fixed:** the stale fixtures and expectations from cce41580d and VS-1/VS-2 are fixed, covering `roomInputsFixture` revisions, turn capture, maintenance capture D81 assignments, room-owned effects in `roomInputs` and the `roomCheckpoints` trim. Worker `src` passes 223/223 and native passes 217/217. `local-validation/codex-batch/nt.ps1` runs the native suite under the lock.

## Next slice

**VS-4 Held Sheet play, recovery and account deletion through the room** (see the registry).
## Later slices

- **VS-4 (held Sheet play):** an assigned non-actor Character that owns maintained-effect dependents is not held. The room keeps stale cached rows for departed Characters; they are filtered out but not evicted.
- **VS-6 (Builder budgets):** run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026).
- **VS-8 (V15 and full suites):**
  - The worker suite logs "uncaught exception … RoomCheckpoints.#flush" from fire-and-forget paths when checkpoint failures are injected. Check that production handles those rejections.
  - The Cutover V15 workload (`developmentEncounterCutover.ts`) reads Convex without waiting for a checkpoint.
  - Run the Scene authoring, lifecycle and Drafts movement dev scripts; they are changed but not yet run.
  - The per-account fog staging cap (512 KB) is unreachable: 2 uploads of about 60 KB each. Resize it or drop it in favor of the per-upload limits.
  - The final hydration page (fog save chunks; 264 documents in the test) has no row budget.
  - Expired fog staging is swept only on the next begin.
  - Small cleanups:
    - the unused import in `automaticMovementResponse.test.ts`;
    - the unused parameter in `uninterruptedMovement.test.ts`;
    - rename `nativeCaptureCache.ts`;
    - remove the unused `readChecksum` in the Encounter capture protocol.
- **VS-10:** edge rules and the staging deploy; needs approval.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its slices are Phase 8.3 scope (ADR 0034) and gate closed beta.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
