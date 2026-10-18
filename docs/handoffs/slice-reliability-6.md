# Slice workbook: RELIABILITY-6

Rules: [slice-workbook-rules.md](slice-workbook-rules.md). CI branch `ci/reliability-6`, red branch `ci/reliability-6-red`. Decision reference: `D-pending-reliability-6` until the main session assigns a number.

Typed identities replace label and string parsing for hit dice, skill abilities, roll-mode sources, initiative reads, and System-owned Concentration and melee classification. The slice is merged as three tasks:

| Task | ACs                           | Status      |
| ---- | ----------------------------- | ----------- |
| T1a  | 6.1, 6.3, 6.15                | merged      |
| T1b  | 6.16                          | merging     |
| T1c  | 6.9                           | green       |
| T2   | 6.12, 6.14, 6.17, 6.18        | D150 fix    |
| T3   | 6.4, 6.10, 6.11, 6.19         | in progress |
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
| 6.16 | `packages/rules-runtime/src/__tests__/installedSystemClassification.test.ts` (seam lookups, melee and non-melee triggers, uninstalled System rejected) | green  |

- The installed System registration (`dnd5eRulesRuntimeRegistration`) carries `concentrationMaintenanceDefinitionId` and `isMeleeAttackTrigger`; `platformRulesRuntime` exposes `requireInstalledConcentrationMaintenanceDefinitionId(gameSystemId)` and `isInstalledMeleeAttackTrigger(gameSystemId, triggerCode)`.
- Readers: Worker `nativeEncounterRules`, `nativeEncounterConcentration`, `nativeEncounterMovementConcentration`; encounter-persistence concentration children, response, chosen end, edit end, live movement and listing (`readActorConcentration` takes the Run state); rules-runtime `encounterConcentration`.
- Red: the AC has no fail-before clause; the test targets a new seam (expected RED-IMPORT).
- Green: tip b488925fd, Tests 39079460729. Live backend 39075528851 is green on 7dea3fc; the later push touched no Live paths. Red proof: `installedSystemClassification.test.ts` RED (4 of 4).

## Findings for the orchestrator

- 6.17: `resolveRecommendedCharacterBuilderSection` (rules-runtime `builderPresentation.ts`) still keeps its own issue-code lists per section, and it sends a background's chosen-grant choice to REVIEW. It could read `issue.sectionId` instead. That resolver is outside 6.17, which covers only the web's duplicate routing.
- Other D&D imports in generic code are outside 6.16 (Concentration and melee only): rules-runtime `encounterConcentration.ts` still imports the D&D Constitution id and concentration DC policy; spell-attack classification (`isDnd5eSpellAttackKind`, `dnd5eAttackKind`) in `encounterActionMechanicsPreparation`, `encounterCastReactionDiscovery`, `encounterFeatureActionCapabilityDiscovery`, `encounterDisarmPreparation`; encounter-persistence `actionCommitPersistence` (add-speed, teleport), `actionDisarmReplay` (contest graph), `initiativeRollCards` (initiative fact keys); Worker `nativeEncounterCastReaction` (cancel triggering event), `nativeAttackEnemyProximity` (type); Convex `creatureLoadoutHands`, `developmentPolicies`.

## T1c: typed roll-mode contributor source (6.9)

CI branch `ci/reliability-6-t1c` (stacked on T1b). Rebased from local `r6-t1c` (22932bdbe); earlier red: `ci/reliability-6-red-69` Tests 38891936885 on 7264b2819. Green on e6e38cd7b: Tests 39081656178, Live backend 39081656156; red proof RED for rollModeContributorSource (5 of 5), encounterActiveGrants (6 of 29) and actionRelationshipFacts (1 of 1). The local reset and reseed belongs with the merge, when the local deployment carries the new source shape.

| AC  | Proof                                                                                                                                                                                                                                                                               | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6.9 | `packages/rules-runtime/src/__tests__/rollModeContributorSource.test.ts` (label by typed source, not by `sourceId`; RULE label by rule id); `encounterActiveGrants.test.ts` (one source id and reason key for Creature and Character holders); contributor fixtures assert `source` | coded  |

- `RollModeContributorSource {kind, id, holderActorId}` (shared `contributors.ts`; zod `rollModeContributorSourceDtoSchema`) is a required field of `D20Contributor` and of every receipt, belief, pending-context and concentration contributor schema; the checksum covers it.
- `labelEncounterRollModeReasons` and encounter-persistence `rollModeReasons` look labels up by `rollModeSourceKey(source)`; the `sourceId`/`domainKey` parsing is gone. The three active-effect spellings collapse to `createCharacterMechanicSourceKey`.
- Behaviour: Disarm and Overrun size-relation contributors are labelled from the rule definition (AUTHORED, definition id); Flanking is sourced to AUTHORED with the flanking definition id.
- Development data: contributor evidence lives only in encounter receipts and pending state, which are disposable dev data; per the standing Phase 8.2 local-reset approval the local backend is reset and reseeded (no compatibility shim). The `encounterStoreConformance` snapshot is regenerated from the CI artifact.

## T2: shared stream keys, dangling references fail loudly, server-owned builder sections, import warnings (6.12, 6.14, 6.17, 6.18)

CI branch `ci/reliability-6-t2`.

| AC   | Proof                                                                                                                                                                                                                                                                                                          | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 6.12 | `packages/shared/src/__tests__/vtt-scene-stream-key.test.ts` (one stream key for the Worker and web; fog owner key shared by the reducer and the schema)                                                                                                                                                       | coded  |
| 6.14 | `packages/rules-runtime/src/__tests__/characterConditionLabels.test.ts`, `packages/encounter-persistence/src/__tests__/danglingReferences.test.ts` (unknown condition type and unreadable content label throw), `encounterCleaving.test.ts` (a Cleaving choice without a pinned optional-combat policy throws) | coded  |
| 6.17 | `packages/rules-runtime/src/__tests__/characterBuilderResolution.test.ts` (each issue names its section; mapping from the source kind), `apps/web/src/domains/characters/builder/core/CharacterBuilderRenderer.test.tsx` (step status follows `sectionId`)                                                     | coded  |
| 6.18 | `packages/authoring/src/imports/importParsers.test.ts` (D&D Beyond and Foundry entries with no name, level or quantity are left out and raise `IMPORTED_ENTRY_INCOMPLETE`)                                                                                                                                     | coded  |

- 6.12: `sceneTransientStreamKey` and `sceneFogOwnerKey` live in shared `vtt/scene.ts`. The Worker `streamKey`, web `previewStreamKey` and reducer `fogLayerKey` copies are gone.
- 6.14: conditions are labelled by `labelCharacterConditions`, used by both the Sheet projection and the Encounter projection. Commit labels follow D150: the Worker plans the label from the action source it executed (`encounterActionSourceLabel`, the candidate's or capability's label) and sends it as the required `label` of the action, area and countered-cast commit inputs; a legendary commit uses its option's label. The candidate `label` is required. `contentLabels.ts` (`requireEncounterContentLabel`) is deleted, and the 'Action' and 'Legendary Action' fallbacks are gone. `readContentLabel` stays in both read ports because `rollModeReasons` still labels contributor sources with it. Proof: `nativeRoomHitRiders.test.ts` (a compound `<actor>:FEATURE:…:EFFECT:…` Hell Hound Bite labels its roll cards "Bite"). The first T2 Tests run (39082670176) failed because the content-label lookup could not read compound Creature action ids. `createNativeCleavingChoice` takes `optionalCombatSnapshotChecksum: string | null` and throws on null; the Worker's `?? ''` is gone.
- 6.17: `sectionId` is a required field of `CharacterBuilderIssue` and `CharacterBuilderValidation` and of their DTO schemas. It is set where each issue is produced, and source-raised issues use `characterBuilderSectionOfSource`. The web code maps and the source mapping in `stepNavigation.ts` are deleted. Two behaviour changes: `EQUIPMENT_SOURCE_UNAVAILABLE` now routes to EQUIPMENT instead of REVIEW, and a feature-selection validation now routes by its source instead of REVIEW.
- 6.18: `requireImportedValue` warns and leaves the entry out. This covers the D&D Beyond race, background, class, subclass, inventory, custom item, feat and spell entries, and the Foundry item name, class level and equipment quantity; the Foundry entries apply the same rule beyond the cited lines. The unreachable collision label fallbacks in `importPreparation.ts`, for the character and for authored content, now read the found record's label.

## Proposed ledger edits

None yet.
