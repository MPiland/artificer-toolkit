# SPELLS-2 handoff: conditions apply their mechanics

**Status:** not started. **Written:** 2026-10-07, to run in parallel with ATTACK-8 in the main session.

## Goal

Deliver PBI SPELLS-2 from the [Phase 8 ledger](../roadmap/08-phase-ledger.json). The AC is SPELLS-2.1: the condition effects (D63) are modeled. Poisoned, Frightened, Prone, Restrained, Paralyzed, Unconscious, Stunned and Petrified apply their auto-fail, advantage-against, speed 0 and critical rules, and exhaustion levels follow.

SPELLS-2 is the main enabler. SPELLS-9, SPELLS-3 (death saves), ATTACK-10 and ATTACK-7 (grapple, Engulf; see D93) depend on it.

## First reads

1. `AGENTS.md` and the working agreement in `~/.claude/CLAUDE.md` (Definition of Done).
2. [rul-9-rules-audit.md](rul-9-rules-audit.md): section "2. Conditions", slice 1, and the note that slice 1 is one typed condition policy table in System content, not per-condition code, following the `ruleState` pattern.
3. D63 and any condition decisions in [phase-08-2-decisions.md](phase-08-2-decisions.md); ADR 0034 (Assisted mode, soft warnings); ADR 0035 (the room is authoritative); [rules-runtime.md](../architecture/rules-runtime.md).

## Design direction

- One authored, System-owned condition policy contract: schema in `packages/schema`, SRD data in `packages/source-data`, evaluation in `packages/rules-runtime`. Any condition can use it, homebrew included. Its rules are:
  - roll-mode contributions: attacks made by and against the creature, ability checks, and saves by ability;
  - save auto-fail by ability;
  - speed set to 0;
  - melee hits from within 5 feet become critical;
  - can't take actions or reactions, reusing the existing capability suppression;
  - exhaustion as leveled, cumulative effects.
- Wire it into the existing roll-mode and contributor folding for attacks, saves and checks, and into movement speed. This applies to Characters and Creatures, in the Session Worker planners.
- Decide contract and persistence changes yourself under the `AGENTS.md` escalation rules. Record them as a new decision, the next free number after D93. If one AC is too coarse, refine it into concrete, testable, vertical ACs in the ledger and tell the user.
- The user is a PM who wants critical pushback and properly designed, authorable mechanics, never per-case band-aids.

## Do not edit (owned by the ATTACK-8 session)

- `packages/rules-runtime/src/encounterActionEconomy*.ts`, `actionEconomyCapabilityRegistry*`, `systems/dnd5e/actionEconomyPolicy.ts`, `encounterActionRuleWarnings.ts`.
- The action-economy section of `apps/session-worker/src/nativeEncounterRules.ts`.
- The Encounter action drawer in `apps/web`.
- SRD class Extra Attack data.

If conditions need a hook in one of these, report it rather than editing.

## Worktree and validation

- Work in your own git worktree and branch, cut from `codex/phase-08-2-convex-cutover`. Do not push or merge; the main session merges.
- `local-validation/` is ignored, so its helper scripts aren't in a worktree. Also, `D:\dev\artificer-toolkit\local-validation\codex-batch\*.ps1` hard-code `Set-Location D:\dev\artificer-toolkit`. Make worktree copies that use your worktree path but keep the lock at the shared absolute path `D:\dev\artificer-toolkit\local-validation\.validation.lock`.
- Follow `AGENTS.md`:
  - Run the TypeScript compiler alone (`$env:GOMAXPROCS='2'`, Turbo `--concurrency=1 --env-mode=loose`), never alongside Vitest.
  - Rebuild `packages/schema`, `packages/rules-runtime` and `packages/encounter-persistence` `dist` before tests that import them.
  - Run a local codegen push for Convex changes.
- Use only the local Docker Convex backend. Avoid live-backend runs; batch them for later.

## Done

- The SPELLS-2 ACs are DONE with proof in the ledger:
  - real-code unit tests in `packages/rules-runtime` for each condition rule;
  - a regression test that fails before each fix;
  - at least one end-to-end journey that proves a condition changes a real room-resolved attack (`journeyStatus: verified`).
- The affected regression tests are run: rules-runtime, session-worker, and the apis tests that touch conditions or attacks.
- Committed on your branch. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A short "Done" entry is added to [phase-08-2-convex-cutover.md](phase-08-2-convex-cutover.md).
- Report: what changed, files touched, validation, and any merge-conflict risk with the main branch.
