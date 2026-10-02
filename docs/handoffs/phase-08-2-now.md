# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after A36-S10).

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
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate28 is the last used; the gate takes the validation lock itself, so never wrap it in the lock; `vt.ps1 -Files` takes one comma-joined string; `wt.ps1 -Globs` matches only `apps/session-worker/src`, so run `test/` suites with the worker's own vitest config from `apps/session-worker`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (integrating)

**A36-S10 Room loads content from snapshots** (R06, V15) at `bd0125977`. State: integrating. Gate28 is clean (build, codegen, typecheck, typecheck-web).

- **Changed:** `prepareLiveCharacterSheetFacts` (`apps/session-worker/src/nativeCharacterRules.ts`) prepares from the stored inputs plus the room's verified snapshot objects through `createSnapshotReaders`. `roomCharacterRules.ts` authorizes each object's scope against the manifest (CAMPAIGN = the Campaign, SOURCE in `sources`). Declared spells pin from the documents `versions` arrays. The Character source-capture request/response contracts are deleted from `liveSessionCharacterRules.ts`.
- **Known differences from the deleted path:** no 500-root bound, and the snapshot build's Campaign parent-share rule is trusted. The local end-to-end proof belongs to REL-4.
- **Docs:** ADR 0036 status, live-sessions.md, rules-runtime.md, the cutover handoff and [adr-0036-implementation-plan.md](adr-0036-implementation-plan.md). No ledger criteria changed.
- **Focused runs:** worker `test/` 192 tests green; worker `src` 84 green, plus the 4 known reds (roomInputs 2, roomEncounterTurns, `roomEncounterTurnCapture` 'admits native turn scopes…').
- **Local backend:** the Docker Convex database had grown to 3.9 GB of history and hung at startup under the 7.35 GiB Docker limit. Its tables were reset (live data was 2.6 MB) and the SRD reseeded (1,057 subjects, audit matched). Startup still takes about 10 minutes because the file keeps its history; a fresh volume would fix that but needs the deployment env secrets re-entered by the user. Content snapshot heads are unbuilt: builds fail without the in-memory local R2 fixture (port 8026, `scripts/localConvexFixtures.ps1`), and after 5 retries a head waits for the next content change. The proof scripts start the fixture but never rebuild, and every fixture restart discards the objects, so REL-4 must run `contentSnapshots/migrations:rebuild` after starting the fixture (or make the proof scripts do it). The seed's `contentSnapshotHeads` write conflicts are harmless retries.
- **For A35-S9:** the Encounter capture protocol (`liveSessionEncounterRules`, `readRoomEncounterTurnCapture`, `nativeCaptureCache`) still carries an unused `readChecksum`, and its revisions echo `observed`.

**A35-S6c3** (integrating, `e3f51905a`) deleted the per-command Convex path. It left:

- **Must fix before REL-4 (room defects, D78; not fixed here):**
  - a detached unassigned maintained-effect owner is refused (`movementMaintenanceCharacters`, one `movementMaintenance` test);
  - tied-initiative choices rewrite the whole pending-snapshot base (`encounterWriteSets` 100-actor budget).
- **Coverage gap:** no test now asserts directly that private and table enemy rolls take the room path. Room-path tests cover it only indirectly.

Follow-ups carried forward:

- **For TST-0:** the unused import in `automaticMovementResponse.test.ts` and the unused parameter in `uninterruptedMovement.test.ts`; the `nativeCaptureCache.ts` name now describes no cache.
- **Earlier slices:** A35-S6c3 at `e3f51905a`; A35-S6c2 at `5ec64a2bb`; A35-S6c1 at `ec27f4ea0`; A35-S5 at `6cc8b3b30`; A35-S7b at `55165f7ea`; A35-S6b and A35-S3b at `2a96c51f8`.

## Current slice

**A35-S3c Packed Scene history**: Scene-scoped ledgers per D77. It now also builds the Scene cache from the room store (D78 S6c3 ruling). Start from the A35 rows in [adr-0035-implementation-plan.md](adr-0035-implementation-plan.md) and the registry entry.

## Next slices

The registry `queue` holds the order (user-approved 2026-10-01): TST-6 and TST-0 (before REL-4's full runs), A35-S9 budgets (and the live-sessions.md rewrite), CP-S6i rule-roll chat cards, PLT-5 (D75 web hosting; staging deploy needs approval), TST-4, TST-5 and A36-F1 (small; may share a session), then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its 11 slices are Phase 8.3 scope (ADR 0034, launch-gating) and gate closed beta (user, 2026-10-01).

**Not scheduled:** none. The registry and dashboard track dev work only; the crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
