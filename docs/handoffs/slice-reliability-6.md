# Slice workbook: RELIABILITY-6.T1

Rules: [slice-workbook-rules.md](slice-workbook-rules.md). Branch `r6` (base `origin/ci/merge-batch-y`), CI branch `ci/reliability-6`, red branch `ci/reliability-6-red`.

## Brief

Typed identities replace label and string parsing for hit dice, skill abilities, roll-mode sources, initiative reads, and System-owned Concentration and melee classification. Closes RELIABILITY-6.1, 6.3, 6.9, 6.15, 6.16 (WSJF 3/3/8/5). Decision reference: `D-pending-reliability-6` until the main session assigns a number.

## Acceptance criteria and proof

| AC   | Text                                                                                                                                                              | Proof                                                                                                                                  | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6.1  | A short-rest hit-die roll is recognised by its source kind (HIT_DIE), not its display label.                                                                      | `apps/apis/convex/rolls.test.ts` hit-die test (relabelled request resolves to the same source)                                         | coded  |
| 6.3  | A skill's governing ability and an ability's identity resolve from the System's authored vocabulary by id; a missing mapping is an error, never a silent DEXTERITY. | `packages/rules-runtime/src/__tests__/sheetSkillAbility.test.ts` (custom Wisdom skill projects as WISDOM)                              | coded  |
| 6.15 | An actor's initiative roll is read by one shared function switching on source kind, used by the Worker and Convex.                                                | `packages/rules-runtime/src/__tests__/encounterInitiativeRoll.test.ts` (Character, effective override, Creature, custom, adapter parity) | coded  |
| 6.16 | Generic Worker and encounter-persistence code resolves Concentration maintenance and melee-attack classification through the System module for the Run's gameSystemId. | `packages/rules-runtime/src/__tests__/installedSystemClassification.test.ts` (seam lookups, uninstalled System rejected)               | coded  |
| 6.9  | A roll-mode contributor carries a typed source (kind, id, holder); no consumer parses sourceId/domainKey strings; the three active-effect spellings collapse to one. | pending                                                                                                                                | open   |

## Red-first checklist

- [ ] 6.1 red: `ci/reliability-6-red` Tests run fails on the rolls.test.ts hit-die test (log: `local-validation/reliability-6/red-6-1-6-3.log`).
- [ ] 6.3 red: same run fails on sheetSkillAbility.test.ts.
- 6.15: new module; the test cannot run before the module exists (no fail-before clause in the AC).

## Status log

- 6.1: `resolveHitDieRoll` gate no longer compares the display label; it is reached only for `source.kind === 'HIT_DIE'`.
- 6.3: `resolveSystemSkillAbilities` (shared) is the single v4 skill-id and governing-ability source for rule facts and the Sheet projection; `createSkillReference`/`resolveCharacterSheetSkillKey` take the System; silent DEXTERITY fallbacks removed; unused `dexterityAbilityId` removed from armor-class facts. Schema versions 1-3 keep `SKILL_ABILITY_MAP` until RELIABILITY-6.T4 (6.8).
- 6.15: `readInitiativeSourceRoll` (rules-runtime `encounterInitiativeRoll.ts`) replaces three copies (Convex `readActorInitiativeRoll`, Worker `readActorInitiativeRoll`, D&D adapter `bindActor`/`bindDeclaredActor`).

- 6.16: the installed System registration (`dnd5eRulesRuntimeRegistration`) now carries `concentrationMaintenanceDefinitionId` and `isMeleeAttackTrigger`; `platformRulesRuntime` exposes `requireInstalledConcentrationMaintenanceDefinitionId(gameSystemId)` and `isInstalledMeleeAttackTrigger(gameSystemId, triggerCode)`. Worker (`nativeEncounterRules`, `nativeEncounterConcentration`, `nativeEncounterMovementConcentration`) and encounter-persistence (concentration children, response, chosen end, edit end, live movement, listing) read them by the Run's `gameSystemId`; `readActorConcentration` now takes the Run state instead of an encounter id. Other D&D imports in these packages (optional-combat contest graph, add-speed and cancel-event executions, initiative fact keys, disarm operation key, encounter-lifecycle schema) are outside 6.16's AC (Concentration and melee classification only); candidate follow-up item.

## Proposed ledger edits

None yet.
