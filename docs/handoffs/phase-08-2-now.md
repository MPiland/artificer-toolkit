# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01 (after A35-S6c1).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger with the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json). Slice IDs below are registry IDs. To update: change the slice states (and `queue`) in the registry, write the script's `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` with `path` fetches both).
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the slice registry and republish the dashboard;
  - stop every background shell and agent this session started (`TaskStop` each ID; check that none are still running, including ones that seemed to finish or were killed with `pkill`);
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate24 is the last used). The full test suites and end-to-end runs come once all known code is written.

## Last slice (integrating)

**A35-S6c1 The switch, part 1** (R06, V14, [D78](phase-08-2-decisions.md) and its S6c1 rulings). State: integrating; the remaining reds go to REL-4. Gate24 is clean (build, codegen, typecheck, typecheck-web).

- **Room-native:** every ACTIVE-Run Encounter command commits in room SQLite. Evidence and table rolls go through `insertTableRoll` with a D72 TABLE charge, `UPDATE_ACTOR` + `characterCommand` through the held Sheet, and unowned decisions through `refuseUnroutedEncounterDecision`. A PREPARED Run refuses the Sheet bridge with "Make this change from the Character Sheet."
- **Harness:** `apps/apis/tests/fixtures/liveSessionWorker.ts` runs commands room-natively and flushes them through checkpoints. It mirrors the durable journal: same commandId replays, a fresh commandId gives VERSION_STALE, mismatched reuse gives INVALID_COMMAND.
- **Fixes:**
  - One ACTIVE Run per Campaign: the room input carries `activeEncounterId`, the room refuses START with ACTIVE_ENCOUNTER_EXISTS, and checkpoint ingestion refuses a second ACTIVE Run.
  - Replay is byte-identical.
  - The new private RUN input `maintenanceCharacterOwners` lets turn capture read detached maintained-effect owners ([live-sessions.md](../architecture/live-sessions.md)).
- **Known reds, deferred to REL-4:**
  - Worker: roomCheckpoints, roomEncounterTurns, roomInputs (2), roomEncounterTurnCapture, roomPrivateRolls. roomPrivateRolls is still red with HEAD's input files, so this slice didn't cause it.
  - Convex: the checkpoint activeHostedCampaigns test.
  - The Cleaving "planner" variant, which S6c3 deletes.
  - One cold-start 5 s timeout in the nativeLiveSessionRoom door test; it passed on re-run.

Follow-ups carried forward:

- **Detached owners:** other dependent-read paths (actor removal, Concentration cleanup) may miss a detached Character owner after a re-hydrate. An unassigned or deleted detached owner now refuses turn capture; Convex never checked assignment. Check both in S6c2 or REL-4.
- **From A35-S5:** see this file at `6cc8b3b30`. From A35-S7b: at `55165f7ea`. From A35-S6b and A35-S3b: at `2a96c51f8`.

## Current slice

**A35-S6c2 The switch, part 2** (R06, V08, D78). Build the room movement harness and move the movement tests off the Convex-first commit. Then make actor-token binding a room command and fence `actorTokenBindings.execute` for ACTIVE Runs. S6c3 then deletes the per-command Convex path; see the S6 row in [adr-0035-implementation-plan.md](adr-0035-implementation-plan.md) and the R06.1 "missing" proof line.

## Next slices

The registry `queue` holds the order (user-approved 2026-10-01): A35-S6c3, A36-S10 room content from snapshots (before budgets, so S9 measures the real load path), A35-S3c packed Scene history (Scene-scoped ledgers per D77), TST-6 and TST-0 (after S6c3's test deletions, before REL-4's full runs), A35-S9 budgets, CP-S6i rule-roll chat cards, PLT-5 (D75 web hosting; staging deploy needs approval), TST-4, TST-5 and A36-F1 (small; may share a session), then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). None of its 11 slices blocks 8.2 promotion; they are Phase 8.3 scope (ADR 0034, launch-gating) and seed the 8.3 plan when 8.2 closes. All 11 gate closed beta (user, 2026-10-01).

**Not scheduled:** none. The registry and dashboard track dev work only; the crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28). A35-S8c is superseded (folded into S6c1 by D78).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
