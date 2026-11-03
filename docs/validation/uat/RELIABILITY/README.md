# Replay, reconnect and contention — UAT scenarios

Feature `RELIABILITY` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

These scenarios prove that a dropped connection, a double click, a page refresh, two people acting at the same instant, and a closed-and-reopened room never lose a decision, apply an action twice, or leak private information. Accounts and several-window setup are in the README: [accounts](../README.md#roles-and-accounts), [running several users side by side](../README.md#role-setup-for-the-owner). To drop a connection on purpose, open the browser's developer tools, go to the Network panel and set throttling to "Offline" (set it back to "No throttling" to reconnect), or close the tab and reopen the live table.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                                    | Title                                                                |
| ------------- | ----- | ------------------------------------------- | -------------------------------------------------------------------- |
| 74            | 2     | [UAT-RELIABILITY-4](UAT-RELIABILITY-4.md)   | A new Scene measures lengths correctly in every unit                 |
| 117           | 3     | [UAT-RELIABILITY-1](UAT-RELIABILITY-1.md)   | Privacy, replay, rollback, concurrency and performance hold together |
| 118           | 3     | [UAT-RELIABILITY-2](UAT-RELIABILITY-2.md)   | Two users act at the same moment                                     |
| 119           | 3     | [UAT-RELIABILITY-3](UAT-RELIABILITY-3.md)   | The room closes after everyone leaves and reopens with state intact  |
| 120           | 3     | [UAT-RELIABILITY-6](UAT-RELIABILITY-6.md)   | A contested passage holds, then spends once                          |
| 121           | 3     | [UAT-RELIABILITY-8](UAT-RELIABILITY-8.md)   | The Sheet shows correct rests, ability checks and hit points         |
| 136           | 3     | [UAT-RELIABILITY-7](UAT-RELIABILITY-7.md)   | Authored speed and sense bonuses use the right length unit           |
| 137           | 3     | [UAT-RELIABILITY-9](UAT-RELIABILITY-9.md)   | Roll reasons and initiative read the right source                    |
| 179           | 5     | [UAT-RELIABILITY-5](UAT-RELIABILITY-5.md)   | Forms and sign-out recover without silent data loss                  |
| 180           | 5     | [UAT-RELIABILITY-10](UAT-RELIABILITY-10.md) | Builder and party inventory values are right                         |
| 181           | 5     | [UAT-RELIABILITY-11](UAT-RELIABILITY-11.md) | Authoring selects, labels and lists                                  |
| 182           | 5     | [UAT-RELIABILITY-12](UAT-RELIABILITY-12.md) | Core pages open with their data                                      |
| 185           | 5     | [UAT-RELIABILITY-13](UAT-RELIABILITY-13.md) | Account deletion closes the live table                               |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC                | Why not a UAT step                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RELIABILITY-5.2   | A malformed authored speed cannot be produced through the authoring form, which constrains the value; the refusal is checked by publish-time and read-time contract tests. |
| RELIABILITY-6.2   | Deletes dead contract versions and reader branches; the data reseed is the reset in README setup steps 2 to 5, with no new screen behaviour.                               |
| RELIABILITY-6.4   | A compile-time guarantee (exhaustive switches over grant kinds); no runtime behaviour a tester could see.                                                                  |
| RELIABILITY-6.6   | Removes a legacy fallback and migrates stored data; the reset and reseed is the only visible effect.                                                                       |
| RELIABILITY-6.7   | Deletes the version 1 maintained-effect descriptor; no behaviour change on screen.                                                                                         |
| RELIABILITY-6.8   | One System schema version; migration of development data only.                                                                                                             |
| RELIABILITY-6.10  | Required array fields in the contract; empty and filled Creatures behave the same on screen.                                                                               |
| RELIABILITY-6.11  | Typed fact extraction replaces casts; compile-time only.                                                                                                                   |
| RELIABILITY-6.12  | One shared function builds the live-session envelope key; internal, and reconnection is exercised by [UAT-RELIABILITY-1](UAT-RELIABILITY-1.md).                            |
| RELIABILITY-6.14  | Only reachable with corrupt stored data (an unknown condition type or a missing label), which a tester cannot create through the app.                                      |
| RELIABILITY-6.16  | Routes Concentration and melee classification through the System module; the result is the same as before, so nothing differs on screen.                                   |
| RELIABILITY-6.18  | An import warning for unnamed entries; the alpha guide lists no import control and the preview needs a crafted import file.                                                |
| RELIABILITY-7.1   | Authoring stories and tests use the real resolver; test and bundle code, with no screen behaviour.                                                                         |
| RELIABILITY-8.1   | Typed form factory replaces pass-through wrappers; internal.                                                                                                               |
| RELIABILITY-8.5   | Node defaults checked at compile time (`satisfies`); internal.                                                                                                             |
| RELIABILITY-8.6   | Typed guided forms and shared readers; internal refactor.                                                                                                                  |
| RELIABILITY-9.3   | Render purity (no ref writes during render); enforced by lint and tests.                                                                                                   |
| RELIABILITY-9.4   | No test or story modules in production; lint rule.                                                                                                                         |
| RELIABILITY-9.7   | SSR-stable rendering (no clock or locale values during render); tests, with hydration only visible as console warnings.                                                    |
| RELIABILITY-9.8   | Type guards instead of casts; lint.                                                                                                                                        |
| RELIABILITY-10.1  | Form state ownership in one TanStack form; internal structure.                                                                                                             |
| RELIABILITY-10.2  | Re-render scope while typing; measured by render-count tests, not visible to a tester.                                                                                     |
| RELIABILITY-11.1  | Generated Convex API type check (typecheck assertion).                                                                                                                     |
| RELIABILITY-12.1  | Generated Convex API type check (type test).                                                                                                                               |
| RELIABILITY-12.2  | Generated Convex API type check (type test).                                                                                                                               |
| RELIABILITY-13.1  | A flaky test made deterministic (fixture cleanup order); test code.                                                                                                        |
| RELIABILITY-14.1  | A flaky test made deterministic (custody deletion); test code.                                                                                                             |
| RELIABILITY-15.1  | A flaky test made deterministic (initiative tie seeding); test code.                                                                                                       |
| RELIABILITY-15.2  | Same, for every settled-Run test in initiativeDeclarations; test code.                                                                                                     |
| RELIABILITY-15.3  | Same, for initiativeSpellDeclarations; test code.                                                                                                                          |
| RELIABILITY-16.1  | CI snapshot-update workflow and artifact; CI tooling.                                                                                                                      |
| RELIABILITY-17.1  | A flaky Worker test made deterministic; test code.                                                                                                                         |
| RELIABILITY-18.1  | A flaky scheduler test made deterministic; test code.                                                                                                                      |
| RELIABILITY-19.1  | merge-slice size-budget conflict handling; CI tooling.                                                                                                                     |
| RELIABILITY-19.2  | merge-slice size-budget lowering; CI tooling.                                                                                                                              |
| RELIABILITY-19.3  | merge-slice retry on GitHub 5xx; CI tooling.                                                                                                                               |
| RELIABILITY-20.1  | CI job on a throwaway Convex and Worker stack; CI infrastructure.                                                                                                          |
| RELIABILITY-20.2  | CI job selection and merge gating; CI infrastructure.                                                                                                                      |
| RELIABILITY-20.3  | Every CI browser proof passes; CI results.                                                                                                                                 |
| RELIABILITY-20.4  | A documentation statement in ci-validation.md and AGENTS.md; checked by reading them.                                                                                      |
| RELIABILITY-20.5  | Content snapshot page budget measured by the harness; the visible effect (the Session room opens) is exercised by every live-table scenario.                               |
| RELIABILITY-21.5  | A single installed prosemirror-model; dependency check in CI.                                                                                                              |
| RELIABILITY-21.6  | The CI journey driver no longer fails after a Worker reload 409; CI driver fix.                                                                                            |
| RELIABILITY-21.7  | CI journey fix (no RulesRevisionChangedError during preparation); CI driver.                                                                                               |
| RELIABILITY-21.9  | Cold-sample 250 ms p95 latency budget measured by the harness; PERF owns the measurement.                                                                                  |
| RELIABILITY-21.10 | Needs two clients on different IPs against a deployed or CI stack; not reproducible on one local machine.                                                                  |
| RELIABILITY-21.11 | Fresh-stack seeding without write-rate or OCC errors; CI seeding behaviour.                                                                                                |
| RELIABILITY-21.12 | A journey-timing fix for the Shared with party option; CI timing. The sharing flow itself is exercised in [UAT-CAMPAIGN-4](../CAMPAIGN/UAT-CAMPAIGN-4.md).                 |
| RELIABILITY-21.13 | One-second function-time budget on the area, history and Sheet command paths while all proofs run; measured by CI.                                                         |
| RELIABILITY-21.15 | Socket re-authentication challenge at token expiry minus 60 s; a CI timing proof.                                                                                          |
| RELIABILITY-21.16 | Sheet derived once and stored per section; internal performance, proved by the builder CI journey.                                                                         |
| RELIABILITY-21.17 | CI workflow rule for known-bug label edits.                                                                                                                                |
| RELIABILITY-21.18 | CI sharding and runner-minute measurements.                                                                                                                                |
| RELIABILITY-21.19 | CI gating policy for slices and merge batches.                                                                                                                             |
| RELIABILITY-21.20 | Checksum trust in Sheet derivation; internal performance (a tampered document is refused, which a tester cannot craft).                                                    |
| RELIABILITY-21.21 | The one-second query budget on the player reload after a Campaign custody cleanup; needs a Campaign deletion plus CI timing.                                               |
