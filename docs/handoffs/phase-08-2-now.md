# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after A35-S6c2).

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
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate25b is the last used; `vt.ps1 -Files` takes one comma-joined string, `wt.ps1 -Globs` runs worker tests). The full test suites and end-to-end runs come once all known code is written.

## Last slice (integrating)

**A35-S6c2 The switch, part 2** (R06, V08, [D78](phase-08-2-decisions.md) and its S6c2 rulings). State: integrating. Gate25b is clean (build, codegen, typecheck, typecheck-web).

- **Movement harness:** `planMovementInRoom` / `planMovementDecisionInRoom` in `apps/apis/tests/fixtures/liveSessionWorker.ts` commit in room SQLite and return a single-use `publish` checkpoint. About 40 movement, turn and Encounter suites moved onto it; Convex-first subjects were deleted (listed in D78's S6c2 rulings).
- **Binding:** actor-token binding is a room command on the presented Scene; Convex `encounters/actorTokenBindings:execute` refuses a room-held Run ([transport.md](../architecture/transport.md)).
- **Fixes:** checkpoint keys accept occurrence version 0; a fresh answer to a settled movement decision is VERSION_STALE in the room.
- **Affected run:** 102 apis suites plus the touched worker suites. Remaining reds:
  - **Must fix before REL-4 (room defects, D78):** a detached unassigned maintained-effect owner is refused (`movementMaintenanceCharacters`, one `movementMaintenance` test); tied-initiative choices rewrite the whole pending-snapshot base (`encounterWriteSets` 100-actor budget, 17 MB against 2 MB).
  - Unchanged from S6c1: worker roomCheckpoints, roomEncounterTurns, roomInputs (2), roomPrivateRolls; the Cleaving "planner" variant (S6c3 deletes it); Convex checkpoint activeHostedCampaigns.

Follow-ups carried forward:

- **Detached owners:** the defect above; also check actor removal and Concentration cleanup reads after a re-hydrate.
- **Earlier slices:** A35-S6c1 at `ec27f4ea0`; A35-S5 at `6cc8b3b30`; A35-S7b at `55165f7ea`; A35-S6b and A35-S3b at `2a96c51f8` (this file at each).

## Current slice

**A35-S6c3 The switch, part 3** (R06, D78). Delete the per-command Convex path: routes, commit modules, Scene cache hydrate, external commit (after a room-native unbound geometry harness replaces the three unbound `externalCommit` tests), the harness's Convex-first helpers, the S5 parity test and the Cleaving planner variant; recheck the D43 test. Then docs and acceptance (R06.1 and R06.2 "missing" lines). Fix the two room defects here if they fit, else first in REL-4. See the S6 row in [adr-0035-implementation-plan.md](adr-0035-implementation-plan.md).

## Next slices

The registry `queue` holds the order (user-approved 2026-10-01): A36-S10 room content from snapshots (before budgets, so S9 measures the real load path), A35-S3c packed Scene history (Scene-scoped ledgers per D77), TST-6 and TST-0 (after S6c3's test deletions, before REL-4's full runs), A35-S9 budgets, CP-S6i rule-roll chat cards, PLT-5 (D75 web hosting; staging deploy needs approval), TST-4, TST-5 and A36-F1 (small; may share a session), then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). None of its 11 slices blocks 8.2 promotion; they are Phase 8.3 scope (ADR 0034, launch-gating) and seed the 8.3 plan when 8.2 closes. All 11 gate closed beta (user, 2026-10-01).

**Not scheduled:** none. The registry and dashboard track dev work only; the crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28). A35-S8c is superseded (folded into S6c1 by D78).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
