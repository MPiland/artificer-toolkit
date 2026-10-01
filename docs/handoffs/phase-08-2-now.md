# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-01 (after A35-S3b).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. Codex's source-first batch is WIP commit `cce41580d`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria (P14 reopened for room chat) (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger with the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json). Slice IDs below are registry IDs. To update: change the slice states (and `queue`) in the registry, write the script's `--json` output to `data.json` in the session scratchpad, and republish it with the dashboard's `index.html` (Artifact `read` with `path` fetches both).
- **One slice per session:** finish the current slice, then at the boundary:
  - commit;
  - rewrite this file (move the finished slice to "Last slice" and promote the next one);
  - update the slice registry and republish the dashboard;
  - stop every background shell and agent this session started (`TaskStop` each ID; check that none are still running, including ones that seemed to finish or were killed with `pkill`);
  - tell the user it's a good point to `/clear` and give the resume line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, with a compile gate after each slice (`local-validation/codex-batch/gate.ps1 -Name <gateN>`). The full test suites and end-to-end runs come once all known code is written.

## Last slice (done)

**A35-S3b Recovery, clock and DAILY cleanup.** State: integrating. Gate13 clean (builds, local codegen, typechecks, web). The focused Convex tests (clock, deletion, both development lifecycles) pass 34/34. The web CampaignClock tests and oxlint also pass.

- **Bug fixed.** Clock recovery wrote Sheets through Convex, so a boundary crossed during live combat threw on held Characters and rolled the command back.
- **Combat pauses the clock** (user decision; see [decisions](phase-08-2-decisions.md) and [persistence](../architecture/persistence.md)). An `encounterRuns` trigger calls `syncCampaignClockWithCombat` (`campaigns/clockCombat.ts`). It pauses a running clock when a Run turns ACTIVE. When the last Run ends, it resumes only a clock it paused itself (`pausedForCombat`). Any GM start or pause clears the flag.
- **GM prompts for fighters.** A boundary the GM moves past during combat recovers non-fighters as before. Each fighter gets a row in `campaignClockRecoveryPrompts` instead. The GM sees a "Dawn passed during combat · review charges" button by the clock and picks charges per Character. The refresh is sent through the room when the Character is held. Lifecycle cleanup covers the new table.

Follow-ups for the test cycle (REL-4):

- The prompt test uses one Character before and after combat, because the fixture has one player. Add a mixed fighter/non-fighter case, plus web tests for the prompt card and modal (none were run in a browser).
- `recoveryPrompts` collects without a bound (in practice limited by roster × boundaries). Its DTO parse throws on a Character label longer than 100 characters. Each card opens its own live connection while the modal is open.
- The system pause and resume write no command receipt and send no room notification.
- Existing local clock rows lack `pausedForCombat`. Reseed if a read fails.
- Carried: A35-S8b query/notice tests and 5 s outside-room polling (measure in A35-S9). Room suite red before A35-S8a (`nativeLiveSessionRoom.test.ts`, fix first). Older items: see this file at `983ce5488`.

## Current slice

**A35-S6b Retire the remaining Scene paths; author the movement and Sheet input fixtures** (R06, V07). See the [source-first handoff](phase-08-2-claude-source-first.md#remaining-implementation-and-sequence), item 3, second part. Keep the original pending/terminal order, source pins, replay, fog-only Scene advancement and recipient privacy.

## Next slices

The registry `queue` holds the order: A35-S7b held-actor removal on account deletion, A35-S3c packed Scene history, A35-S5 parity, A35-S6c the switch (approved for Opus), A35-S9 budgets, then REL-4 test and fix (integrating slices become done here), REL-5 V15, REL-6 final proof, REL-7 promotion. Small adjacent slices may share a session.

**Not scheduled (needs your call):** CP-S6i rule-roll chat cards, A35-S8c room-planned evidence rolls, A36-S10 room content from snapshots, A36-F1, RUL-9, TST-0/4/5/6, PLT-5 (D75 web hosting), PLT-6.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
