# Slice workbook: RELIABILITY-6

Rules: [slice-workbook-rules.md](slice-workbook-rules.md). CI branch `ci/reliability-6`, red branch `ci/reliability-6-red`. Decision reference: `D-pending-reliability-6` until the main session assigns a number.

Typed identities replace label and string parsing for hit dice, skill abilities, roll-mode sources, initiative reads, and System-owned Concentration and melee classification. The slice is merged as three tasks:

| Task | ACs                           | Status      |
| ---- | ----------------------------- | ----------- |
| T1a  | 6.1, 6.3, 6.15                | merged      |
| T1b  | 6.16                          | CI          |
| T1c  | 6.9                           | in progress |
| T2   | 6.12, 6.14, 6.17, 6.18        | todo        |
| T3   | 6.4, 6.10, 6.11, 6.19         | todo        |
| T4   | 6.2, 6.5, 6.6, 6.7, 6.8, 6.13 | todo        |

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

CI branch `ci/reliability-6-t1b`. Rebased from local `r6-t1b` (571c6a5f3) onto the phase tip.

| AC   | Proof                                                                                                                                                  | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 6.16 | `packages/rules-runtime/src/__tests__/installedSystemClassification.test.ts` (seam lookups, melee and non-melee triggers, uninstalled System rejected) | coded  |

- The installed System registration (`dnd5eRulesRuntimeRegistration`) carries `concentrationMaintenanceDefinitionId` and `isMeleeAttackTrigger`; `platformRulesRuntime` exposes `requireInstalledConcentrationMaintenanceDefinitionId(gameSystemId)` and `isInstalledMeleeAttackTrigger(gameSystemId, triggerCode)`.
- Readers: Worker `nativeEncounterRules`, `nativeEncounterConcentration`, `nativeEncounterMovementConcentration`; encounter-persistence concentration children, response, chosen end, edit end, live movement and listing (`readActorConcentration` takes the Run state); rules-runtime `encounterConcentration`.
- Red: the AC has no fail-before clause; the test targets a new seam (expected RED-IMPORT).

## Findings for the orchestrator

- Other D&D imports in generic code are outside 6.16 (Concentration and melee only): rules-runtime `encounterConcentration.ts` still imports the D&D Constitution id and concentration DC policy; spell-attack classification (`isDnd5eSpellAttackKind`, `dnd5eAttackKind`) in `encounterActionMechanicsPreparation`, `encounterCastReactionDiscovery`, `encounterFeatureActionCapabilityDiscovery`, `encounterDisarmPreparation`; encounter-persistence `actionCommitPersistence` (add-speed, teleport), `actionDisarmReplay` (contest graph), `initiativeRollCards` (initiative fact keys); Worker `nativeEncounterCastReaction` (cancel triggering event), `nativeAttackEnemyProximity` (type); Convex `creatureLoadoutHands`, `developmentPolicies`.

## T1c: typed roll-mode contributor source (6.9)

CI branch `ci/reliability-6-t1c` (stacked on T1b). Rebased from local `r6-t1c` (22932bdbe); earlier red: `ci/reliability-6-red-69` Tests 38891936885 on 7264b2819.

| AC  | Proof                                                                                                                                                                                                                                                                               | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6.9 | `packages/rules-runtime/src/__tests__/rollModeContributorSource.test.ts` (label by typed source, not by `sourceId`; RULE label by rule id); `encounterActiveGrants.test.ts` (one source id and reason key for Creature and Character holders); contributor fixtures assert `source` | coded  |

- `RollModeContributorSource {kind, id, holderActorId}` (shared `contributors.ts`; zod `rollModeContributorSourceDtoSchema`) is a required field of `D20Contributor` and of every receipt, belief, pending-context and concentration contributor schema; the checksum covers it.
- `labelEncounterRollModeReasons` and encounter-persistence `rollModeReasons` look labels up by `rollModeSourceKey(source)`; the `sourceId`/`domainKey` parsing is gone. The three active-effect spellings collapse to `createCharacterMechanicSourceKey`.
- Behaviour: Disarm and Overrun size-relation contributors are labelled from the rule definition (AUTHORED, definition id); Flanking is sourced to AUTHORED with the flanking definition id.
- Development data: contributor evidence lives only in encounter receipts and pending state, which are disposable dev data; per the standing Phase 8.2 local-reset approval the local backend is reset and reseeded (no compatibility shim). The `encounterStoreConformance` snapshot is regenerated from the CI artifact.

## Proposed ledger edits

None yet.
