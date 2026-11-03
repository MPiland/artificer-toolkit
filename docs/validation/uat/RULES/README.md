# Rules engine — UAT scenarios

Feature `RULES` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

The rules engine is mostly invisible. A tester sees it in two places: authored forms that show, hide and require fields as the author's choices change, and live-table decisions that pause the game until someone answers and then resume exactly where they left off. These scenarios tie to those visible flows; the engine's internals are listed under Covered elsewhere.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                      | Title                                                                        |
| ------------- | ----- | ----------------------------- | ---------------------------------------------------------------------------- |
| 39            | 1     | [UAT-RULES-1](UAT-RULES-1.md) | Authoring forms show, hide and require fields as choices change              |
| 113           | 3     | [UAT-RULES-3](UAT-RULES-3.md) | A reaction pauses a hit; answering resumes it; privacy of the pause          |
| 114           | 3     | [UAT-RULES-4](UAT-RULES-4.md) | Healing keeps its dice and modifier visible in the roll card                 |
| 148           | 4     | [UAT-RULES-2](UAT-RULES-2.md) | A started Encounter pauses for answers and resumes with nothing half-applied |
| 149           | 4     | [UAT-RULES-5](UAT-RULES-5.md) | An attack with two damage parts keeps each part visible                      |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RULES-1.3 | Rejection of tampered or invalid resume evidence (26 runtime tests): a tester would have to forge stored decision data. The honest pause-and-resume path is exercised in [UAT-RULES-2](UAT-RULES-2.md) and [UAT-RULES-3](UAT-RULES-3.md). |
| RULES-2.1 | CI file-size and import-budget guardrails; no running behaviour.                                                                                                                                                                          |
| RULES-2.2 | Golden harness pinning compiled checksums; a test harness over every SRD effect.                                                                                                                                                          |
| RULES-2.3 | One d20 settlement function behind every check, save and contest; behaviour unchanged for players, which the ATTACK and SPELLS journeys exercise.                                                                                         |
| RULES-2.4 | One sealed-choice lifecycle and pause union in code; behaviour unchanged, and the pauses themselves (reactions, saves, initiative) are exercised in [UAT-RULES-2](UAT-RULES-2.md), [UAT-RULES-3](UAT-RULES-3.md) and the REACTION file.   |
| RULES-2.5 | Single event table and dispatch site; a code structure with no new play behaviour.                                                                                                                                                        |
| RULES-2.6 | Effect-action compiler decomposition; an internal refactor.                                                                                                                                                                               |
| RULES-2.7 | Capability registry and a neutral second-System tracer; no second System exists to play.                                                                                                                                                  |
| RULES-2.8 | File splits below the size budget and one home for initiative cursor ordering; an internal refactor, with turn order exercised in the ENCOUNTER file.                                                                                     |
