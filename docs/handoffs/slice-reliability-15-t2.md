# Slice RELIABILITY-15.T2: deterministic initiative declaration tests

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC RELIABILITY-15.2. RELIABILITY-15.T1 seeded only the 'collects each automatic declaration' case. Every other case in `apps/apis/convex/encounters/initiativeDeclarations.test.ts` that expects an ACTIVE Run (at least lines 681 and 1023, also check 1279 and the card cases) still rolls unseeded automatic initiative and fails PREPARED on a tie. Seed them with the queued-roll mechanism T1 used (or handle the tie explicitly), never weaken an assertion or add a retry. Red: force a tie in each affected case on `ci/reliability-15-t2-red`. Green on `ci/reliability-15-t2`. This blocks other slices' CI, so it goes first.

## Log
