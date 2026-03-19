# Phase 7.6 — SRD Master Data Population + E2E Test

## Status: **COMPLETE** (2026-03-17)

## Context

Phase 7 delivered the complete API transport layer. Phase 7.5 added creature + vehicle as first-class subject types. Phase 7.6 fills the SRD baseline bundle (`packages/db/src/source-data/srd/`) with real authored D&D 5e SRD 5.1 content and culminates in a Vitest E2E integration test.

During implementation an architectural gap was found: modifier grant `restrictions` are authored, persisted, and hydrated but **never evaluated** by the engine. Additionally, `conditions` on `FacetContextAuthored` is required but should be optional — subject selection alone is a valid complete restriction. Both must be fixed before the E2E test is meaningful.

E2E test subject changed from Fighter to **Warlock level 3** (Tiefling, Sage background, Fiend patron) — exercises pact magic, spell grants, Eldritch Invocations, Pact Boon, and Tiefling racial traits in a single character.

---

## Architectural Decisions

### Source Data Format

All SRD content lives in `packages/db/src/source-data/srd/` as full authored TypeScript types — the same shapes as user-authored content. No separate seed DTO format.

### SRD Licensing Scope

Only SRD 5.1 permitted content. Non-SRD content stays empty or omitted. When in doubt, omit.

### E2E Test Infrastructure

Vitest + in-memory SQLite — same infrastructure as the existing DB round-trip tests. No Supabase dependency. Test at `packages/db/src/__tests__/srd-e2e.test.ts`.

### Facet System Design

The facet chain is correct as-is: **subject type → identity selection → property predicates (optional terminal)**.

- Subject selection (`spellIds`, `equipmentIds`, etc.) narrows to specific instances — this IS a complete restriction with no predicate needed.
- Predicates are terminal property checks (e.g. `MAGIC_SCHOOL`, `SPELL_LEVEL`) applied to the selected subjects.
- `conditions` on `FacetContextAuthored` must be **optional** — absence means subject selection alone is the full restriction. An empty `conditions: []` is ambiguous (oversight vs. intent); absence is explicit.

### Modifier Grant Restriction Evaluation

Two runtime moments require restriction evaluation:

| Moment | Subject | Behavior |
| --- | --- | --- |
| Option eligibility (leveling up) | `CHARACTER` | Skip grant if predicates not met |
| Character sheet modifier display | `SPELL`, `EQUIPMENT`, etc. | Tag modifier entry with scope IDs |

For Agonizing Blast specifically:
- Option-level restriction (`CHARACTER` → `SPELL_OBTAINED: [ELDRITCH_BLAST]`) gates eligibility — lives on the option, already authored.
- Modifier grant restriction (`SPELL` subject, `spellIds: [ELDRITCH_BLAST]`, no conditions) scopes the CHA damage bonus to Eldritch Blast only — to be added to the modifier grant.

No new predicates needed. The existing facet system handles both cases.

---

## Current State

### Done ✓

- `ids.ts` — `CREATURE_IDS` (domain 0070), `VEHICLE_IDS` (domain 0080)
- `content.ts` — `creatures: CreatureAuthored[]` and `vehicles: VehicleAuthored[]` in `BaselineSubjectsContent`
- `features.ts` — racial (Darkvision, Hellish Resistance, Infernal Legacy, Dwarven Resilience, Stone Cunning), Warlock class (Otherworldly Patron, Pact Magic, Eldritch Invocations, Pact Boon), background (Researcher)
- `backgrounds.ts` — all 13 SRD backgrounds
- `classes.ts` — Warlock + Archfey/Fiend/Great Old One subclasses with full spell limits and feature progression
- `spells.ts` — 31 Warlock/Tiefling/Fiend spells
- `feats.ts` — all 42 SRD feats
- `equipment.ts` — core SRD weapons, armor, gear
- `creatures.ts` — 7 SRD monsters (Goblin, Orc, Skeleton, Zombie, Wolf, Commoner, Guard)
- `vehicles.ts` — 3 PHB vehicles (Rowboat, Sailing Ship, Cart)
- `index.ts` — all arrays wired into `srdBaselineContent`
- `apps/apis/src/routes/characters.ts` — fixed `getCharacterHistory` URL extraction bug (was returning `"history"` instead of character ID)
- `packages/functions/src/utils/handleCommandRequest.ts` — fixed `characterId` body/URL mismatch guard (cross-character event corruption vector)
- Typecheck clean: `npx tsc -p packages/db/tsconfig.build.json --noEmit` ✓

### All Steps COMPLETE ✓

| Task | Status |
| --- | --- |
| A — `conditions` optional on facet authored types | ✓ |
| B — Agonizing Blast modifier grant SPELL-subject restriction | ✓ |
| C — CHARACTER-subject restriction eval in engine | ✓ |
| D — SPELL scope tagging in modifierEntries | ✓ |
| E — `restrictions` explicit on `CompiledModifierGrant` | ✓ |
| F — Warlock L3 E2E integration test (24 tests, all pass) | ✓ |

Final verification:
- `npx tsc -p packages/db/tsconfig.build.json --noEmit` — clean
- `npx vitest run packages/db/src/__tests__` — 192/192 pass
- `npx vitest run packages/shared/src/__tests__` — 48/48 pass

---

## Implementation Details

### Step A — `conditions` optional

**`packages/shared/src/domains/shared/authored/facet.ts`**
- `FacetContextAuthored`: `conditions: readonly FacetConditionAuthored<N>[]` → `conditions?: readonly FacetConditionAuthored<N>[]`
- `FacetBodyGroupAuthored`: `conditions: readonly FacetConditionAuthored<S>[]` → `conditions?: readonly FacetConditionAuthored<S>[]`

**`packages/db/src/domains/shared/facets.ts`**
- Two loops in `writeBody` / `upsertFacet` iterate `context.conditions` — add `?? []` guard:
  ```typescript
  for (const condition of (context.conditions ?? [])) { ... }
  for (const condition of (group.conditions ?? [])) { ... }
  ```
- Hydration already returns arrays (no change needed)
- No DB migration needed — `facet_conditions` table unchanged; absence of rows = no conditions

### Step B — Agonizing Blast restriction

**`packages/db/src/source-data/srd/classes.ts`**

Add `restrictions` to the Agonizing Blast modifier grant using group 4 IDs (groups 1–3 already used for the option prerequisite):
```typescript
restrictions: {
  id: classRowId(W, 4, 10),
  groups: [{
    id: classRowId(W, 4, 11),
    order: 0,
    contexts: [{
      id: classRowId(W, 4, 12),
      order: 0,
      subject: 'SPELL' as const,
      spellIds: [SPELL_IDS.ELDRITCH_BLAST],
      // conditions omitted — subject selection is the complete restriction
    }]
  }]
}
```

### Step C — CHARACTER restriction evaluation in engine

**`packages/shared/src/domains/engine/resolution/grantApplicator.ts`**

In `collectModifiers()`, before pushing a grant: check `grant.restrictions` for `CHARACTER`-subject contexts. Evaluate `SPELL_OBTAINED`, `FEAT_OBTAINED`, `FEATURE_OBTAINED` predicates against snapshot state (`unlockedSpellIds`, `featRefs`, `featureSelections`). Skip grant if unmet.

### Step D — SPELL scope tagging

**`packages/shared/src/domains/engine/resolution/grantApplicator.ts`**

Extend `EngineAccumulatedState['modifierEntries']` entry:
```typescript
{
  domainKey: string
  modifierKind: string
  grant: CompiledModifierGrant
  scopeSpellIds?: string[]   // from SPELL-subject restriction context
}
```

When restrictions contain a `SPELL`-subject context, extract `spellIds` and attach as `scopeSpellIds`. `resolveModifiers()` passes this through for character sheet display.

### Step E — `restrictions` explicit on compiled type

**`packages/shared/src/domains/grants/compilers/modifier.ts`**
```typescript
export type CompiledModifierGrant<K extends ModifierKind = ModifierKind> =
  CompiledStaticGrant<typeof GRANT_KIND.MODIFIER_GRANT, ModifierGrantAuthored> & {
    modifierKind: K
    scope: ModifierScopeKind
    restrictions?: FacetAuthored  // explicit — engine reads this at collection time
  }
```

### Step F — E2E Test

**`packages/db/src/__tests__/srd-e2e.test.ts`**

1. Seed SRD baseline via `seedBaselineContent()`
2. Create Warlock L1 (Tiefling, Sage, Patron: Fiend)
3. Assign standard array: STR 8, DEX 14, CON 14, INT 12, WIS 10, CHA 15
4. Pick spells: Eldritch Blast (cantrip) + Hex (L1)
5. Level to L2 — pick Eldritch Invocation: Agonizing Blast
6. Level to L3 — pick Pact Boon: Pact of the Tome
7. Run `buildSnapshot()` + `runEngine()`

Assertions:
- HP = 8 + CON mod (L1) + 5 + CON mod (L2) + 5 + CON mod (L3)
- Proficiency bonus = +2
- Pact Magic: 2 slots of level 2
- Spells known include Eldritch Blast, Hex
- Features include Eldritch Invocations, Pact Boon: Pact of the Tome
- Fiend expanded spells include Burning Hands
- Proficiencies: light armor, simple weapons, CHA saves
- Agonizing Blast modifier entry has `scopeSpellIds: [ELDRITCH_BLAST_ID]` — not global
- Tiefling: Darkvision 60 ft, Hellish Rebuke spell grant

---

## Execution Order

1. Step A — `conditions` optional (type change + DB guard)
2. Step E — `restrictions` explicit on `CompiledModifierGrant`
3. Step C — CHARACTER restriction eval in engine
4. Step D — SPELL scope tagging in engine
5. Step B — Agonizing Blast restriction in authored data
6. Step F — E2E test

---

## Verification

1. `npx tsc -p packages/shared/tsconfig.build.json --noEmit` — clean
2. `npx tsc -p packages/db/tsconfig.build.json --noEmit` — clean
3. `npx vitest run packages/db/src/__tests__/srd-e2e.test.ts` — passes
4. `npx vitest run packages/db/src/__tests__` — all existing tests still pass

---

## Handoff Notes

- When complete, update Phase 7.6 status in `REBUILD_PLAN.md` to "Complete"
- The `conditions` optional change touches authored types and DB upsert — run all DB tests after Step A
- Engine changes (Steps C/D) are in `packages/shared` — run shared tests after Steps C/D
- Phase 8 (Frontend + Condition/Play State) starts after this phase is complete

## SRD Content Decisions

- E2E test subject changed from Fighter (Human, Soldier) to Warlock L3 (Tiefling, Sage, Fiend) — exercises more grant types (spell grants, modifier grants with restrictions, Eldritch Invocations, Pact Boon, subclass expanded spell lists)
- `creatures.ts` includes `SPELLCASTING: 0` on all creature `abilityScores` — required by `Record<AbilityCode, number>` constraint
- Proficiency property codes: `LIGHT` (not `LIGHT_ARMOR`) with `category: 'ARMOR'`; `SIMPLE` (not `SIMPLE_WEAPON`) with `category: 'WEAPON'`
- Agonizing Blast: modifier grant with CHA DAMAGE BONUS scoped to Eldritch Blast via SPELL-subject restriction (not a spell grant — character already has Eldritch Blast)
- Repelling Blast: description-only (push effect is not expressible as a current grant type)
- Restriction node IDs use group 4 of the Warlock class row ID space (`classRowId(W, 4, N)`)
