# Slice RELIABILITY-15: deterministic initiative declaration settlement test

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1 closes AC RELIABILITY-15.1. `apps/apis/convex/encounters/initiativeDeclarations.test.ts` "collects each automatic declaration, then settles exactly one Run, round, and order" flaked on aeb08c947 (Tests 38857606244): two actors rolled equal automatic initiative with `initiativeTieDefinitionId` null, so the Run settled on an `INITIATIVE_ORDER` decision the test does not handle.
- Reproduce the tie red first, then make the test deterministic by controlling the rolls through the platform random seam (fake the platform, never product logic) or by resolving the tie decision explicitly. No retry, no loosened assertion.

## Log
