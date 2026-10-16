# Slice RELIABILITY-14.T1: deterministic Campaign custody deletion

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC RELIABILITY-14.1.

`apps/apis/convex/campaigns/deletionCustody.test.ts` › "runs the real public custody producers before deleting a ACTIVE Campaign" failed in Convex shard 3/4 of run 38858694893, on ledger-only merge batch h (e2d6dc33d). The same code was green on batch g (311082c44). The failure was `contentSnapshotObjects: expected [...3 objects] to deeply equal []`.

To do:
- Find the nondeterminism: ordering, scheduled work, time, or shared state.
- Reproduce it deterministically with a test that is red before the fix.
- Fix the root cause. If it's a product bug, so that deletion can really leave snapshot objects behind, fix the product.

Do not retry the test or loosen the assertion.

## Log
