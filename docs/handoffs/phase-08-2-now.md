# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after A35-S3c0).

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
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate30 is the last used; the gate takes the validation lock itself, so never wrap it in the lock; `vt.ps1 -Files` takes one comma-joined string; `wt.ps1 -Globs` matches only `apps/session-worker/src`, so run `test/` suites with the worker's own vitest config from `apps/session-worker`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (integrating)

**A35-S3c0 GM Scene editing through the room** (R06, V07; D79, user ruling 2026-10-02). State: integrating. Gate30 is clean (build, codegen, typecheck, typecheck-web).

- **Changed:** the room accepts every presented-Scene command. INLINE edits go through `publishRoomSceneInline` (`roomSceneEdits.ts`), using the shared planner `packages/encounter-persistence/src/sceneInlineCommand.ts` ported from Convex `scenes/commands.ts`. Token and barrier upsert/remove go through room geometry with exploration. GM fog painting is staged: `SCENE_FOG_BEGIN` and `SCENE_FOG_APPEND` messages, then the journaled `PUBLISH_SCENE_FOG_PATCH`. The staging (`roomSceneFogUploads.ts`, SQLite) is per epoch and user, holds at most 2 patches and 512 KiB, and expires after 10 minutes. It is never checkpointed. The web `sceneCommand` sends only to the room (`live.sendCommand`, `live.sendSceneFog`).
- **Transitional until S3c1:** Convex `scenes/commands`, `fogCommands`, `geometryActions`/`geometryFastCommands`/staging and `undo` still exist with no tabletop caller, and duplicate the room's logic.
- **For A35-S9:** each inline edit scans every `ROOM_SCENE_DEFINITION_ENTITY` record to find its base entity (the key carries the ordinal, so a direct lookup is impossible). Expired fog staging is swept only on the next begin. No test covers the 512 KiB staging cap or a begin replayed across epochs.
- **Focused runs:** worker `test/` 199/199 (7 new); web `liveSessionClient.test.ts` 16/16. Worker `src` has the 4 known reds plus 2 newly seen ones: `roomCheckpoints` "trims a journal page…" and `roomPrivateRolls` "keeps twenty private rolls…". Both fail when run alone, use fixtures dated 2026-09-30, and import nothing this slice changed, so they look date-dependent; that is not yet confirmed. TST-0 should fix them.

**A36-S10** (integrating, `bd0125977`): the room loads Character content from verified snapshots. REL-4 must run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026). For A35-S9: the Encounter capture protocol still carries an unused `readChecksum`.

**A35-S6c3** (integrating, `e3f51905a`) left room defects that must be fixed before REL-4 (D78):

- a detached unassigned maintained-effect owner is refused (`movementMaintenanceCharacters`);
- tied-initiative choices rewrite the whole pending-snapshot base (`encounterWriteSets` 100-actor budget).

Coverage gap: no direct test that private and table enemy rolls take the room path.

Follow-ups for TST-0: the unused import in `automaticMovementResponse.test.ts` and the unused parameter in `uninterruptedMovement.test.ts`; `nativeCaptureCache.ts` is misnamed. The local Docker Convex database still starts slowly (about 10 minutes); a fresh volume needs the user to re-enter env secrets.

Earlier slices: A36-S10 `bd0125977`; A35-S6c3 `e3f51905a`; A35-S6c2 `5ec64a2bb`; A35-S6c1 `ec27f4ea0`; A35-S5 `6cc8b3b30`.

## Current slice

**A35-S3c1 Delete the Convex Scene command path** (D79). Delete `scenes/commands`, `fogCommands`, `geometryFastCommands`, `geometryActions`, `geometryStaging`, `geometryCommands`, `geometryPublication`, `undo`, and the `commandChunks` reads in `geometryReads`/`fogReads`. Keep `fogReads.layers` and `fogReads.chunks`, which the web uses. Then delete whatever becomes unused transitively, with their tests and `development*` scripts. `local-validation/a35-s3c1/abandoned-deletion.patch` holds an earlier attempt's test ports and the room-harness fixtures (`commitSceneInRoom`, `seedFogLayer`); reuse them. Then come S3c2 (packed Scene ledgers, D77) and S3c3 (Scene cache from the room store, D78).

## Next slices

The registry `queue` holds the order (user-approved 2026-10-01): TST-6 and TST-0 (before REL-4's full runs), A35-S9 budgets (and the live-sessions.md rewrite), CP-S6i rule-roll chat cards, PLT-5 (D75 web hosting; staging deploy needs approval), TST-4, TST-5 and A36-F1 (small; may share a session), then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its 11 slices are Phase 8.3 scope (ADR 0034, launch-gating) and gate closed beta (user, 2026-10-01).

**Not scheduled:** none. The registry and dashboard track dev work only; the crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
