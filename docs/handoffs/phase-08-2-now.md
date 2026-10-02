# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after A35-S6c3).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger with the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json). Slice IDs below are registry IDs. To update: change the slice states (and `queue`) in the registry, write the script's `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` with `path` fetches both).
- **Slice start:** before any slice work, set the slice `active` in the registry and republish the dashboard.
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the slice registry and republish the dashboard;
  - stop every background shell and agent this session started (`TaskStop` each ID; check that none are still running, including ones that seemed to finish or were killed with `pkill`);
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate26e is the last used; `vt.ps1 -Files` takes one comma-joined string; `wt.ps1 -Globs` matches only `apps/session-worker/src`, so run `test/` suites with the worker's own vitest config from `apps/session-worker`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (integrating)

**A35-S6c3 The switch, part 3** (R06, [D78](phase-08-2-decisions.md) and its S6c3 rulings). State: integrating. Gate26e is clean (build, codegen, typecheck, typecheck-web).

- **Deleted:** the per-command Convex path. `LIVE_SESSION_ROUTE_PATHS` keeps 14 routes (capture, hydrate, room authorization and inputs, bootstrap, activate, storage recovery, checkpoint and its stage/part/commit, present, begin-drain, release). 42 Convex modules went, along with the external-commit record (the journal drops `durable_external_commit` on open), the publish endpoint, fast-only undo, the S5 parity test, the Convex-first harness helpers, the Cleaving planner variant, the Convex-first turn tests (user-approved), and the dead mutation read memo (`memoizedInternalMutation`, `memoizeMutationReads`, `beforeWrite`).
- **Moved:** the three unbound tests now run room-natively in `liveSessions/roomSceneCommands.test.ts` (`commitSceneInRoom`). The D43 test was rechecked and still proves its title.
- **Docs:** [live-sessions.md](../architecture/live-sessions.md) labels the deleted path historical (the full rewrite is A35-S9); rules-runtime.md and persistence.md are updated. In the ledger, R06.1 and R06.2 no longer list the deletion as missing, and the citations of deleted or renamed tests are marked.
- **Focused runs:** Convex suites 12+10 files green; worker `test/` 108 tests green. Worker `src` reds:
  - known: roomInputs (2), roomEncounterTurns;
  - newly listed but predating this slice (none of its inputs changed): `roomEncounterTurnCapture` 'admits native turn scopes…' fails because the observed revisions are fewer than 3.
- **Must fix before REL-4 (room defects, D78; not fixed here):**
  - a detached unassigned maintained-effect owner is refused (`movementMaintenanceCharacters`, one `movementMaintenance` test);
  - tied-initiative choices rewrite the whole pending-snapshot base (`encounterWriteSets` 100-actor budget).
- **Coverage gap:** no test now asserts directly that private and table enemy rolls take the room path. Room-path tests cover it only indirectly.

Follow-ups carried forward:

- **For TST-0:** the unused import in `automaticMovementResponse.test.ts` and the unused parameter in `uninterruptedMovement.test.ts`; the `nativeCaptureCache.ts` name now describes no cache.
- **Earlier slices:** A35-S6c2 at `5ec64a2bb`; A35-S6c1 at `ec27f4ea0`; A35-S5 at `6cc8b3b30`; A35-S7b at `55165f7ea`; A35-S6b and A35-S3b at `2a96c51f8`.

## Current slice

**A36-S10 Room loads content from snapshots** (R06, V15). It comes before the S9 budgets, so S9 measures the real load path. Start from the A36 rows in [adr-0035-implementation-plan.md](adr-0035-implementation-plan.md) and the registry entry.

## Next slices

The registry `queue` holds the order (user-approved 2026-10-01): A35-S3c packed Scene history (Scene-scoped ledgers per D77; now also builds the Scene cache from the room store, D78 S6c3 ruling), TST-6 and TST-0 (before REL-4's full runs), A35-S9 budgets (and the live-sessions.md rewrite), CP-S6i rule-roll chat cards, PLT-5 (D75 web hosting; staging deploy needs approval), TST-4, TST-5 and A36-F1 (small; may share a session), then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its 11 slices are Phase 8.3 scope (ADR 0034, launch-gating) and gate closed beta (user, 2026-10-01).

**Not scheduled:** none. The registry and dashboard track dev work only; the crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
