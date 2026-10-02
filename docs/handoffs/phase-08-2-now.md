# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after VS-1).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria accepted; 59 criteria READY_FOR_ACCEPTANCE (`node scripts/acceptanceProgress.mjs`).
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
  - The gate is `local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate39 is the last one used. It takes the validation lock itself and runs the build, the local codegen push and the typechecks, web included.
  - Then run the focused proofs: worker `test/` suites use the worker's own vitest config. Full suites run once, in VS-8.
- **Docker:** agents may now start Docker Desktop and the `phase82-convex-local-linux` container ([AGENTS.md](../../AGENTS.md) Windows Process Execution). After an unclean shutdown the backend takes about 3 minutes to answer `/version`.

## Last slice

**VS-1 Scene history** is done: V05.1–5, V07.1 and V14.2 are READY, and it finishes A35-S3a and S3c0–S3c3. Commits `dcb2815bd` to `1cbe6f668`.
- S3c2: Scene history is packed into SCENE-scope receipt ledgers. S3c3: the room builds its Scene cache from its own store, and the Convex hydrate route is deleted.
- The idle alarm retries every 30 s (`ROOM_LIMITS.alarmRetryMs`) after a failed checkpoint or close.
- Room-path proofs cover drain gated on the final checkpoint (both sides), stale same-Scene moves, and two Campaign rooms committing concurrently.
- Dev scripts wait for the Scene checkpoint via `awaitSceneCheckpoint`, and the lifecycle script covers Scene ledger deletion again.
- A Convex test pins a hydration page's row and byte budget. The fanout vision tests run through the room (D33).
- V07.1's browser movement journeys re-run on the final source under R08 and V15. The user agreed on 2026-10-02 that this does not hold V07.1 open.
- Also done: VS-7 (D75 SSR policy). `acceptanceProgress.mjs` gained the READY-as-closed and disjoint-parallel rules.

## Next slice

**VS-2 Movement and passage through the room** (see the registry for its criteria and includes). Carried in:
- Fix the detached unassigned maintained-effect owner refusal (`movementMaintenanceCharacters`).
- The Drafts movement dev flow still reads Convex without waiting for a checkpoint. Give it an observed write version to poll with `awaitSceneCheckpoint`.

## Later slices

- **VS-3 (Encounter decisions):**
  - Fix the tied-initiative pending-snapshot base rewrite (`encounterWriteSets`, the 100-actor budget).
  - No direct test covers private and table enemy rolls on the room path.
- **VS-6 (Builder budgets):** run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026).
- **VS-8 (V15 and full suites):**
  - The date-dependent worker reds: `roomCheckpoints` "trims a journal page…" and `roomPrivateRolls` "keeps twenty private rolls…".
  - `src/roomInputs.test.ts`: 2 Character-refresh journal tests fail ("expected [ 1, 2 ] to deeply equal [ 3 ]"). They already failed at `dcb2815bd`.
  - The worker suite logs "uncaught exception … RoomCheckpoints.#flush" from fire-and-forget paths when checkpoint failures are injected. Check that production handles those rejections.
  - The Cutover V15 workload (`developmentEncounterCutover.ts`) reads Convex without waiting for a checkpoint.
  - Run the Scene authoring and lifecycle dev scripts; they are changed but not yet run.
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
