# Phase 7.6 — SRD Master Data Population + E2E Test

## Status: Pending

## Context

Phase 7 delivered the complete API transport layer. The database schema is fully normalized and the character engine pipeline works end-to-end in unit tests. However, the SRD baseline bundle — the source-data files in `packages/db/src/source-data/srd/` — still has empty arrays for every subject type.

Phase 7.6 fills those arrays with real SRD 5.1 content and culminates in a Vitest E2E integration test: seed the bundle, create a Fighter character, level them up, run the engine, assert the resolved sheet matches expected D&D 5e 2014 values.

Phase 7.6 targets **existing infrastructure only** — no new subject types, no new tables, no schema migrations needed. Monster/creature data waits for Phase 7.5 when the `creature` subject exists.

---

## Architectural Decisions

### Source Data Format

All SRD content lives in `packages/db/src/source-data/srd/` as full authored TypeScript types — the same shapes as user-authored content. No separate seed DTO format. This keeps SRD data flowing through the same validation → compiler → repository paths used for homebrew content.

### SRD Licensing Scope

Only SRD 5.1 permitted content. Non-SRD content (e.g. Ranger's Favored Enemy in some forms, Paladin Sacred Oaths with IP names) stays empty or omitted. When in doubt, omit.

### E2E Test Infrastructure

Vitest + in-memory SQLite — same infrastructure as the existing 160+ DB round-trip tests. No Supabase dependency; no network; no flake. The test lives at `packages/db/src/__tests__/srd-e2e.test.ts`.

---

## Scope

### Subjects to populate (all already fully implemented in the schema)

| Subject | Count | Notes |
|---|---|---|
| Races | 9 base races + 9 subraces | SRD 5.1: Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling |
| Classes | 12 base classes | All SRD classes, levels 1–20 feature progression |
| Subclasses | ~10–15 | SRD-permitted archetypes only |
| Backgrounds | 13 | All SRD backgrounds |
| Spells | ~290 | 333 IDs scaffolded; only confirmed SRD entries populated |
| Feats | ~42 | All SRD feats |
| Equipment | Core set | SRD weapons, armor, adventuring gear |

### Not populated in this phase

- Monsters/creatures (wait for Phase 7.5 when `creature` subject exists)
- Non-SRD content of any kind
- Subclasses not permitted by SRD 5.1

---

## Files Modified / Created

### Source data files (`packages/db/src/source-data/srd/`)

| File | Change |
|---|---|
| `races.ts` | New — `export const srdRaces: RaceAuthored[]` |
| `classes.ts` | New — `export const srdClasses: ClassAuthored[]` |
| `backgrounds.ts` | New — `export const srdBackgrounds: BackgroundAuthored[]` |
| `spells.ts` | New — `export const srdSpells: SpellAuthored[]` |
| `feats.ts` | New — `export const srdFeats: FeatAuthored[]` |
| `equipment.ts` | New — `export const srdEquipment: EquipmentAuthored[]` |
| `index.ts` | Modify — fill `srdBaselineContent` arrays (currently all `[]`) |

### Test

| File | Change |
|---|---|
| `packages/db/src/__tests__/srd-e2e.test.ts` | New — full E2E integration test (see below) |

---

## E2E Integration Test Steps

(`packages/db/src/__tests__/srd-e2e.test.ts`)

1. Seed SRD baseline bundle via `seedBaselineContent()`
2. Create a level 1 Fighter (race: Human, background: Soldier)
3. Assign standard array ability scores (15, 14, 13, 12, 10, 8) — STR 15 primary
4. Gain a second class level (Fighter 2 — unlocks Action Surge)
5. Pick a Fighting Style feature selection: Defense (+1 AC when wearing armor)
6. Pick one SRD feat: Great Weapon Master
7. Run `buildSnapshot()` + `runEngine()`
8. Assert:
   - HP = 10 + CON modifier at level 1, + (6 + CON modifier) at level 2
   - Proficiency bonus = +2 (levels 1–4)
   - AC inputs include `armor_type` proficiency (heavy, medium, light, shields)
   - Ability modifiers computed correctly from standard array
   - Speed = 30 ft (Human base)
   - Feature list includes: Fighting Style (Defense), Action Surge
   - Proficiencies include: martial weapons, all armor types, shields

---

## Verification

1. `npx tsc -p packages/db/tsconfig.build.json --noEmit` — clean
2. `npx vitest run packages/db/src/__tests__/srd-e2e.test.ts` — passes
3. `npx vitest run packages/db/src/__tests__` — all ≥160 existing tests still pass

---

## Handoff Notes

- When complete, update Phase 7.6 status in `REBUILD_PLAN.md` to "Complete"
- Document any SRD content decisions (edge cases, omissions) in this file under a "SRD Content Decisions" section
- Phase 7.5 (creature + vehicle) can start once this phase is complete
