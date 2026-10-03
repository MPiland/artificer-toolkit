# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after VS-4).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria accepted; 70 criteria READY_FOR_ACCEPTANCE (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger, the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json) and a burn-up history from git.
  - To update it, change slice states in the registry and write the `--json` output to `data.json` in the session scratchpad.
  - Then list the Artifact's files (`scope: files`) and publish with `files: {"data.json": <scratchpad>/data.json}`.
- **Slices (D80):** a slice is done when its criteria are READY_FOR_ACCEPTANCE with a focused proof. Active slices may run in parallel only when they close disjoint cases. Done slices leave the `queue`.
- **Slice start:** set the slice `active` in the registry and republish the dashboard before any slice work.
- **One slice per session.** At the boundary:
  - commit;
  - rewrite this file;
  - set the slice and its `includes` to `done` and remove it from the queue;
  - republish the dashboard;
  - stop every background shell and agent;
  - give the user the `/clear` line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, then the compile gate.
  - The gate is `local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate59 is the last one used. It takes the validation lock itself.
  - Then run the focused proofs. Worker `src` tests run from the root with `yarn vitest run --config vitest.config.ts <file>`; `local-validation/codex-batch/nt.ps1` runs the native suite. Full suites run once, in VS-8.
- **Docker:** agents may start Docker Desktop and the `phase82-convex-local-linux` container ([AGENTS.md](../../AGENTS.md)).
- **Product rules:** apply recorded decisions to the exact trigger they name. D81 (leaving a Campaign) and D82 (leaving a Run) differ; ask one precise question when a case only resembles a decision.

## Last slice

**VS-4 Held Sheet play, recovery and account deletion through the room** is done: F12.3, F12.4, P15.3, R06.3 and V14.5 moved to READY. It finishes A35-S7a, A35-S3b, A35-S7b and TST-4.
- **Proofs:** `liveSessions/heldSheetPlay.test.ts` and `liveSessions/heldAccountDeletion.test.ts` (Convex-backed room fixture), the F12.4 native test in `nativeCharacterSheet.test.ts`, `roomActorReconcile.test.ts`, and the P15.3 local run in [p15-3-local-recovery-2026-10-02.md](../validation/phase-08-2/p15-3-local-recovery-2026-10-02.md).
- **D82 (new):** a GM removal of a Character keeps its actor `outOfInitiative`, still held, with its effects running on Encounter time; `UPDATE_ACTOR` `returnToInitiative` brings it back. The web tracker shows it, but there is still no UI control to remove a Character.
- **Play clock:** checkpoints now carry the room's play `streamVersion`, and Convex refuses one that does not advance (live-sessions.md, checkpoint publication).
- **HP:** current HP never exceeds the effective maximum. The shared reducer and the room reconcile enforce it, with no Builder-clock gate.
- **Fixes:**
  - account deletion ends a held Character's maintained states in Runs the room does not hold;
  - the departure reconcile handles a deleted Character and an unassigned Character in one pass;
  - the encounter store conformance test reads logical receipt rows.
- **Local data:** reset and reseeded for `outOfInitiative`. The backup is `local-validation/convex-reset/vs4-out-of-initiative.before.zip`; delete it once VS-5 runs green on the reseeded data.

## Next slice

**VS-5 Chat and rolls through the room, with chat cards for automatic rule rolls** (see the registry).

## Later slices

- **VS-6 (Builder budgets):** run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026).
- **VS-8 (V15 and full suites):**
  - Seven apis tests are red and unexplained. None is in VS-4 code; `sheetCommands` was red before VS-4.
    - `sheetCommands`, `sheetAdjustments`, `sheetResources`: the rollback spies on `projectCharacterSheetBundle`; the mutation resolves.
    - `currencyDeparture`: 3 tests; the fixture can no longer store an invalid amount.
    - `builderSnapshotParity`: a new "Cantrip requires 1 selection" issue.
  - `seed:srd:convex:local` fails on the Docker backend (`--deployment local`). Use `convex run content/seed:seed --url http://127.0.0.1:3210` with an in-memory admin key, and fix the script.
  - The worker suite logs "uncaught exception … RoomCheckpoints.#flush" when checkpoint failures are injected. Check that production handles those rejections.
  - The Cutover V15 workload (`developmentEncounterCutover.ts`) reads Convex without waiting for a checkpoint.
  - Run the Scene authoring, lifecycle and Drafts movement dev scripts; they are changed but not yet run.
  - Fog: the per-account staging cap (512 KB) is unreachable; the final hydration page has no row budget; expired staging is swept only on the next begin.
  - Small cleanups: the unused import in `automaticMovementResponse.test.ts`; the unused parameter in `uninterruptedMovement.test.ts`; rename `nativeCaptureCache.ts`; the unused `readChecksum`; the room's stale cached rows for departed Characters (filtered, not evicted).
- **VS-10:** edge rules and the staging deploy; needs approval.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its slices are Phase 8.3 scope (ADR 0034) and gate closed beta.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
