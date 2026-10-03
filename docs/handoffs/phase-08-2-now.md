# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-03 (after VS-6).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria accepted; 72 criteria READY_FOR_ACCEPTANCE (`node scripts/acceptanceProgress.mjs`).
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
  - The gate is `local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate74 is the last one used. It takes the validation lock itself.
  - Then run the focused proofs. Worker `src` tests run from the root with `yarn vitest run --config vitest.config.ts <file>`; `local-validation/codex-batch/nt.ps1` runs the native suite. Full suites run once, in VS-8.
- **Docker:** agents may start Docker Desktop and the `phase82-convex-local-linux` container ([AGENTS.md](../../AGENTS.md)).
- **Product rules:** apply recorded decisions to the exact trigger they name. D81 (leaving a Campaign) and D82 (leaving a Run) differ; ask one precise question when a case only resembles a decision.

## Last slice

**VS-6 Builder budgets on content snapshots** is done: P02.3 and case P02 are READY. It finishes A36-S10 and A36-F1. Summary: [vs6-builder-budgets-2026-10-03.md](../validation/phase-08-2/vs6-builder-budgets-2026-10-03.md).
- **D84 (new):** a flat 300 KB commit budget was infeasible (one SRD Class costs 240–330 KB to read once). Commit database I/O is now budgeted at 450 KB for one Class plus 200 KB per further distinct Class (ADR 0036 amended). Native commits: 546 KB (Fighter/Rogue), 400 and 436 KB (one Class), down from 782 and 955 KB.
- **How:**
  - Compilations moved off `authoredVersions` into `authoredVersionCompilations`.
  - A per-commit document cache reads each referenced document once (`readPublishedRootDocument`, `CharacterReferencedReads.documents`).
  - The convex-test counter (`tests/fixtures/databaseIo.ts`) now counts binary fields, and the budget fixtures carry Class compilations.
  - `playStateBudget` was re-baselined for the receipt-ledger bytes it had not been counting.
- **Budget proof:** `scripts/builderBudgets.mjs <proof>` reads the native log plus `builder-journeys.json`, which records the edit-phase Convex calls (only autosave is allowed) and each journey's `classCount`.
- **A36-F1:** autosave stops on a typed `DRAFT_REPLACED` error and shows "Opened elsewhere". A new draft opens on the recommended step.
- **Local stack lesson:** `convex codegen` does not deploy schema or functions to the Docker backend. After a schema change, run `convex deploy --url … --admin-key …` (as `validatePreStagingLocal.mjs` does). Data was reset twice and reseeded (1119 rows, audit passed).

## Next slice

**VS-8 (V15 and full suites)** (see the registry). A36-S10's room snapshot loading gets its load proof in the V15 run.

## Later slices

- **VS-8 (V15 and full suites):**
  - Seven apis tests are red and unexplained. None is in VS-4 code; `sheetCommands` was red before VS-4.
    - `sheetCommands`, `sheetAdjustments`, `sheetResources`: the rollback spies on `projectCharacterSheetBundle`; the mutation resolves.
    - `currencyDeparture`: 3 tests; the fixture can no longer store an invalid amount.
    - `builderSnapshotParity`: a new "Cantrip requires 1 selection" issue.
  - `seed:srd:convex:local` fails on the Docker backend (`--deployment local`). Use `convex run content/seed:seed --url http://127.0.0.1:3210` with an in-memory admin key, and fix the script.
  - The worker suite logs "uncaught exception … RoomCheckpoints.#flush" when checkpoint failures are injected, and the native suites log "uncaught exception … LiveSessionRouteError". Check that production handles those rejections.
  - The Cutover V15 workload (`developmentEncounterCutover.ts`) reads Convex without waiting for a checkpoint.
  - Run the Scene authoring, lifecycle and Drafts movement dev scripts; they are changed but not yet run.
  - Fog: the per-account staging cap (512 KB) is unreachable; the final hydration page has no row budget; expired staging is swept only on the next begin.
  - `typecheck:config` fails on `tests/live-backend/encounterMovement.ts:589` (a `PUBLISH_SCENE_FOG_PATCH` command against the Scene command union); this predates VS-6.
  - D84: recheck the free-tier cost model with the measured commit and full-build bytes (628–854 KB per build).
  - Many apis test files changed for the compilation table; only the focused set ran (160/161 plus the budget tests), so the full suite is the real check.
  - Small cleanups: the unused import in `automaticMovementResponse.test.ts`; the unused parameter in `uninterruptedMovement.test.ts`; rename `nativeCaptureCache.ts`; the unused `readChecksum`; the room's stale cached rows for departed Characters (filtered, not evicted).
- **VS-10:** edge rules and the staging deploy; needs approval.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its slices are Phase 8.3 scope (ADR 0034) and gate closed beta.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
