# Release — UAT scenarios

Feature `RELEASE` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

These scenarios check the alpha play guide against the running build and record the owner's UI review sign-off. Staging and production steps are not local UAT.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Run order | Level | Scenario                          | Title                              |
| --------- | ----- | --------------------------------- | ---------------------------------- |
| 187       | 5     | [UAT-RELEASE-1](UAT-RELEASE-1.md) | Exact cleanup and final acceptance |

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| RELEASE-1.1 | Documentation and ADR status text; link and wording audit                                                                                    |
| RELEASE-1.2 | Deployment guides and runbook; document review                                                                                               |
| RELEASE-1.3 | Link audit script                                                                                                                            |
| RELEASE-2.1 | Lifecycle run from a fresh isolated deployment; harness                                                                                      |
| RELEASE-2.2 | Lifecycle on one source state; harness                                                                                                       |
| RELEASE-2.3 | Rule-corpus and gameplay proof; harness                                                                                                      |
| RELEASE-5.1 | Release check on deployment configuration                                                                                                    |
| RELEASE-6.1 | Live-backend test observing typed rejection shape                                                                                            |
| RELEASE-8.3 | Local UAT infrastructure (review data, local email, spare accounts); proved by the ledger tasks and exercised by every scenario in this path |

## Not coverable by UAT

| AC          | Gap                    | Reason                                                                                  |
| ----------- | ---------------------- | --------------------------------------------------------------------------------------- |
| RELEASE-3.1 | G4 (staging)           | Staging promotion needs managed credentials and is not a local UAT step                 |
| RELEASE-3.2 | none (decision record) | A recorded decision, not tester-visible behaviour                                       |
| RELEASE-4.1 | none (production)      | Production deployment is not a local UAT step                                           |
| RELEASE-4.2 | none (production)      | Production smoke is not a local UAT step                                                |
| RELEASE-8.4 | G4 (staging)           | External-tester staging run is an owner-approved staging activity, not a local UAT step |
