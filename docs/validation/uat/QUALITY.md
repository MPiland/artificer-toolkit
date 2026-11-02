# Code quality: one home per rule — UAT scenarios

Feature `QUALITY` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

QUALITY removes duplicated and diverging logic and adds lint guardrails. Its two acceptance criteria are internal (regression tests and a CI lint job), so there is no tester flow here. A few of the formerly diverging behaviours can be seen in play (for example removed-item references in UAT-BUILDER-4), but the criterion itself is that one shared implementation exists and a regression test fails without it.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC | Why not a UAT step |
| -- | ------------------ |
| QUALITY-1.1 | That one shared implementation serves every former copy is a code-structure property, proved by regression tests that fail before the fix; no extra behaviour is added for a tester. |
| QUALITY-3.1 | A CI lint job at zero warnings with double-cast and component-file-export rules; no running behaviour. |
