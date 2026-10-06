# ADR 0035 Amendment 12 Character play state, 2026-09-29

**Status:** local evidence for the Character part of
[ADR 0035](../../adr/0035-room-authoritative-live-encounters.md) Amendment 12 (plan slice S1c in the
[implementation plan](../../handoffs/adr-0035-implementation-plan.md#s1c-character-play-state-implemented)).
No Docker or cloud deployment was used. It is not acceptance evidence, and the ledger is unchanged.

**Change.** A Character is a `characters` row (Builder structure, clocked by `updatedAt`) and a
`characterPlayStates` row (play fields, clocked by `streamVersion`). Play writes replace only the
small record. See
[Character play state](../../architecture/character.md#character-play-state-adr-0035-amendment-12--local-implementation).

## Method

`apps/apis/convex/characters/playStateBudget.test.ts` runs a Sheet `ADJUST_HIT_POINTS` command and an
Encounter damage mechanics batch through `countDatabaseIo` (`apps/apis/tests/fixtures/databaseIo.ts`),
which sums the stored JSON bytes of every written document. The "before" column is the same test on
`2c513685a`, where the Character was one document.

## Bytes written

| Path                            | Before                                                   | After                                    |
| ------------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| Sheet HP change                 | 8.2 KB: Character replace 7,589 B, command receipt 648 B | 1.1 KB: play record 496 B, receipt 648 B |
| Encounter damage to a Character | 8.3 KB: Character replace 7,606 B, receipt 676 B         | 1.2 KB: play record 513 B, receipt 676 B |

The test now asserts the play record replace is under 800 B and the totals under 1.5 KB and 1.6 KB.

## Behaviour tests

- `packages/schema/src/__tests__/characterPlayState.test.ts`: fast-check round-trip of split then
  merge, disjoint fields, absent optional keys.
- `characters/playStateConcurrency.test.ts`: a Builder save and a play command that run together both
  survive; a play command leaves the structure row unchanged; a stale play command is rejected on the
  play version, not the Builder save; a level-down clamps current HP; a stale Builder draft is
  rejected after a structural Sheet command.
- The existing Sheet, rest, GM adjustment, Encounter and Worker suites were converted to the two-record
  shape; their assertions compare the same Sheet projection as before.

## Assertion changes worth review

- Character stream versions now count play writes only: the developmentCharacterConcurrency proof
  expects 5 where it expected 6, and `builderChoices` reads the stream from the damaged Sheet.
- A Campaign overlay change moves only `play.maximumHitPoints` (`gmWrites`).
- Campaign deletion reconciliation expects both the structure and play rows to change.
