# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-02 (after the vertical re-cut, D80).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv (burn-up, slice board, gates → cases → criteria). It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger, the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json) and a burn-up history from the ledger's git log. To update: change slice states in the registry, write the `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` the URL, Read the saved page whole, then `read` with `path` for `index.html`).
- **Slices (D80):** the queue is ten vertical slices, VS-1 to VS-10. Each names the criteria it closes and the older slices it finishes (`includes`). A slice is done when its criteria are READY_FOR_ACCEPTANCE with a focused proof; the slices it includes become done with it. The script refuses an open criterion without exactly one open owner.
- **Slice start:** set the slice `active` in the registry and republish the dashboard before any slice work.
- **One slice per session.** At the boundary:
  - commit;
  - rewrite this file;
  - update the registry (the slice and its `includes` to `done`) and republish the dashboard;
  - stop every background shell and agent this session started;
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, then a compile gate (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate33 is the last used; the gate takes the validation lock itself; `vt.ps1 -Files` takes one comma-joined string; `wt.ps1 -Globs` matches only `apps/session-worker/src`, so run `test/` suites with the worker's own vitest config). Then run the focused proofs for the slice's criteria. Full suites run once, in VS-8.

## Last slice

**Vertical re-cut** (D80; user-approved 2026-10-02). It made three changes:
- The registry gained the `VS` stream and the `criteria`/`includes` fields, and the script validates them.
- The script's `--json` output now includes `history`.
- The dashboard was rebuilt.

R05.2 and R09.1 were reworded to carry D75's checks, with no denominator change.

## Current slice

**VS-1 Scene history** (closes V05.1–5, V07.1, V14.2; finishes A35-S3a, S3c0, S3c1, S3c2, S3c3). Do S3c2 first, then S3c3. Read D77, D79 and D80 in [the decisions](phase-08-2-decisions.md) and the D77 mentions in `docs/architecture/live-sessions.md` first.

- **S3c2:** Scene-scoped ledgers with indexed headers. Room hydration, retention and Campaign deletion run on them.
- **S3c3:** the room builds its Scene cache from its store (D78).
- **Hot path:** add a focused hydration row and byte budget test.
- **V14.2 re-proof (room path):** a stale same-Scene move is refused, and concurrent writes in two Campaigns' rooms both commit.
- **Carried from S3c1:**
  - Dev scripts read Convex right after room commits, before any checkpoint (`developmentSceneAuthoring` `verifyState`, version assertions).
  - The lifecycle script no longer covers Campaign deletion of Scene rows.
  - Room authority may still be held when deletion runs.
- **Carried from S3c0:**
  - Each inline edit scans every `ROOM_SCENE_DEFINITION_ENTITY` record.
  - Expired fog staging is swept only on the next begin.
  - No test covers the 512 KiB staging cap.

## Next slices

Notes carried into later slices:
- **VS-2 (movement and passage):** fix the detached unassigned maintained-effect owner refusal (`movementMaintenanceCharacters`).
- **VS-3 (Encounter decisions):**
  - Fix the tied-initiative pending-snapshot base rewrite (`encounterWriteSets` 100-actor budget).
  - No direct test covers private and table enemy rolls taking the room path.
- **VS-6 (Builder budgets):** run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026).
- **VS-8 (V15 and full suites):**
  - Fix the date-dependent worker reds: `roomCheckpoints` "trims a journal page…" and `roomPrivateRolls` "keeps twenty private rolls…".
  - Fix the unused import in `automaticMovementResponse.test.ts` and the unused parameter in `uninterruptedMovement.test.ts`; rename the misnamed `nativeCaptureCache.ts`.
  - Remove the unused `readChecksum` in the Encounter capture protocol.
  - The local Docker Convex database starts in about 10 minutes, and a fresh volume needs the user to re-enter env secrets.
- **VS-7 and VS-10:** VS-7 is code only. The edge rules and staging deploy are in VS-10, which needs approval.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its 11 slices are Phase 8.3 scope (ADR 0034) and gate closed beta. The crowdfunding plan lives in [future-enhancements.md](../roadmap/future-enhancements.md#crowdfunding-campaign-user-direction-2026-09-28).

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
