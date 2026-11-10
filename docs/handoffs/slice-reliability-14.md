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
- Root cause: the Campaign snapshot build is scheduled on a real 2 s timer when the test's setup marks the Campaign. It fired at a machine-dependent moment relative to the test's `before` snapshot and the deletion. Fired after `before` and before the deletion, CAMPAIGN-scope `contentSnapshotObjects` appeared where the test expects none (run 38858694893). Fired earlier, the objects were in `before` and the deletion superseded them. Product behaviour is correct (a deleted scope's objects become superseded rows, removed by the daily sweep; its head is deleted), so the fix is test-only.
- Red: `ci/reliability-14-red` carries the original test plus a 2.5 s real-time sleep after the expected snapshot, which forces the build before the deletion. An injected sleep cannot stay in the suite.
- Fix: the test fakes only `setTimeout`/`clearTimeout` from the start, so the build is pending until the test says otherwise. `AFTER_DELETION` (the original ACTIVE and ARCHIVED cases, assertions unchanged) drains setup work due within 1 s and leaves the build pending. New `BEFORE_DELETION` case runs the build first, then asserts its three Campaign objects are superseded at the deletion time and no Campaign head remains. Both cases assert no Campaign head remains.
