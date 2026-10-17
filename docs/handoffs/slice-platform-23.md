# Slice workbook: PLATFORM-23 (CI runs exactly the tests a change can affect)

**Status:** T1 green candidate on `ci/platform-23` (2026-10-16); T2 next.
**Base:** `codex/phase-08-2-convex-cutover` (merged at `cb19518ea`).
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0038](../adr/0038-rules-authored-from-core-options.md) (authoring parity).

## ACs

- **23.1** (T2) Each slice runs only the test files whose imports reach its changed files, across all packages, with no hand-kept list; merge batches run every test.
- **23.2** (T1) The 12 failing authoring parity tests are fixed at their cause and the ACs that cite them are re-verified, with no weakened assertions.

## T1: the 12 authoring failures

All 12 tests were added 2026-10-14..16 and never ran in CI: `tests.yml` looped over a hand-kept package list without `authoring` (and without `design-system`; `emails` was added by PLATFORM-22). No assertion changed.

| Test (count)                                                                                                                                   | Cause                                                                                                                                                                                                                                                                                             | Kind         | Fix                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| creatureFormAuthoringParity (2), offHandAttackAuthoringParity (4), conditionSourceAuthoringParity "dragon" (1), escapeDcOptions "fixed DC" (1) | The tests built a reader with `readAuthoredRows: () => []`, so every reference to an authored root (creatures, equipment, rules, capability definitions, class ids) was missing from its options and cleared. Production (`createSystemSourceReader`) and the web harness read the authored rows. | Test fixture | The web harness's in-memory SRD reader moved to `packages/authoring/src/nodeRuntime/srdSourceReader.ts` (subpath export); the authoring tests and web tests share it. |
| concealmentAuthoringParity (2)                                                                                                                 | ATTACK-10.T1's check map selects table `passives` (`CHECK_DC_NODE_MAP`, PASSIVE DC), which was neither a trusted source table nor System vocabulary: resolving it threw `Untrusted node runtime table: passives`. An author choosing a PASSIVE DC would hit the same throw in production.         | Product bug  | `passives` added to `nodeRuntimeSourceManifest` and to `systemVocabularyRows`.                                                                                        |
| systemVocabularyOptions "selects the description" (1)                                                                                          | SPELLS-28.T4 (`5a24c22ad`) added `excludedSpeedIds` selecting `speeds` without `description` (AUTHORING-18 rule).                                                                                                                                                                                 | Product bug  | `description` added to that select.                                                                                                                                   |
| conditionSourceAuthoringParity "clears fleesSource" (1)                                                                                        | SPELLS-29.T2 (`841de7cfc`) gave `fleesSource` a `showIf` on `recordsSource` but the default `hiddenBehavior` is `KEEP`, so a hidden `fleesSource: true` survived.                                                                                                                                 | Product bug  | `hiddenBehavior: 'CLEAR'`.                                                                                                                                            |

Ledger items that cite these tests (orchestrator to re-verify): AUTHORING-18.1, AUTHORING-19.1 (systemVocabularyOptions), ATTACK-9.5 (offHandAttackAuthoringParity), SPELLS-29.2 (conditionSourceAuthoringParity, reopened). By behavior, not file name: ATTACK-10.T1 (concealment, escapeDcOptions) and SPELLS-28.T2/T4 (creatureFormAuthoringParity, the speeds select).

Also found: `packages/authoring` typechecks with `tsconfig.build.json`, which excludes `*.test.ts`, so authoring tests are not typechecked. PLATFORM-22 adds `tsconfig.tests.json` for packages on `ci/platform-22`; not touched here.

## Status log

- 2026-10-16: local red (12 failed / 16 passed in the six files) reproduced after building packages. Green: `packages/authoring/src` 15 files, 104 tests passed (light lane).

## Proposed ledger edits

- PLATFORM-23.2 DONE once T1 is green on CI (sha and run ids in the report).
