# SPELLS-8.T8: limited-use and pool casts spend and restore that use

Slice workbook. Rules: [slice-workbook-rules.md](slice-workbook-rules.md). Parent: [slice-spells-8-t1.md](slice-spells-8-t1.md) ("Not in T5: ... LIMITED_USE or pool casts (T8)").

## Brief

Closes AC SPELLS-8.1 for pool-paid casts: a spell a feature grants with `LIMITED_USE`, or with `CAST_AT_LEVEL` (a FIXED_LEVEL cast) and a charge pool, is offered in an Encounter, and casting it spends one use of that pool and no spell slot; GM undo restores the use.

Before T8 the Encounter refused to offer these casts (`isCastOffered` excluded `LIMITED_USE` and pool-backed `FIXED_LEVEL`), and `resourceOwner()` in the native action resource path threw for `SPELL_SOURCE` pools.

Rules mirrored from the Sheet (`sheetResourceUsage.ts`): a leveled cast (`spell.level > 0`) paid from a pool spends one use (`used + 1`); a cantrip is free; a ritual is still never offered (T1 scope). A `FIXED_LEVEL` grant without a pool (`CAST_AT_LEVEL` with no `charges`) is free, as it already was.

## ACs closed or advanced

| AC | Part closed here | Proof |
| --- | --- | --- |
| SPELLS-8.1 | A LIMITED_USE or CAST_AT_LEVEL granted spell is offered at its cast level, spends one use of its spell-source pool and not a slot, the exhausted pool stops the offer and refuses the cast, and GM undo restores the use | see checklist |

## Red-first checklist

| Test | Proves | Red log | Green log |
| --- | --- | --- | --- |
| `actionSpellCasting.test.ts` "journey: a $attribute grant is cast from its use and not a slot, and GM undo restores the use" (LIMITED_USE, CAST_AT_LEVEL) | the Encounter offers the cast; `RESOLVE_ACTION` spends one use (used 1, remaining 1), spends no slot, undo restores used 0 | `local-validation/spells-8-t8/red-convex.log` | `green-convex.log` |
| `actionSpellCasting.test.ts` "stops offering the cast once its last use is spent, and refuses the exhausted cast" | two casts exhaust the pool; the offer disappears; a stale cast is refused; no slot spent | `red-convex.log` | `green-convex.log` |
| `characterSpellCastActions.test.ts` "offers a $castMode cast bound to its pool at the cost of one use" | the candidate, the decision and the compiled entry carry `{ poolId, chargeId, cost: 1 }` | `red-unit.log` | `green-unit.log` |
| `characterSpellCastActions.test.ts` "spends one use of the pool and no slot, from the uses already spent, in Assisted play" | `prepareNativeCharacterActionState` returns the resource consumption (SPELL_SOURCE owner, 1 -> 2) and no spell consumption | `red-unit.log` | `green-unit.log` |
| `characterSpellCastActions.test.ts` "spends nothing in Manual play"; "spends nothing for a cantrip" | Manual play and cantrips spend nothing | `red-unit.log` | `green-unit.log` |

## Status log

- 2026-10-15: merged `codex/phase-08-2-convex-cutover` (already up to date at 50c74fdc2). Read the cast path: `isCastOffered` gate, `resourceOwner()` throw, `compiledResourceBinding`, the decision logic (`RESOURCE_REMAINING`/`RESOURCE_EXHAUSTED`) and undo (`restoreCharacter` restores any pool usage by `createCharacterResourceOwnerKey(usage.owner)`, so `SPELL_SOURCE` needs no change there).
- Tests written first. Deviation: I edited production code before the red run started, so I saved the edits aside, reverted the two production files from git, took the red logs, then restored the edits. Red: unit 5 failed (not offered at base), Convex 3 failed (`expected [] to deeply equal ['Mend (1st level)']`, the cast was not offered).
- Code: [characterSpellCastActions.ts](../../packages/rules-runtime/src/character/characterSpellCastActions.ts) offers LIMITED_USE and pool-backed FIXED_LEVEL casts (ritual still not) and gives a leveled pool cast its `resourceUse` (`{ poolId, chargeId, cost: 1 }`) and the decision's `resourcePoolId`/`resourceCost`; `SpellPolicyOutput` now includes `resources`. [characterNativeActionResources.ts](../../packages/rules-runtime/src/character/characterNativeActionResources.ts) builds the `SPELL_SOURCE` owner key instead of throwing. No schema, Convex or persistence change: the existing `resourceBinding` spend and the undo restore (`actionRevert.ts`, keyed by `createCharacterResourceOwnerKey(usage.owner)`) handle the pool unchanged.
- Green (built in the heavy lane, then scoped tests): unit 35 passed, Convex `actionSpellCasting.test.ts` 24 passed. Logs under `local-validation/spells-8-t8/`.

## Proposed ledger edits (main session applies)

- SPELLS-8.T8: status DONE, `note`: "Encounter offers LIMITED_USE and CAST_AT_LEVEL pool casts; a leveled cast spends one use of the spell-source pool and no slot (cantrips free), GM undo restores it. Rituals stay not offered."
- AC SPELLS-8.1: add a `proof` line for T8.
