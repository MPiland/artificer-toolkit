# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-04 (A35-S10c and PLT-8 done, so VS-11 is done; next is A35-S10d).

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
  - Code first, then the compile gate: `local-validation/codex-batch/gate.ps1 -Name <gateN>`. gate-s10c-3 was the last used. The gate takes the validation lock itself.
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
- A35-S10a: a one-actor HP flush reads 8.9 KB in 11 documents ([measurement](../validation/phase-08-2/a35-s10a-flush-io-2026-10-03.md));
- A35-S10b: fewer forced checkpoints, warm re-admission from the lease, sockets challenged before sign-in expiry;
- A35-S10c: a due flush rides the next message (deadline held in memory, so pings and previews touch no storage), and the alarm fires 15 s after it in a quiet room; one eager reload per burst of `INVALIDATE_INPUTS` while sockets are connected; the live Campaign summary feed (room HP, conditions and round on Campaign pages, privacy-projected, V14.6); Sheet play edits show at once and revert with the room's reason ([plan status](adr-0035-implementation-plan.md#a35-s10c-dirty-only-flush-live-views-on-the-room-edits-stream-in-amendments-17-19-20-and-21)).
- VS-11 (D87): PLT-6, PLT-7, and PLT-8 Show to players (a `campaignSceneShowings` row; players read the shown Scene's header, map and fog only, P14.7).

REL-5 is paused: V15 runs a9–a11 failed (a reactor player never got MOVEMENT_REACTION).

**Decided (product owner, [decisions log](phase-08-2-decisions.md)):** D85 (measure first; the timeline need not outlive the Run), D86 (write-behind flush, live views read the room, [ADR 0035 D86](../adr/0035-room-authoritative-live-encounters.md#d86-write-behind-state-flush-live-views-read-the-room--2026-10-03)), D87 (Campaign content hidden until revealed). V15 session model: 5-hour sessions, 4 fights of 8 rounds, 5 players and a GM, weekly; 6 enemies, about 3 hours of combat.

**Next session starts here**
- **A35-S10d** ([plan](adr-0035-implementation-plan.md#a35-s10d-encounter-history-stays-in-the-room-amendment-22-d85)): checkpoints stop writing Encounter history; the room discards its timeline, command log and receipts at Run end; a Run-scoped replay index replaces cross-epoch receipt hydrate; chat and roll cards ride the regular flush; remove receipt families with no reader; reset and reseed local data. Brief one Sonnet agent with the key tests first.
- **Carried:**
  - PLT-8's GM "Show to players" menu and player modal have had no browser or Storybook check; cover them in the REL-4 journeys (or a Storybook story) before VS-9.
  - The Campaign Prepare view opens its own summary socket while a table runs; fold into the per-panel socket merge decision after REL-5.
  - From S10b/PLT-7: merge `manageNotes` and `contributeSessionNotes`; check the client re-subscribes after a challenge; uncapped pins per notebook section in the purge; the purge runs after the departure cascade commits; confirm `CONVEX_SITE_URL` in the worker matches the JWT issuer exactly.
  - REL-5 check from PLT-6: the room's own Encounter reads expose only the ACTIVE Run to players.
- **Uncommitted, kept for REL-5:** the event recorder and driver changes in `apps/apis/tests/development{HttpClient,EncounterScenes,RoomMeasurement,EncounterCutover}.ts`. Commit them once run.

**Remaining, in order** (S10a–S10c done; then S10d)
3. **REL-5 (V15).** Rewrite `apps/apis/tests/developmentEncounterCutover.ts` for the room: read room frames, not Convex; a checkpoint barrier before Convex checks; convergence from peer-socket `COMMAND_COMMITTED`; zero Convex calls per command. Then run `scripts/runLocalConvexProof.ps1 -Proof v15-workload` and the six browsers, and feed `v15Budgets.mjs`. Also: a paced out-of-combat measurement; per-document sizes of checkpoint writes; unit costs plus a session estimate whose assumptions the user sets; set N (30–120 s); wire the budget check into `validatePreStagingLocal.mjs`.
4. **REL-4.** Local reset, seed and `convex deploy` (codegen does not deploy). Fix `seed:srd:convex:local` on Docker. Run the Scene authoring, lifecycle and Drafts movement dev scripts, then the journeys.
5. **Carried items:** worker and native "uncaught exception" logs on injected failures; `typecheck:config` failing at `tests/live-backend/encounterMovement.ts:589`; fog staging cap and sweep; D84 cost recheck; small cleanups (`automaticMovementResponse` import, `uninterruptedMovement` parameter, `nativeCaptureCache` naming, `readChecksum`, departed-Character cached rows).
6. **After measurement:** decide cadence, patch versus replace, and document splits from the numbers; implement the D85 timeline discard; decide on merging per-panel sockets from the meter's sockets-per-member counts.

**Later:** VS-9 (final local proof), then VS-10 (staging and production; needs approval). RUL-9 slices are Phase 8.3 scope.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
