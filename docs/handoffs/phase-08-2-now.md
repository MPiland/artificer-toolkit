# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-03 (VS-8 in progress, mid-slice checkpoint).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv.
  - It renders `node scripts/acceptanceProgress.mjs --json` (the ledger, the registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json) and git history).
  - To update it: change registry states, write the `--json` output to `data.json` in the session scratchpad, list the Artifact's files (`scope: files`), and publish with `files: {"data.json": <scratchpad>/data.json}`.
- **Slices (D80):**
  - Done means the slice's criteria are READY_FOR_ACCEPTANCE with a focused proof.
  - At the boundary:
    - commit;
    - rewrite this file;
    - set the slice and its `includes` done and remove it from the queue;
    - republish the dashboard;
    - stop every background shell and agent;
    - give the `/clear` line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Rhythm:**
  - Code first, then the compile gate: `local-validation/codex-batch/gate.ps1 -Name <gateN>`. gate99 was the last used. The gate takes the validation lock itself.
  - Then focused proofs:
    - Convex: `vt.ps1`;
    - worker `src`: root `yarn vitest run --config vitest.config.ts <file>`;
    - native: `nt.ps1`.
  - Full apis suite: `local-validation/vs8/full-apis.ps1 -Name <n>` (about 50 min). It needs a frozen tree, because apis tests import worker and package source; a nested worktree does not isolate them.
- **Docker:** agents may start Docker Desktop and `phase82-convex-local-linux` ([AGENTS.md](../../AGENTS.md)).
- **User:** a PM, not an architect. Make architecture calls yourself, explain them plainly and recommend. Expect low volume at launch.

## Active slice: VS-8 (budgets in gates, full suites, V15)

**Done this session**
- `62cb9916d`: deleted the Convex Encounter command endpoint (a boundary test guards it) and fixed the baseline apis failures.
- `e3dfcc9c5`, A35-S6d: the room pushes `ENCOUNTER_SESSION` (Run, pending, waiting-on, turn movement, opt-in timeline). The 5 s web polling is gone.
- `e3dfcc9c5`, A35-S9 instrumentation:
  - checkpoints carry a `reason` and return Convex transaction I/O;
  - a room meter at `GET /internal/live-sessions/meter/<campaignId>` (dev, loopback only);
  - `scripts/v15Budgets.mjs` (tested only on synthetic data so far).
- A35-S6e (committed with this handoff): the room answers `ENCOUNTER_READ` for action choices, optional actions, evidence rolls and Scene binding. The Convex queries are thin wrappers over the same encounter-persistence readers.
- **D85 (decided by the product owner):**
  - Measure before changing any checkpoint cadence, payload or record shape. Remove only proven waste.
  - Encounter history follows Foundry: chat and roll cards persist; the turn timeline need not outlive the Run.
  - Losing up to one round on a rare DO storage loss is acceptable.

**Remaining, in order**
1. **TST-0.** The baseline full suite passed all 2161 tests but exited 1: 2 teardown errors from leaked scheduled `contentSnapshots/actions:build` (scheduled by `contentSnapshots/marking.ts`, needs `MEDIA_STORAGE_MODE`). Fix that. Then:
   - upgrade convex-test 0.0.56 → 0.0.60 and compare unshuffled plus seeds 101 and 202;
   - extend the 60 s session fixtures (`tests/fixtures/characters.ts`, `publication.ts`);
   - trial 2–3 workers.

   Baseline: `local-validation/vs8/apis-056-base2.json`.
2. **TST-6.** Move the 4 package-owned pure tests (actionExecution, actionEffectBaseline, wieldConflict, occurrenceOwner) to `src/__tests__`. Add planner tests for movement Concentration, passage contests and reaction order.
3. **REL-5 (V15).** Rewrite `apps/apis/tests/developmentEncounterCutover.ts` for the room:
   - read room frames, not Convex;
   - put a checkpoint barrier before Convex checks;
   - measure convergence from peer-socket `COMMAND_COMMITTED`;
   - require zero Convex calls per command.

   Then run `scripts/runLocalConvexProof.ps1 -Proof v15-workload` and the six browsers, and feed `v15Budgets.mjs`. Also:
   - add a paced out-of-combat measurement (the 120 s timer arms on any unsaved room change);
   - pull per-document sizes of checkpoint writes;
   - report unit costs plus a session estimate whose assumptions (fights and hours per session) the user sets;
   - wire the budget check into `validatePreStagingLocal.mjs`.
4. **REL-4.** Local reset, seed and `convex deploy` (codegen does not deploy). Fix `seed:srd:convex:local` on Docker. Run the Scene authoring, lifecycle and Drafts movement dev scripts, then the journeys.
5. **Carried items:**
   - worker and native "uncaught exception" logs on injected failures;
   - `typecheck:config` failing at `tests/live-backend/encounterMovement.ts:589`;
   - fog staging cap and sweep;
   - D84 cost recheck;
   - small cleanups: the `automaticMovementResponse` import, the `uninterruptedMovement` parameter, `nativeCaptureCache` naming, `readChecksum`, and departed-Character cached rows.
6. **After measurement:**
   - decide cadence, patch versus replace, and document splits from the numbers;
   - implement the D85 timeline discard;
   - decide on merging per-panel sockets from the meter's sockets-per-member counts.

**Later:** VS-9 (final local proof), then VS-10 (staging and production; needs approval). RUL-9 slices are Phase 8.3 scope.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
