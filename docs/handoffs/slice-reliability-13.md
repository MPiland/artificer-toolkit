# Slice RELIABILITY-13.T1: deterministic fixture cleanup

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC RELIABILITY-13.1. `apps/apis/convex/encounters/developmentLifecycleProof.test.ts` failed intermittently. The failure was in Convex shard 3/4, run 38848532122, on `ci/attack-17-t2` at 3c20a8a0d. The error was "Fixture Scene bounds or ownership mismatch." from `removeFixtureState` in `apps/apis/convex/scenes/developmentScene.ts`, thrown after the test body passed.

To do:
- Find the nondeterminism.
- Reproduce it deterministically with a test that is red before the fix.
- Fix the root cause.

Do not retry or loosen the cleanup check.

## Log
