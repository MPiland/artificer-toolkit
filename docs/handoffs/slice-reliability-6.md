# Slice workbook: RELIABILITY-6

Rules: [slice-workbook-rules.md](slice-workbook-rules.md). CI branch `ci/reliability-6`, red branch `ci/reliability-6-red`. Decision reference: `D-pending-reliability-6` until the main session assigns a number.

Typed identities replace label and string parsing for hit dice, skill abilities, roll-mode sources, initiative reads, and System-owned Concentration and melee classification. The slice is merged as three tasks:

| Task | ACs            | Status      |
| ---- | -------------- | ----------- |
| T1a  | 6.1, 6.3, 6.15 | in progress |
| T1b  | 6.16           | held        |
| T1c  | 6.9            | held        |

## T1a: hit-die source kind, System skill abilities, shared initiative reader

### Acceptance criteria and proof

| AC   | Text                                                                                                                                                                | Proof                                                                                                                                    | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6.1  | A short-rest hit-die roll is recognised by its source kind (HIT_DIE), not its display label.                                                                        | `apps/apis/convex/rolls.test.ts` hit-die test (relabelled request resolves to the same source)                                           | coded  |
| 6.3  | A skill's governing ability and an ability's identity resolve from the System's authored vocabulary by id; a missing mapping is an error, never a silent DEXTERITY. | `packages/rules-runtime/src/__tests__/sheetSkillAbility.test.ts` (custom Wisdom skill projects as WISDOM)                                | coded  |
| 6.15 | An actor's initiative roll is read by one shared function switching on source kind, used by the Worker and Convex.                                                  | `packages/rules-runtime/src/__tests__/encounterInitiativeRoll.test.ts` (Character, effective override, Creature, custom, adapter parity) | coded  |

### Red-first checklist

- [x] 6.1 red: `ci/reliability-6-red` Tests run 38889565004 fails on the rolls.test.ts hit-die test (log: `local-validation/reliability-6/red-6-1-6-3.log`).
- [x] 6.3 red: same run fails on sheetSkillAbility.test.ts. (The same run also fails `content/seed.test.ts` and `equipmentCharacter.test.ts`: its base 162ca6870 carried a stale SRD manifest, fixed here by basing on merge batch z.)
- 6.15: new module; the test cannot run before the module exists (no fail-before clause in the AC).

### Status log

- 6.1: `resolveHitDieRoll` gate no longer compares the display label; it is reached only for `source.kind === 'HIT_DIE'`.
- 6.3: `resolveSystemSkillAbilities` (shared) is the single v4 skill-id and governing-ability source for rule facts and the Sheet projection; `createSkillReference`/`resolveCharacterSheetSkillKey` take the System; silent DEXTERITY fallbacks removed; unused `dexterityAbilityId` removed from armor-class facts. Schema versions 1-3 keep `SKILL_ABILITY_MAP` until RELIABILITY-6.T4 (6.8).
- 6.15: `readInitiativeSourceRoll` (rules-runtime `encounterInitiativeRoll.ts`) is one pure function; it replaces three copies (Convex `readActorInitiativeRoll`, Worker `readActorInitiativeRoll`, D&D adapter `bindActor`/`bindDeclaredActor`). Convex and the Worker call it through their existing read ports.

### Review triage

- Fixed: 6.3 error side now proved (`sheetSkillAbility.test.ts`: unknown governing ability id; ability outside the Sheet's six); `resolveAbilityCode` is no longer exported.
- Stands: the callers destructure the reader result to the read-port contract (`characterId`, `expression`, `rollMode`); returning `modifier` too would widen the port output.
- Defer to RELIABILITY-6.T4 (removes the schema v1-3 `SKILL_ABILITY_MAP` branches): collapse the v4 alias set in `createSkillReference` into `buildSkillSubjectAliasMap`, and the three skill-name normalisers into one.
- Defer: take the initiative die size from the System instead of the d20 constant in `encounterInitiativeRoll.ts` (ADR 0023); the removed copies and `encounterRuleCheckRolls.ts` carry the same constant.

## T1b: System-owned Concentration and melee classification (6.16)

Held until the overlapping slices merge (SPELLS-26.T3, SPELLS-27.T2b, SPELLS-28.T2, ATTACK-9.T6b, ATTACK-17.T4b, REACTION-4.T3c). Work is committed on local branch `r6-t1b`.

## T1c: typed roll-mode contributor source (6.9)

Held until T1b merges. Work in progress is on local branch `r6-t1c`. Needs a development-data migration, a regenerated `encounterStoreConformance` snapshot, and possibly a decision number for the typed source shape.

## Proposed ledger edits

None yet.
