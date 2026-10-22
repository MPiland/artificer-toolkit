# Slice SPELLS-31.T5p: spell slot costs and class spell lists

Ledger task `SPELLS-31.T5p` (closes AC SPELLS-31.1; unblocks `SPELLS-33.T5afp`). Branch `spells-31-t5p`, CI branch `ci/spells-31-t5p`. Status: **implemented; awaiting CI green.**

## Ruling (D175, draft for `phase-08-2-decisions.md`)

**D175 (SPELLS-31.T5p).** Spell slot costs and class spell lists are generic options on `SPELL_GRANT`:

1. `slotCost: { poolCode }` names the slot pool that also pays the cast, by System-supplied code (`systemVocabularyCodeSchema`, the `attackRollMode` pattern), never a platform enum. The dnd5e vocabulary lists the `spellSlotPool` kind (`PACT`, "Pact Magic"); the Builder node's options come from it through the `spell_slot_pools` source table, and the rules-runtime fact seam refuses an unknown code (`The Game System does not define the spell slot pool "<code>"`). Neutral files keep their existing `'PACT'` literals until the orchestrator registers their move into the System. The six Warlock pact invocations author it beside their existing `LIMITED_USE` charge.
2. Primeval Awareness is Sheet-only. Spending the slot is the whole mechanic (the generic `USE_SPELL_SLOT` command); sensing stays description. Its closed rule is deleted with no replacement runtime.
3. Expanded Spell List uses `access: 'CAST' | 'CLASS_LIST_ONLY'` plus `classListIds`. `CLASS_LIST_ONLY` without `classListIds` is refused at compile time (`SPELL_GRANT_CLASS_LIST_MISSING`; `_UNUSED` when lists are named without list-only; `_SHAPE` when no spells are named). One merge function (`spellClassListAdditions.ts`); the Builder owns the merged list for prepare and known choices and the Sheet only reads it.

Deleted kinds: `CLASS_WARLOCK_INVOCATION_PACT_SLOT_COST`, `CLASS_RANGER_PRIMEVAL_AWARENESS`, `CLASS_FIEND_EXPANDED_SPELL_LIST`.

## Red proof (before the option existed)

- `sheetPactSlotCasting.test.ts` (Sheet journey, pact slot cast): failed with `expected cast.slotKey "PACT"`, got only `sourceId` and `spellId`.
- `spellClassListAdditions.test.ts` and the authoring parity test failed on the pre-change data (Fiend feature had a closed rule and no grant).
- Golden test failed once the kinds were deleted until the rows were removed.

## Golden flips (`srdEffectCompile.golden.txt`, 8 REFUSED rows removed)

Primeval Awareness (`c008-6006`), Expanded Spell List (`c00b-1401`), Thief of Five Fates (`c00b-6006`), Dreadful Word (`6007`), Minions of Chaos (`6008`), Mire the Mind (`6009`), Sculptor of Flesh (`600a`), Sign of Ill Omen (`600b`).

## Proof

- Decision ladder and spend: `characterSpellCastActions.test.ts` (pact slot spent with the pool; `SPELL_SLOT_REMAINING`, `SPELL_SLOT_EXHAUSTED`, `NO_ELIGIBLE_SPELL_SLOT`, `RESOURCE_EXHAUSTED`).
- Compiler: `shared/src/__tests__/spellGrantClassList.test.ts`.
- Class list merge: `spellClassListAdditions.test.ts`.
- Authoring parity (SRD and homebrew variant per feature): `authoring/src/nodeRuntime/spellSlotCostAuthoringParity.test.ts`.
- Sheet journey: `apps/apis/convex/characters/sheetPactSlotCasting.test.ts`.
- Assertions changed: none (test fixtures gained `slotPoolCode: null`).

## Ratchets

`characterRules.ts` access-candidate schemas moved to `characterSpellAccessCandidates.ts` (entry removed from `fileSizeBudget.json`); `warlock.ts` cap lowered 2180 to 2169. `sheetProjection.ts` keeps its `'PACT'` literals (line budget).
