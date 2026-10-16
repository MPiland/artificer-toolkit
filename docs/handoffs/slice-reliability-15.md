# Slice RELIABILITY-15: deterministic initiative declaration settlement test

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1 closes AC RELIABILITY-15.1. `apps/apis/convex/encounters/initiativeDeclarations.test.ts` "collects each automatic declaration, then settles exactly one Run, round, and order" flaked on aeb08c947 (Tests 38857606244): two actors rolled equal automatic initiative with `initiativeTieDefinitionId` null, so the Run settled on an `INITIATIVE_ORDER` decision the test does not handle.
- Reproduce the tie red first, then make the test deterministic by controlling the rolls through the platform random seam (fake the platform, never product logic) or by resolving the tie decision explicitly. No retry, no loosened assertion.

## Log

### T1

- Root cause. Not a single tie: the room draws one random d20 face per automatic declaration. Equal primary scores start the tie-break roll-off, and the order decision (`INITIATIVE_ORDER`, asked of the GM) appears only when the tie-break faces tie as well. The test never queued dice, so about 1 run in 400 left the Run PREPARED on that decision. A primary tie alone settled (a `[9, 9]` queue passed).
- Red: `local-validation/reliability-15/red-tie3.log`. With the dice queued as `[9, 9, 5, 5]` the unchanged test fails on the settled assertion with the same `INITIATIVE_ORDER` pending, `PREPARED`, round 0, as the CI failure in run 38857606244.
- Fix: the test queues distinct faces `[4, 9]` through the platform dice seam (`queueRoomRolls`), as its neighbours do. Product code is unchanged.
- Regression test: "asks the GM for the order when the automatic scores and the tie-break rolls both tie" queues `[9, 9, 5, 5]`, expects the pending `INITIATIVE_ORDER`, resolves it as the GM and expects one settled round. Green: `local-validation/reliability-15/green.log` (2 tests).
- Review (independent opus): root cause confirmed against the runtime (the fixture tie resolver is `repeatOnTie: false, maximumAttempts: 1`, so a second tie becomes `ORDER_CHOICE_REQUIRED`; odds 1/20 × 1/20). Triage:
  - Three sibling tests settled automatic initiative without queued dice and carried the same flake: the EACH_ROUND test (dice re-queued after the last `closeRoom`, which drops the room's queue), the Character-versus-Custom `it.each` and the two-Character test. Fixed with faces spaced seven apart (`[2, 12]`, `[2, 9, 16]`) so a Character's modifier cannot tie them.
  - The double-tie test did not prove the roll-off ran. Added the complementary "settles a tied score by the tie-break roll-off without asking the GM" (`[9, 9, 5, 6]` → ACTIVE round 1), so a product that asked on the primary tie alone now fails.
  - The inaccurate comment (equal faces ask for an order) now says a second tie in the roll-off asks.
- Proof: the light lane was starved for memory, so both runs are in CI. `ci/reliability-15-red` carries the unfixed test with `[9, 9, 5, 5]` (red); `ci/reliability-15` carries the fix (green). Local green for the two tests: `local-validation/reliability-15/green.log`.
