# Performance and cost — UAT scenarios

Feature `PERF` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

These scenarios give testers a human feel for responsiveness at a table of four. The numeric budgets are measured by harnesses elsewhere; nothing here replaces them, and nothing here is evidence of normal play. The managed run needs staging credentials and is not a local test.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Run order | Level | Scenario                    | Title                                                                                                   |
| --------- | ----- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| 120       | 3     | [UAT-PERF-2](UAT-PERF-2.md) | Four people at a local table feel responsive                                                            |
| 188       | 5     | [UAT-PERF-1](UAT-PERF-1.md) | Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke) |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERF-1.1  | Frozen workload run by a harness                                                                                                                         |
| PERF-1.2  | Latency and I/O budgets measured by harness (ADR 0035)                                                                                                   |
| PERF-3.1  | Record sizes and read volumes measured                                                                                                                   |
| PERF-3.4  | Budgets, harness deletion and docs rewrite; engineering work                                                                                             |
| PERF-3.5  | Checkpoint I/O sizes; measured                                                                                                                           |
| PERF-3.6  | Absence of forced flushes is an I/O measurement; the visible half (a window stays alive past its sign-in) is [UAT-ROOM-2](../ROOM/UAT-ROOM-2.md) step 7. |
| PERF-3.8  | Save point design; I/O measured                                                                                                                          |
| PERF-3.9  | Where movement evidence is stored; internal                                                                                                              |
| PERF-3.10 | Which store live readers use; internal                                                                                                                   |
| PERF-3.11 | Storage layout; internal                                                                                                                                 |
| PERF-3.12 | Checkpoint folding; internal                                                                                                                             |
| PERF-3.14 | Budgets in gates and the V15 load run; measured                                                                                                          |
| PERF-4.1  | Encounter creation read volume at 100 actors; measured                                                                                                   |
| PERF-4.2  | Module load cost; measured                                                                                                                               |
| PERF-4.3  | SHA-256 digest equality; unit test                                                                                                                       |
| PERF-4.4  | Projection read volume with computed AC; measured                                                                                                        |
