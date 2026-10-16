# Slice RELIABILITY-15.T2: deterministic initiative declaration tests

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC RELIABILITY-15.2. RELIABILITY-15.T1 seeded only the 'collects each automatic declaration' case. Every other case in `apps/apis/convex/encounters/initiativeDeclarations.test.ts` that expects an ACTIVE Run (at least lines 681 and 1023, also check 1279 and the card cases) still rolls unseeded automatic initiative and fails PREPARED on a tie. Seed them with the queued-roll mechanism T1 used (or handle the tie explicitly), never weaken an assertion or add a retry. Red: force a tie in each affected case on `ci/reliability-15-t2-red`. Green on `ci/reliability-15-t2`. This blocks other slices' CI, so it goes first.

## Log
- Root cause: `closeRoom` drops the room's in-memory dice queue, and an empty queue falls back to random dice. Two cases that expect an ACTIVE Run close the room before the declaration that settles it: "shows a Character declaration only to its current controller and the GM" (never seeded; failed `PREPARED` vs `ACTIVE` in run 38870307348) and 'commits private declarations with %s responding first' (seeded once at the start, so the seed was lost at its first `closeRoom`). Equal random faces tie, and the Run waits for the GM's order.
- Not affected: "collects each automatic declaration" and the tie cases (seeded, no `closeRoom`), 'settles declarations from two assigned Character controllers' (seeded, no `closeRoom`), the Assisted and prompted-dice cases (the member enters the scores), the card cases (seeded after their last `closeRoom`), the single-actor Creature feature case (nothing to tie with), and "refuses a declaration from a controller who lost the Character assignment" (returns before settling).
- Fix: each case re-queues distinct faces after its last `closeRoom` and before the settling declaration.
