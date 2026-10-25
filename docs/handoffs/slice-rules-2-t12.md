# Slice RULES-2.T9f, T12 and AUTHORING-1.T2: the neutral tracer System

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md). ADR 0039 governs this slice. The ledger text of each task is its scope. Run the tasks in this order:

1. **RULES-2.T9f1, T9f2 and T9f3** (D192 split, user-approved): T9f1 makes sizes System core codes. T9f2 keys ability-score records by definition id and reseeds. T9f3 changes authored ability references to `abilityDefinitionId` and reseeds, and the D192 codemod exception covers it. List every golden flip.
2. **RULES-2.T12:** a second neutral tracer System, a Fate-like test fixture, drives the Encounter pipeline through the adapters.
3. **AUTHORING-1.T2** (AC AUTHORING-1.5): the same tracer System also travels the real publication, capability, catalogue and shell reads. The docs and ERDs describe the System-neutral model. Use one tracer fixture for both tasks, never a second one.

The tracer is a test fixture and is not seeded content.

## Log

### 2026-10-24: T9f split proposed

T9f is too large for one task. I sent the orchestrator the split packet `rules-2-t9f-split-packet.md` in the shared notes folder. My recommendation is option B, three tasks:

- **T9f1:** sizes become System core codes. No reseed.
- **T9f2:** ability-score records are keyed by the ability definition id. Needs a reseed.
- **T9f3:** authored ability references become `abilityDefinitionId`. Needs a reseed.

T9f1 does not depend on the ruling, so I started it. T9f2 and T9f3 wait for the reply.

Ruling D192 (user approved): split B. The order is T9f1 (size 3), then T9f2 (5), then T9f3 (5), and each is reported green-ready on its own. T12 follows T9f1 and T9f2, and T9f3 may run beside T12. A one-off ts-morph codemod is allowed for the mechanical rewrite in T9f2 and T9f3 only. It stays in the scratchpad and is not committed, the full diff is reviewed before commit, and this log records its summary and the count of changed sites.

### 2026-10-24: T9f1, sizes are System core codes

What changed:

- **Size list.** Sizes are a `size` core-code kind on the System. The D&D 5e list is `DND5E_SIZES` in `rules-runtime/systems/dnd5e/coreCodes.ts`. It runs smallest first, and each size carries `spaceFeet` where it has one. Neutral code reads a size's rank and space only through `sizeRank` and `sizeSpaceFeet(gameSystemId, size)` in `systemSizes.ts`. Both throw on a System that defines no sizes.
- **Encounter callers** (reach, grapple, drag, passage, attack slots, area, rule warnings, disarm, optional contests) pass `gameSystemId` through to those lookups. The rule-warnings input changed from `actorSize`/`targetSize` to `sizes: { gameSystemId, actor, target }`.
- **Wire types.** The schema types a size as `systemCoreCodeSchema`. Shared `SizeCode` is now `string`. Deleted `shared/domains/core/size.ts` (`SIZE_REGISTRY`, `SIZE_OPTIONS`, `sizeRank`) and its test.
- **Authoring.** New System source table `sizes`. The node maps draw size selects from `table('sizes', …)`.
- **Character sheet and builder.** They read size labels and options from `systemCoreCodeRegistry.entries(systemId, 'size')`. A `SIZE_OVERRIDE` outside the System's list is refused.
  - `sheetPanel` gained `vocabularyOptions`, shared by the alignment and creature-type options.
  - The web `SIZE_OVERRIDE` commit now goes through the generic path with the other vocabulary overrides.
- **SRD content.** It authors with source-data's own `srd/sizes.ts` (`SIZE_CODE`). A parity test in `systemSizes.test.ts` proves the System defines every size the SRD authors.
- **Session Worker.** I moved the action persistence builders out of `nativeEncounterRules.ts` and into a new `nativeEncounterActionPersistence.ts`, to keep `nativeEncounterRules.ts` within its size budget. Their behavior did not change.
- **Size budget.** I lowered the `fileSizeBudget.json` caps on files that shrank:

  | File                      | Old cap | New cap |
  | ------------------------- | ------- | ------- |
  | `nativeEncounterRules.ts` | 1749    | 1655    |
  | `sheetPanel.ts`           | 1691    | 1688    |
  | `path.ts`                 | 3620    | 3619    |
  | `facet.ts`                | 2513    | 2512    |

- **Docs.** I updated `docs/architecture/rules-runtime.md`, in the System vocabulary paragraph.

Behavior:

- One change is visible to users: size dropdowns now list sizes smallest first. They used to list TINY through GIANT, then FINE, DIMUNITIVE and COLOSSAL.
- No other behavior changes, and nothing needs reseeding. Stored size codes are the same strings as before.
- Golden and snapshot flips: none.
- Moved assertions. Four schema tests expected an unknown size (`NOT_A_SIZE`, `AVERAGE`, `ENORMOUS`) to fail parsing. The schema now checks only the core-code shape, so those samples became malformed codes (`not a size`, `average`, `enormous`) that it still rejects. System membership has new proofs at its owners: node-map normalization clears a size the System does not list (`systemVocabularyOptions.test.ts`), and a `SIZE_OVERRIDE` of `AVERAGE` is refused (`sheetExtras.test.ts`). `sizeRank` already returned null for `ENORMOUS` (`systemSizes.test.ts`).

Proposed follow-up (ledger proposal, out of scope by review): retire FINE, DIMUNITIVE, GIANT and COLOSSAL from the D&D 5e size list. No SRD content uses them, and DIMUNITIVE is misspelled.

Merge risk: the sibling T9e lane may also edit `fileSizeBudget.json` and `nativeEncounterRules.ts`.

### 2026-10-24: T9f1 review fixes (approved with fixes at 54c5e468b)

- **Ingress rejection restored.** `requireAuthoredSizes` (`systemSizes.ts`) refuses a Creature, Race or Vehicle size, or a `TARGET_SIZE_AT_MOST` attack-slot condition in their Features, that the System does not list. Publication (`normalizePublicationDocument`) and import staging (`stageCustomAuthored.prepareActive`) call it before node-map normalization, which would otherwise clear the code. Draft saves store raw work-in-progress JSON and stay unchecked; publication is the gate.
- **Companion rule policy.** `characterCompanionMechanicsRuleFacts` refuses an unlisted companion size and an unlisted `SIZE_OVERRIDE`.
- **Attack slots fail closed.** `TARGET_SIZE_AT_MOST` refuses an unlisted condition size, and an unlisted target size never satisfies it (it used to rank -1, which always passed).
- **Web defaults.** A System marks one size `isDefault` (D&D 5e: MEDIUM). `defaultSize(systemId)` feeds `createEmptyCreature`, `createEmptyBaseRace` and `normalizeRaceForSubmit`. The guided Creature and Race size lists come from `sceneSizes(systemId)`, the System's sizes that fill a Scene space, through `guidedSizeOptions`.
- **Proofs:** `systemSizes.test.ts` (authored refusals, default, scene sizes), `encounterAttackSlots.test.ts` (fail closed), `characterCompanionMechanicsRuleFacts.test.ts` (new), `creaturePublication.test.ts` (publish refuses `ENORMOUS`), `systemVocabularyOptions.test.ts` (normalization clears an unlisted size on the creature, race, vehicle and attackSlotCondition maps), `guidedValues.test.ts`. Web fixtures that used unregistered System ids (`dnd-5e-srd`, `system-1`, a random UUID) now use `DND5E_SYSTEM_ID`, since the default size needs a registered System.
- **Residual size paths not covered by `requireAuthoredSizes`:** facet `sizes`, manifest `statBlock.size` and `maximumTargetSize`, and effect `appliesWhen` size conditions. Node-map normalization still clears unlisted codes there.

### 2026-10-25: T9f2, abilities are System core codes (ruling option B)

- **One home for ability labels.** The SRD System record's abilities carry `short` and `description` through a normal seed patch (`SRD_ABILITIES`). No code-owned label list remains; the shared `core/ability.ts` and its alias layer are deleted. Matching is exact on the code.
- **Ingress.** Builder assignments, Sheet adjustment and panel targets, and node-map ability selects check `systemCoreCodeRegistry.abilityCodes(systemId)`. Node-map ability selects read the `abilities` and `ability_modifier_references` source tables (`systemCoreCodeRows`), so normalization clears an unlisted code.
- **Readers.** Rules-runtime and web labels, Sheet and stat block abbreviations come from the System record. Creature detail gets them from a new `abilities` detail meta key (`creatureDetailMetaDtoSchema`). New stat blocks use `defaultAbilityScores(systemId)` (`rules-runtime/systemAbilities.ts`), from the new `defaultScore` on the ability score capability (D&D 5e: 10). The new class hit point ability is the capability's `derivedStatisticAbilityCodes.hitPoints`.
- **Test change, not a weakened assertion.** `encounterEscapeCheck.test.ts` asserted that a System spelling STRENGTH as `STR` still resolved through an alias. T9f2 removes aliasing, so the test now proves the exact-code refusal.
- **Boundary scan.** `systemVocabularyBoundary.test.ts` no longer defers the `abilities` list domain; a quoted ability-code list in production code fails it.
- **Proofs:** `systemVocabularyOptions.test.ts` (System abilities in order with descriptions, unlisted ability cleared, ability modifier references end with the spellcasting reference), `builderEligibility.test.ts`, `creatureAuthoring.test.ts`, `AuthoredDomainDetailPages.test.tsx`, `EncounterEnemyStatBlock.test.tsx`.
- **Left for T9f3:** `authoringNodeDefaults.ts` (`createAbilityScores` and an `ability: 'STRENGTH'` default have no System in reach), and race ability score increase snapshot facts, which label the code because snapshots are built without the System record.
- **CI-found fixes before merge (m435):**
  - Roll modes are keyed over the System's ability list (`characterRollModes.ts`), not a fixed set.
  - Creature ability facts follow System order (`creatureRuleFacts.ts`). `z.record` keeps input key order, while stored canonical JSON comes back alphabetical, so facts built from the raw record differed between reads and broke order-sensitive comparisons in the room. `creatureRuleFacts.test.ts` proves an alphabetical record yields System-order facts and that an unlisted ability throws.
  - The schema default for ability evidence is now `{}` (`character-rules-contracts.test.ts`). This is an intended contract change.
  - `derivedStatisticAbilities.test.ts` now proves exact-code matching.

### 2026-10-25: T9f3a, System core codes refused at ingress; illumination tables

Split proposed to the orchestrator. T9f3a is below. T9f3b covers deleting class `hitpoint.ability`, renaming `excludesAbilityAtOrBelow`, the `authoringNodeDefaults` ability defaults and the race ASI snapshot facts.

- **One generic ingress refusal.** `systemCoreCodeTables` (`authoring/nodeRuntime/systemSourceRows.ts`) lists the resolver tables whose row ids are System core codes: abilities, ability modifier references, roll influences and modes, spell slot pools, effect consume and end events, action traits and sizes.
  - A resolved select drawing directly on one of them carries `unknownOptions: 'REFUSE'`. This field replaces the DTO's `preserveUnknownOptions` boolean with `'PRESERVE'`.
  - Normalization still clears an unknown value, so editors behave as before. It also reports the path in the new `refusedPaths` field of the normalize response.
  - `normalizeIngressValues` throws `The Game System does not define "<value>" at <path>.` Its three callers are publication (`normalizePublicationDocument`), import staging (`stageCustomAuthored.prepareActive`) and class publication (`classPublicationActions`).
  - This covers every authored ability and size select in grants, effects, facets, charge, numericExpr, class and the T9f1 residuals (facet sizes, summon `statBlock.size`, `maximumTargetSize`, `appliesWhen`).
  - Definition-id tables (damage types, alignments and so on) keep clearing a stale reference.
  - `requireAuthoredSizes` is deleted, because the generic check replaces it. Its refusal cases moved to `systemVocabularyOptions.test.ts`. `requireAuthoredAbilities` stays: it checks Creature ability-score record keys, which are not selects.
- **Lights shed the System's two brightest levels.** `sceneLightLevels(levels)` (`shared/vtt/sceneCombatPerception.ts`) feeds `illuminationFromLight` and the renderer's bright and dim bands. No `'BRIGHT'` or `'DIM'` literal remains there.
- **Illumination tables are validated at registration.** `requireSceneIlluminationLevels` refuses an illumination table that:
  - has fewer than two levels;
  - lists a code twice;
  - is misordered: its render class gets brighter down the list, or a light-suppressing level comes before a plain one;
  - lets a light shed a light-suppressing level.
    `createSystemCapabilityRegistry` takes an optional `validate`, and the combat-perception registry passes this check to it.
- **`slotPools` bounded** at 20 entries, the same bound as `sourceClassIds` (`characterRules.ts`).
- **Proofs:**
  - `systemVocabularyOptions.test.ts`: every core-code select reads its table directly; SRD sizes accepted; creature, race and vehicle sizes, a nested attack-slot size and an ability are refused at ingress, while the editor clears them; a stale alignment is still cleared.
  - `vtt-scene-combat-perception.test.ts`: the level tables.
  - `systemCapabilityRegistry.test.ts`: `validate`.
  - `character-rules-contracts.test.ts`: the `slotPools` bound.
  - `creaturePublication.test.ts`: the message.
- **Residual, reported:** summon `abilityScores` (`effects/maps/path.ts` `SUMMON_ABILITY_SCORES_NODE_MAP`) is keyed by six hard-coded D&D ability codes in a shared map, and the schema accepts any core-code key. It is not a select, so the generic refusal does not reach it.

### 2026-10-25: T9f3b, System vocabulary D193 data changes

- **Class `hitpoint.ability` deleted.** The class hit point DTO, authored type, compiler and node map carry `dieConfig` only, and the 12 SRD classes and all fixtures dropped `ability`.
  - Hit point progression rows no longer carry an `abilityIndex`. `characterVitals.ts` applies the System hit point ability (`hitPointFacts.constitutionAbilityIndex`, resolved from `derivedStatisticAbilityCodes.hitPoints`) to every row.
  - Builder (`characterAbilities.ts`, `CharacterHitpointProgression.tsx`) and class detail (`ClassDetail.model.ts`) read the ability from `abilityScoreCapabilityRegistry.require(systemId)`.
- **Telepathic link floor is an authored reference.** `excludesIntelligenceAtOrBelow: number` is now `excludesAbilityAtOrBelow: { ability, score }`, with the ability a System core code (schema, projection, node map `telepathicLinkAbilityFloor`).
  - The Worker (`nativeAreaPreparation.ts`) reads the target's score for the authored ability. No `INTELLIGENCE` read remains.
  - The rule warning is `TARGET_ABILITY_EXCLUDED`, and its inputs are `targetLinkAbilityScore` and `linkAbilityFloor`.
  - The web default factory `telepathicLinkAbilityFloor` is `{ ability: '', score: 0 }` (the author picks the ability).
- **Race ASI snapshot facts store codes.** A fixed increase is `{ ability, value }`, and a summary fact keeps `{ label, value }`. The catalog reader (`builderCatalog.ts`) labels the code from the System's abilities. `contentSnapshots.test.ts` expects the new stored shape; this is an intended contract change.
- **`authoringNodeDefaults`:** `classHitpoint` lost `ability` (and `classAuthoring.utils.ts` defaults to `{ dieConfig: '1d8' }`). `classMulticlassRequirement` and `damageInterceptionSave` default `ability` to `''` so the author picks one (orchestrator ruling). `createAbilityScores` is deleted; a new summon stat block starts with `{}`.
- **Ability score maps keyed by the System (ruling option A).** `NodeMap.keyedBy` plus `buildNodeMap().defineKeyed` declare a map whose nodes are one `entry` per row of a System table. The creature `abilityScores` and `summonAbilityScores` maps use it on `abilities`, so their six hard-coded keys are gone.
  - The resolver expands it with `request.systemId`, gives an empty keyed object a scope, and clears an unlisted key (refused at ingress for core-code tables, which closes the T9f3a summon residual). No transport field changed.
  - The registry signature and `campaignTextPolicy` masking walk the keyed entry.
  - `keyedNodeMaps.test.ts` proves the expansion for a second System (`MIGHT`, `WIT`) and SRD parity (Brown Bear, Arcane Hand). `systemVocabularyOptions.test.ts` now collects table plans from the whole map, keyed rows included.
  - The nodeRuntime guide (`authoring-schema.md`) documents it. No ADR amendment: the guide does not make static maps a load-bearing rule.
- **File budget.** `ACTOR_RELATIONSHIP_MODULE_NODE_MAP` moved from `effects/maps/path.ts` to `actorRelationshipModule.ts`, so `path.ts` is back under budget. The `path.ts` and warlock caps were lowered.

### 2026-10-25: T12a, tiered installed System lists and the tracer System (D195)

- **Five tier lists** in `packages/rules-runtime/src/systems/installedGameSystems/`: `vocabulary`, `policy`, `character`, `encounter` and `runtime`. Each `platform*.ts` composition root declares its tier interface (`GameSystem<Tier>Tier`) and builds every registry from its list. dnd5e exports one module object per tier (`systems/dnd5e/policyTier.ts`, `encounterTier.ts` and the existing modules).
- **Seam allowlist** gained one file under D195: `systems/installedGameSystems/vocabulary.ts` in `SYSTEM_VOCABULARY_SEAM` (`schemaBoundary.test.ts`). A new test asserts the tier closures nest (policy ⊇ vocabulary; character and encounter ⊇ policy and exclude each other; runtime ⊇ all) from esbuild metafiles.
- **Tracer System** (test-only, `src/__tests__/tracer/`): Fate-like approaches, stress, an exchange action, its own events and sizes, 4dF + approach initiative through a published graph. The `tracer` Vitest project aliases the vocabulary, policy, encounter and runtime lists to `tracer/installed/*`, which append the tracer to the dnd5e lists. It runs inside the packages CI suite (`affectedTests.mjs`).
- **Proofs** (`tracerEncounter.test.ts`): actor evaluation by the tracer policy (Quick +3 is +3 initiative, no saves); initiative rolls 12 Fate dice through the frozen graph, orders B, C, A and advances B to C; the exchange action spends, refuses a second and refreshes at turn start; an activation the System lacks binds nothing.
- **dnd5e assumption fixed:** Encounter actor rule reconciliation required one save per ability score from every System and normalized absent saves to `[]`. A System that reports none now passes with `savingThrowDefinitions` absent; one that reports saves must still cover every ability (`encounterActorRuleOutput.test.ts`).
- `testing/initiativePolicySnapshot.ts` gained `pinnedInitiativePolicySnapshot` (any System's graphs); the dnd5e snapshot content is unchanged.
