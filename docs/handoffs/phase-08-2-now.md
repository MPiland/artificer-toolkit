# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-04 (A35-S10d done; next is REL-5).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 189/281 criteria, 77 READY (`node scripts/acceptanceProgress.mjs`).
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
  - Code first, then the compile gate: `local-validation/codex-batch/gate.ps1 -Name <gateN>`. gate-s10d-review was the last used. The gate takes the validation lock itself.
  - Then focused proofs:
    - Convex: `vt.ps1`;
    - worker `src`: root `yarn vitest run --config vitest.config.ts <file>`;
    - native: `nt.ps1` (or `s10c-run.ps1 -Name <n>` for native plus the schema contract test).
  - Full apis suite: `local-validation/vs8/full-apis.ps1 -Name <n>` (about 50 min). It needs a frozen tree, because apis tests import worker and package source; a nested worktree does not isolate them.
- **Docker:** agents may start Docker Desktop and `phase82-convex-local-linux` ([AGENTS.md](../../AGENTS.md)).
- **User:** a PM, not an architect. Make architecture calls yourself, explain them plainly and recommend. Expect low volume at launch.

## Active slice: VS-8 (budgets in gates, full suites, V15)

**Done:**
- the Convex command endpoint is deleted; A35-S6d, A35-S6e and A35-S9 (checkpoint I/O, the dev room meter, `scripts/v15Budgets.mjs`); TST-0 and TST-6;
- A35-S10a–S10c: small flushes, fewer forced checkpoints, flush on the next message, live views read the room;
- A35-S10d (D88, [plan status](adr-0035-implementation-plan.md#a35-s10d-encounter-history-stays-in-the-room-amendment-22-d85)): Encounter receipts, timeline and roll evidence stay in room SQLite for the whole Run and survive every hydrate; checkpoints carry Sheet receipts plus a compact Convex `encounterReplayIndex`; COMPLETE deletes both; Convex timeline, evidence-roll and Character history reads are deleted.
- VS-11 (D87): PLT-6, PLT-7 and PLT-8.

**Decided:** D85, D86, D87 and D88 ([decisions log](phase-08-2-decisions.md)). V15 session model: 5-hour sessions, 4 fights of 8 rounds, 5 players and a GM, weekly; 6 enemies, about 3 hours of combat.

**Next session starts here: REL-5 (V15).** It was paused because runs a9–a11 failed (a reactor player never got MOVEMENT_REACTION).
- Rewrite `apps/apis/tests/developmentEncounterCutover.ts` for the room: read room frames, not Convex; a checkpoint barrier before Convex checks; convergence from peer-socket `COMMAND_COMMITTED`; zero Convex calls per command.
- Delete the dev query `encounters/developmentLifecycle:movementReactionDamage`. It still reads Convex Encounter history, which S10d stopped writing, so the driver must read room frames instead.
- Then run `scripts/runLocalConvexProof.ps1 -Proof v15-workload` and the six browsers, and feed `v15Budgets.mjs`. Also: a paced out-of-combat measurement; per-document sizes of checkpoint writes; unit costs plus a session estimate whose assumptions the user sets; set N (30–120 s); wire the budget check into `validatePreStagingLocal.mjs`.
- The event recorder and driver changes in `apps/apis/tests/development{HttpClient,EncounterScenes,RoomMeasurement,EncounterCutover}.ts` were committed with S10d (their HEAD versions read the deleted Convex timeline) but have not been run yet.

**S10d known limits:** after storage loss, movement decisions and `MOVE_SCENE_TOKEN` have no index row, so their retry is refused as stale; an indexed replay returns roll null (the card stays in chat); GM undo returns REVERT_UNAVAILABLE.

**Carried:**
- PLT-8's GM "Show to players" menu and player modal have had no browser or Storybook check; cover them in the REL-4 journeys (or a Storybook story) before VS-9.
- The Campaign Prepare view opens its own summary socket while a table runs; fold into the per-panel socket merge decision after REL-5.
- From S10b/PLT-7: merge `manageNotes` and `contributeSessionNotes`; check the client re-subscribes after a challenge; uncapped pins per notebook section in the purge; the purge runs after the departure cascade commits; confirm `CONVEX_SITE_URL` in the worker matches the JWT issuer exactly.
- REL-5 check from PLT-6: the room's own Encounter reads expose only the ACTIVE Run to players.
- `apps/session-worker/src/roomCheckpoints.test.ts` "trims a journal page" times out at 5 s in parallel runs and passes alone.

**Remaining, in order**
1. **REL-5** (above).
2. **REL-4.** Local reset, seed and `convex deploy` (codegen does not deploy). Fix `seed:srd:convex:local` on Docker; S10d's local data reset waits on it (the S10d schema pushed cleanly over existing data). Run the Scene authoring, lifecycle and Drafts movement dev scripts, then the journeys.
3. **Carried items:** worker and native "uncaught exception" logs on injected failures; `typecheck:config` failing at `tests/live-backend/encounterMovement.ts:589`; fog staging cap and sweep; D84 cost recheck; small cleanups (`automaticMovementResponse` import, `uninterruptedMovement` parameter, `nativeCaptureCache` naming, `readChecksum`, departed-Character cached rows).
4. **After measurement:** decide cadence, patch versus replace, and document splits from the numbers; decide on merging per-panel sockets from the meter's sockets-per-member counts.

**Later:** VS-9 (final local proof), then VS-10 (staging and production; needs approval). RUL-9 slices are Phase 8.3 scope.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
