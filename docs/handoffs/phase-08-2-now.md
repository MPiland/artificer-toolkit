# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after A35-S3c1).

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
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate33 is the last used; the gate takes the validation lock itself, so never wrap it in the lock; `vt.ps1 -Files` takes one comma-joined string; `wt.ps1 -Globs` matches only `apps/session-worker/src`, so run `test/` suites with the worker's own vitest config from `apps/session-worker`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (integrating)

**A35-S3c1 Delete the Convex Scene command path** (R06; D79). State: integrating. Gate33 is clean (build, codegen, typecheck, typecheck-web). The focused suites are green: the changed apis tests plus `deletion`, `checkpoint` and `encounters/commands` (207/207), encounter-persistence, and session-worker.

- **Deleted:** Convex `scenes/commands`, `fogCommands`, `fogPublication`, `geometry{Actions,FastCommands,Staging,Commands,Publication,Documents,Reads}`, `measurements`, `undo`, `spatialGeometry`, `sessionVisionComposition` and `developmentProof`. Their only consumers went too: `scenes/sessionVision`, `sessionVisionDocuments`, `characters/sceneVision` and the `checkpoint-scenes` dev proof (`developmentCheckpointScenes`, Convex and schema). `fogReads.layers`/`chunks` remain. `publishSceneUndo` lost its `fastOnly` mode.
- **Dev scripts:** these now drive the room through `DevelopmentHttpClient`: `executeSceneCommand`, and the new `executeSceneFog`, which runs begin, one-chunk appends and then publish. The lifecycle contention step and `--encounter-cutover` were deleted.
- **Ledger:** V14.2 is back to IN_PROGRESS. Its contention proofs drove the deleted writers, so a room-path re-proof is owed: a same-Scene stale move must be refused, and concurrent writes in two Campaigns' rooms must both commit. The fake `checkpointRecords.test.ts` citation now points at real `checkpoint.test.ts` and `encounters/commands.test.ts` cases.
- **REL-4 risks:**
  - Dev scripts read Convex right after room commits, before any checkpoint (`developmentSceneAuthoring` `verifyState`, version assertions).
  - The lifecycle script no longer exercises Campaign deletion of Scene rows.
  - Room authority may still be held when deletion runs.
- **Pre-existing fix:** the `checkpoint.test.ts` "merges private checkpoint rolls…" case needed a `PRO_GM` entitlement after the 2026-09-27 tier change.

**A35-S3c0** (integrating): GM Scene editing goes through the room. For A35-S9: each inline edit scans every `ROOM_SCENE_DEFINITION_ENTITY` record. Expired fog staging is swept only on the next begin. No test covers the 512 KiB staging cap. Worker `src` has 2 likely date-dependent reds (`roomCheckpoints` "trims a journal page…", `roomPrivateRolls` "keeps twenty private rolls…") for TST-0.

**A36-S10** (integrating, `bd0125977`): the room loads Character content from verified snapshots. REL-4 must run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026). For A35-S9: the Encounter capture protocol still carries an unused `readChecksum`.

**A35-S6c3** (integrating, `e3f51905a`) left room defects that must be fixed before REL-4 (D78):

- a detached unassigned maintained-effect owner is refused (`movementMaintenanceCharacters`);
- tied-initiative choices rewrite the whole pending-snapshot base (`encounterWriteSets` 100-actor budget).

Coverage gap: no direct test that private and table enemy rolls take the room path.

Follow-ups for TST-0: the unused import in `automaticMovementResponse.test.ts` and the unused parameter in `uninterruptedMovement.test.ts`; `nativeCaptureCache.ts` is misnamed. The local Docker Convex database still starts slowly (about 10 minutes); a fresh volume needs the user to re-enter env secrets.

Earlier slices: A35-S3c0 `0a19e6476`; A36-S10 `bd0125977`; A35-S6c3 `e3f51905a`; A35-S6c2 `5ec64a2bb`; A35-S6c1 `ec27f4ea0`; A35-S5 `6cc8b3b30`.

## Current slice

**A35-S3c2 Packed Scene history** (V05, V07; D70, D77, D79). Scene-scoped ledgers with indexed headers; room hydration, retention and Campaign deletion run on them. Then comes S3c3 (Scene cache from the room store, D78). Read D77 in the acceptance ledger's decisions and its mentions in `docs/architecture/live-sessions.md` first.

## Next slices

The registry `queue` holds the order (user-approved 2026-10-01): TST-6 and TST-0 (before REL-4's full runs), A35-S9 budgets (and the live-sessions.md rewrite), CP-S6i rule-roll chat cards, PLT-5 (D75 web hosting; staging deploy needs approval), TST-4, TST-5 and A36-F1 (small; may share a session), then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its 11 slices are Phase 8.3 scope (ADR 0034, launch-gating) and gate closed beta (user, 2026-10-01).

**Not scheduled:** none. The registry and dashboard track dev work only; the crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
