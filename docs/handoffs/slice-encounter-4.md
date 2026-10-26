# Slice ENCOUNTER-4: Speed Factor initiative

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **ENCOUNTER-4.T1** closes ACs ENCOUNTER-4.1 to 4.4. This is the DMG Speed Factor initiative variant, a Campaign optional rule.
  - Each round, every actor declares an action.
  - Initiative modifiers come from authored System data (action category, weapon properties, spell level, size), not from code.
  - Ties are settled by the authored rule.
  - The declared action is enforced when the actor's turn resolves.
- Read the Encounter initiative cursor and staging owners first (`encounterInitiativeCursor`, `encounterInitiativeStaging`). Build Speed Factor through them, not beside them.

## Log

- 2026-10-24: Explored on base `84a639064`. Declaration, the Speed Factor graph, the tie resolvers and the Campaign policy selection already exist. Three gaps remain: the modifiers are hard-coded in `systems/dnd5e/initiativeFactAdapter.ts` (and in the `GM_ADJUDICATED.actionFactors` enum), no Speed Factor policy is seeded, and no enforcement exists at resolution. A design packet went to the orchestrator: a `declarationModifiers` table on the INITIATIVE_POLICY document, a seeded SRD-catalogue policy, the tie resolver set, and the enforcement rule with the `UNDECLARED_ACTION` code. Waiting on the ruling before any persisted-contract work.
- 2026-10-24: Orchestrator rulings received.
  - A: `declarationModifiers` lives only on the `DECLARED_ACTION_ROLL` variant of a discriminated INITIATIVE_POLICY union. A neutral pure evaluator replaces the D&D switch. `GM_ADJUDICATED.actionFactors` becomes `factorIds` from the frozen policy. Reseed dev data, and update the initiative section of `docs/architecture/rules-runtime.md`.
  - B: seed the policy like optional combat (`source-data/srd/catalogue.ts`).
  - C: seed only the DMG text's tie rule as the default: higher Dexterity score (D&D fact `initiative.dexterity-score`, one attempt). Remaining ties go to the table's order choice.
  - D: `UNDECLARED_ACTION`, no GM override, no new persisted state. Basic actions stay unenforced; the orchestrator recorded that exploit in future-enhancements.

## Checklist

- [ ] Schema: discriminated INITIATIVE_POLICY union; `factorIds`; `UNDECLARED_ACTION` code.
- [ ] Neutral declaration-modifier evaluator, with homebrew parity; D&D tables deleted.
- [ ] Declaration request and compiler read sizes and factors from the frozen policy.
- [ ] D&D `initiative.dexterity-score` fact and seeded Speed Factor policy, graphs and tie resolver.
- [ ] Enforcement guard in action and spell admission (pass and refuse).
- [ ] Fixtures, existing tests, canonical doc.
- [ ] CI green, red-proof run id, reviewer pass, phase-tip merge green.

## Journey (ENCOUNTER-4.T2, 2026-10-25)

- `apps/session-worker/test/nativeRoomSpeedFactorInitiative.test.ts` is the PBI journey. It starts the Run with the public `START` command of the real local room, answers each prompt with `RESOLVE_RULE_OCCURRENCE` (`INITIATIVE_DECLARATION`), reads the turn order and refuses an undeclared action. It covers ACs 4.1 to 4.4 and touches no internals.
- The player-visible declaration step is `apps/web/src/domains/campaigns/vtt/CampaignTabletopDecisionDrawer.test.tsx` ("Declare actions" resolves `INITIATIVE_DECLARATION`), which already exists. No new test was needed.
- Register both as `journeyTests` (orchestrator owns the ledger).
