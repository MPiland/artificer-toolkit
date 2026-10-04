# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-03 (VS-8 in progress; D86 and D87 recorded; next is A35-S10a, with PLT-6 in parallel).

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

**Done:**
- the Convex command endpoint is deleted;
- A35-S6d (room pushes `ENCOUNTER_SESSION`), A35-S6e (room answers `ENCOUNTER_READ`) and A35-S9 (checkpoint `reason` and I/O, the dev room meter at `GET /internal/live-sessions/meter/<campaignId>`, `scripts/v15Budgets.mjs`);
- TST-0 and TST-6.

REL-5 is paused: V15 runs a9–a11 failed (a reactor player never got MOVEMENT_REACTION).

**Decided (product owner, [decisions log](phase-08-2-decisions.md)):**
- **D85:** measure before reshaping checkpoints; the turn timeline need not outlive the Run; losing up to one round on a rare DO storage loss is acceptable.
- **D86:** write-behind flush, and live views read the room ([ADR 0035 D86](../adr/0035-room-authoritative-live-encounters.md#d86-write-behind-state-flush-live-views-read-the-room--2026-10-03), [slice plan](adr-0035-implementation-plan.md#write-behind-flush-slices-d86)). Order: A35-S10a → S10d, then REL-5 sets N. This supersedes item 6 below.
- **D87:** Campaign content is hidden from players until the GM reveals it. VS-11 is queued after VS-8:
  - PLT-6: read gates, and Campaign Files removed;
  - PLT-7: private and shared notes;
  - PLT-8: Show to players.

  VS-11 may run alongside the D86 slices.
- **V15 session model (product owner):** 5-hour sessions, 4 fights of 8 rounds, 5 players and a GM, weekly play; assume 6 enemies and about 3 hours of combat. REL-5 measures one group and extrapolates; group counts are checked in testing.

**Next session starts here**
- **A35-S10a (delta-sized flushes):**
  1. First, find what makes up today's ~250 KB per-checkpoint read floor (the meter and the checkpoint `reason` I/O from A35-S9).
  2. Then brief Sonnet.
  3. Escalate only if a part of the floor turns out to be needed for correctness.
- **PLT-6 (in parallel):** a second Sonnet agent; its files don't overlap S10a's. Known leaks:
  - `encounters/projectionReads.ts:44` (Campaign authority only, so any Encounter state);
  - `encounters/runs.ts:133,166` (`public: true`);
  - `campaigns/attachments.ts` `list` (membership only).

  Campaign Files removal touches `campaignAttachments` in `attachments.ts`, `attachmentDocuments.ts`, `notebooks.ts:161-168`, `deletionState.ts`, `developmentLifecycle.ts`, `developmentAccountDeletion.ts`, `lib/mutations.ts`, `media/{fileActions,assets,accountRetention.helper}.ts`, `encounters/developmentCampaign.ts`, `campaigns/schema.ts`, the media profiles `CAMPAIGN_FILE` and `CAMPAIGN_HANDOUT_MAP`, and the web `domains/campaigns/components/CampaignFiles/*`. Add VS-11 acceptance criteria to the ledger when briefing.
- **Uncommitted, kept for REL-5:**
  - the event recorder and driver changes in `apps/apis/tests/development{HttpClient,EncounterScenes,RoomMeasurement,EncounterCutover}.ts`;
  - the second-owner test in `apps/session-worker/test/nativeLiveSessionRoom.test.ts`.

  Commit them once run.

**Remaining, in order** (TST-0 and TST-6 done; then S10a → S10d)
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
