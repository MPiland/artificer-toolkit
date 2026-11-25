# Privacy and redaction — UAT scenarios

Feature `PRIVACY` in the [phase ledger](../../../roadmap/08-phase-ledger.json).

Proves that at a live table the GM sees everything, each player sees only what their Character may know, and nobody else ever sees hidden tokens, private rolls, monster statistics, or another player's private data. Every scenario names what each window must NOT show; look for those on purpose and report any leak as a failure. Accounts: [README](../README.md#roles-and-accounts). Record results: [TESTERS](../TESTERS.md#recording-results). Each role is a different person on their own computer, with the tabletop window open.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                          |
| ----------- | --------------------------------------------------------------------------- |
| PRIVACY-1.3 | Every producer using the reviewed dispatcher is a code and contract review. |
