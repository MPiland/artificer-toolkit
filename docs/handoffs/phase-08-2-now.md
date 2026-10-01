# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01 (after A35-S5).

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
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate21 is the last used). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**A35-S5 Room/Convex parity** (R06, [D77](phase-08-2-decisions.md)). State: done. Gate21 is clean. D77 re-scoped S5 to a differential test, because the room already commits natively, and moved A35-S3c (packed Scene history) after S6c.

- **Test:** `apps/apis/convex/liveSessions/roomConvexParity.test.ts` (9/9) with `apps/apis/tests/fixtures/roomConvexParity.ts`. Each scenario pages the Convex room inputs into a `RoomEncounterStore` over node SQLite, then runs the same commands through the Convex-first path and `executeRoomEncounterCommand`. After each command it compares the result, the logical Encounter documents and the authorization play JSON. No divergences.
- **Covered:** GM tools, START with Assisted initiative evidence, turns, RESOLVE_ACTION (fixed, ATTACK, SAVE), basic actions, private enemy rolls, prompted d20 resolve and void, REVERT, REORDER, REINFORCE, REMOVE_ACTOR, COMPLETE, Disarm and refusals.
- **Not covered:** Concentration, Cleaving, REPLACE_CREATURE_EQUIPMENT and Scene commands. Character play is compared only through the authorization play JSON.
- **Fixture note:** the room's content snapshot builder needs one ATTACK roll per attacking feature, and the raw SRD wolf has none, so START imports `companionCreature('ATTACK')` (now exported from `tests/fixtures/playerControl.ts`).
- **Lifetime:** S6c deletes this test and its fixture along with the Convex comparators.

Follow-ups carried forward:

- **From A35-S7b:** see this file at `55165f7ea`. That covers the frozen-then-deleted actor gap, the REL-4 room tests for deletion and reconcile, the S7a `delta: null` freeze receipt and the two stale Worker `src/roomInputs.test.ts` cases.
- **From A35-S6b and A35-S3b:** see this file at `2a96c51f8`.

## Current slice

**A35-S6c The switch** (R06, V08, V13, V14; approved for Opus). ACTIVE Runs become fully room-authoritative and the per-command Convex path is deleted: `liveSessions` comparator routes, `executeInRoom`, the Convex-first Encounter and Scene writers (including `sceneLiveCommands` per-command writes), the S6b carry-overs (Convex movement stage, preview Scene cache), and the S5 parity test. See the S6 row in [adr-0035-implementation-plan.md](adr-0035-implementation-plan.md) and the R06.1 "missing" proof line in the acceptance ledger.

## Next slices

The registry `queue` holds the order: A35-S3c packed Scene history (Scene-scoped ledgers per D77), A35-S9 budgets, then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**Not scheduled (needs your call):** CP-S6i rule-roll chat cards, A35-S8c room-planned evidence rolls, A36-S10 room content from snapshots, A36-F1, RUL-9, TST-0/4/5/6, PLT-5 (D75 web hosting), PLT-6.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
