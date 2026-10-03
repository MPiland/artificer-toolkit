# Phase 8.2 — now

> The resume point for a fresh session. Read this first, then only the sections it links. Keep it under about 60 lines; rewrite it at every slice boundary.
>
> Updated: 2026-10-03 (after VS-5).

## Where we are

- **Branch:** `codex/phase-08-2-convex-cutover`. The user's `.agents/` deletions are intentional; leave them unstaged.
- **Acceptance:** 50/75 cases and 190/277 criteria accepted; 71 criteria READY_FOR_ACCEPTANCE (`node scripts/acceptanceProgress.mjs`).
- **Dashboard:** https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv. It renders `node scripts/acceptanceProgress.mjs --json`, which joins the acceptance ledger, the work-slice registry [08-2-work-slices.json](../roadmap/08-2-work-slices.json) and a burn-up history from git.
  - To update it, change slice states in the registry and write the `--json` output to `data.json` in the session scratchpad.
  - Then list the Artifact's files (`scope: files`) and publish with `files: {"data.json": <scratchpad>/data.json}`.
- **Slices (D80):** a slice is done when its criteria are READY_FOR_ACCEPTANCE with a focused proof. Active slices may run in parallel only when they close disjoint cases. Done slices leave the `queue`.
- **Slice start:** set the slice `active` in the registry and republish the dashboard before any slice work.
- **One slice per session.** At the boundary:
  - commit;
  - rewrite this file;
  - set the slice and its `includes` to `done` and remove it from the queue;
  - republish the dashboard;
  - stop every background shell and agent;
  - give the user the `/clear` line: "Continue Phase 8.2 from docs/handoffs/phase-08-2-now.md."
- **Working rhythm:** code first, then the compile gate.
  - The gate is `local-validation/codex-batch/gate.ps1 -Name <gateN>`; gate69 is the last one used. It takes the validation lock itself.
  - Then run the focused proofs. Worker `src` tests run from the root with `yarn vitest run --config vitest.config.ts <file>`; `local-validation/codex-batch/nt.ps1` runs the native suite. Full suites run once, in VS-8.
- **Docker:** agents may start Docker Desktop and the `phase82-convex-local-linux` container ([AGENTS.md](../../AGENTS.md)).
- **Product rules:** apply recorded decisions to the exact trigger they name. D81 (leaving a Campaign) and D82 (leaving a Run) differ; ask one precise question when a case only resembles a decision.

## Last slice

**VS-5 Chat and rolls through the room, with chat cards for automatic rule rolls** is done: P14.5 and P06.5 moved to READY, and the P06.4 and V11.4–V11.10 proofs were re-checked. It finishes A35-S8a and CP-S6i.
- **D83 (new):** the GM's Blind roll is removed. GM rolls are Public or Private only (ADR 0034 amended, Q14 confirmed). The toggle is a server profile preference, `gmRollVisibility`, which defaults to PUBLIC and is re-input to the room. It sits in GM chat, the Sheet roller, the action and decision drawers and the enemy card.
- **Rule-roll cards:** every automatic attack, save, check, initiative and damage roll posts a card (`encounter-persistence/ruleRollCards.ts`). The audience rule: a hidden actor's card is PRIVATE; otherwise a non-owner controller's is TABLE; otherwise the GM's toggle decides. Room-written cards fan out in the same commit.
- **Reveals:** under authority, private rolls and reveals (`EXECUTE_PRIVATE_ROLL`, `REVEAL_ROLL` FULL|NOTICE) go through the room, and Convex fences them. Each reveal mode works once per roll.
- **Known limits** (live-sessions.md, "GM roll visibility and reveals"):
  - damage cards show the requested total, before resistance or halving, with no faces; the faces are persisted per die, so they can be added later;
  - initiative rolled at Encounter start has no dice and posts no card;
  - while the room holds authority, a reveal of a roll retained before the table started is refused.
- **Proofs:** see P06.5 and P14.5 in the ledger. V11.4's stale `turnActiveEffects` citation now points to `encounterTurnEffects.test.ts`.
- **Local data:** reset and reseeded. The backup is `local-validation/convex-reset/vs5-gm-roll-visibility.before.zip`; delete it once VS-6 runs green.

## Next slice

**VS-6 (Builder budgets)** (see the registry): run `contentSnapshots/migrations:rebuild` after starting the local R2 fixture (port 8026).

## Later slices

- **VS-8 (V15 and full suites):**
  - Seven apis tests are red and unexplained. None is in VS-4 code; `sheetCommands` was red before VS-4.
    - `sheetCommands`, `sheetAdjustments`, `sheetResources`: the rollback spies on `projectCharacterSheetBundle`; the mutation resolves.
    - `currencyDeparture`: 3 tests; the fixture can no longer store an invalid amount.
    - `builderSnapshotParity`: a new "Cantrip requires 1 selection" issue.
  - `seed:srd:convex:local` fails on the Docker backend (`--deployment local`). Use `convex run content/seed:seed --url http://127.0.0.1:3210` with an in-memory admin key, and fix the script.
  - The worker suite logs "uncaught exception … RoomCheckpoints.#flush" when checkpoint failures are injected, and the native suites log "uncaught exception … LiveSessionRouteError". Check that production handles those rejections.
  - The Cutover V15 workload (`developmentEncounterCutover.ts`) reads Convex without waiting for a checkpoint.
  - Run the Scene authoring, lifecycle and Drafts movement dev scripts; they are changed but not yet run.
  - Fog: the per-account staging cap (512 KB) is unreachable; the final hydration page has no row budget; expired staging is swept only on the next begin.
  - Small cleanups: the unused import in `automaticMovementResponse.test.ts`; the unused parameter in `uninterruptedMovement.test.ts`; rename `nativeCaptureCache.ts`; the unused `readChecksum`; the room's stale cached rows for departed Characters (filtered, not evicted).
- **VS-10:** edge rules and the staging deploy; needs approval.

**RUL-9** (pre-beta rules audit) is done: [rul-9-rules-audit.md](rul-9-rules-audit.md). Its slices are Phase 8.3 scope (ADR 0034) and gate closed beta.

## Open questions

See [phase-08-2-open-questions.md](phase-08-2-open-questions.md). It is short, so read it whole.
