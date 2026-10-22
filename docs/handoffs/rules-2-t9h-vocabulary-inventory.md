# RULES-2.T9h: vocabulary vs core inventory

Status: proposal for the orchestrator to review and register. Docs only; no production change.
Measured on `origin/codex/phase-08-2-convex-cutover` at `c09b92d25` (2026-10-22). The session worktree started on a
stale August base, so the branch was cut from that tip.

Terms are those of [ADR 0039, amendment 2026-10-22](../adr/0039-composable-system-neutral-rules-engine.md#amendment-2026-10-22-vocabulary-and-core-codes)
and `CONTEXT.md` ("Reusable definition", "Core code").

## 1. Headline: the ~180-file estimate does not hold

`packages/shared/src/domains/vocabulary/authored` (13 lists, 13 code enums, `Vocabulary`, `SystemAuthored`,
`SystemVocabularyKey`; 1,366 lines) has **5 importing files** on this tip, not ~180. A name grep gives ~350 hits,
but nearly all are false positives (`skills`, `senses`, `currencies`, `languages` are ordinary words and
properties of the System record). Earlier slices already moved the readers to the System record
(`system.conditionTypes`, `srdSystemRecord` from `source-data`, `document.challengeRatings`).

The migration is therefore smaller than sized, but a different class is larger than the brief assumed:
**literal code branches on System record entries** (`item.code === 'POISONED'`) that never import the shared copy.
Section 4 inventories them.

Method: a script parsed every `import { ... } from` in `apps/` and `packages/` (`.ts`/`.tsx`, excluding
`node_modules`, `dist`, `_generated` and the vocabulary folder) whose source mentions `shared`/`authored`/`vocabulary`, and
matched imported names against the exported symbols. Literal branches came from `rg` on the code strings, excluding
`source-data`, tests, fixtures, stories and `testing/`. The script is not committed; the rg patterns are in section 4.

## 2. Direct uses of the shared copy

| Class | Meaning | Files | Symbol imports |
| --- | --- | --- | --- |
| (a) type-only | becomes a plain System code string | **0** | 0 (`*Option`, `Vocabulary`, `SystemAuthored`, `SystemVocabularyKey` have no consumer outside the folder) |
| (b) list read | moves to the System record / Encounter snapshot (web via `apps/apis`) | **5** (3 production, 2 test) | 6 (`speedOptions` 1, `challengeRatings` 3, `currencies` 1, `passives` 1) |
| (c) branch on a specific entry | System capability naming the definition ID | **0** via the enums in production; 1 test file reads `CurrencyCode.*`/`PassiveCode.*` | 2 enum imports (test only) |

Per workspace (production / test):

| Workspace | Files | Class |
| --- | --- | --- |
| `apps/web` | 1 / 0 | b |
| `packages/rules-runtime` | 2 / 0 | b |
| `packages/shared` | 0 / 1 | b + c (test of the lists themselves) |
| `packages/source-data` | 0 / 1 | b |
| `apps/apis`, `apps/session-worker`, `packages/encounter-persistence`, `packages/authoring`, `packages/schema` | 0 / 0 | none |

File list:

| File | Use | Class | Target |
| --- | --- | --- | --- |
| `apps/web/src/forms/rendering/collectionPresentation.ts:8,338` | `speedOptions.find` to label a speed by id, code or label | b | label from the System reference data the page already loads through `apps/apis` |
| `packages/rules-runtime/src/encounterFormChoice.ts:1,16` | `challengeRatings.findIndex` for CR order (Polymorph filter) | b | the function already takes `system.challengeRatings`; rank from the System record |
| `packages/rules-runtime/src/systems/dnd5e/creatureRuleFacts.ts:6,92` | `challengeRatings.find(code)` to get `proficiencyBonus` after the id lookup in `document.challengeRatings` | b | dnd5e capability keyed by CR definition ID (see S1) |
| `packages/shared/src/__tests__/shared-correctness.test.ts:7,8,29-42` | asserts currency base values and `PassiveCode.INVESTIGATION` ability | b + c | delete with the lists; the same facts are asserted against `source-data` (see S1) |
| `packages/source-data/src/srd/creatureStatBlocks.test.ts:1,48` | CR code to proficiency bonus map | b | read `SRD_CHALLENGE_RATINGS`/the capability table instead |

Also in the barrel: `packages/shared/src/barrels/authored/index.ts:6` re-exports the folder. Nothing else
consumes it.

## 3. The shared copy vs `packages/source-data/src/srd/vocabulary.ts`

**No UUID matches in any domain.** `source-data` ids are deterministic (`vocabId(D.<domain>, n)`); `shared` ids are
random UUIDs. The only bridge between the two today is the `code` string, which is exactly the kind of bridge
the amendment removes. Code divergences (shared vs source-data):

| Domain | shared / source-data | Divergence |
| --- | --- | --- |
| challengeRating | 34 / 34 | same codes; shared adds `xp` and `proficiencyBonus`, the System record entry has neither |
| conditionType | 15 / 15 | same codes |
| creatureType | 14 / 14 | same codes |
| currency | 5 / 5 | codes differ: `GOLD/COPPER/ELECTRUM/SILVER/PLATINUM` vs `GP/CP/EP/SP/PP`; shared adds `baseValue` |
| damageType | 14 / 13 | shared has `HEALING`, source-data does not |
| language | 16 / 32 | source-data adds 16 (Aquan, Auran, Ignan, Terran, Druidic, Thieves' Cant, and creature languages) |
| magicSchool | 8 / 8 | same codes |
| passive | 4 / 3 | codes differ: `WISDOM/INSIGHT/PERCEPTION/INVESTIGATION` vs `PASSIVE_PERCEPTION/INVESTIGATION/INSIGHT`; source-data names a `skillDefinitionId`, shared names an ability |
| rarity | 6 / 6 | same codes |
| sense | 4 / 6 | source-data adds `SEE_INVISIBILITY`, `DEVILS_SIGHT` |
| skill | 18 / 18 | same codes |
| speed | 5 / 5 | codes differ: `WALKING/CLIMBING/...` vs `WALK/CLIMB/...` |
| terrain | 7 / 10 | source-data adds `UNDERDARK`, `UNDERWATER`, `URBAN` |

Consequence: deleting the shared copy loses no vocabulary. The `source-data` copy is the superset and the only
one with stable ids. The shared copy carries three facts the record lacks: CR `proficiencyBonus`/`xp`, currency
`baseValue`, and the ability a passive uses. The first is read by `creatureRuleFacts`; the other two only by the shared
test (currency conversion is already exercised through System record data in campaign code, and passives name their
skill on the record).

## 4. Literal-code branches on System record entries (class c, production)

These do not import the shared copy; they compare a `code` string from the System record. Patterns:
`['"](<condition|damage|sense|skill|...codes>)['"]` and `\.code\s*(===|!==)\s*['"][A-Z_]+['"]`, production only.
Event kinds such as `'INCAPACITATED'` in `encounterGrantLifetimes.ts`, `activeRuleEffects.ts`, `eventVocabulary.ts` and
`path.ts` are **core codes** (event kinds), not the Incapacitated condition, and are excluded. `unseenReason: 'INVISIBLE'`
and `visibilityKind: 'INVISIBLE'` are likewise core enums.

| Site | Code | Today | Target capability |
| --- | --- | --- | --- |
| `apps/web/src/forms/guided/GuidedSimpleEffectComposer.tsx:57,59` | `FIRE` damage, `POISONED` condition | default picker values via `system.<list>.find(code)` | dnd5e authoring defaults capability names the definition ids; web gets them from the System reference read through `apps/apis` |
| `apps/web/src/domains/spells/guided/GuidedSpellAuthoring.tsx:75,77` | `FIRE`, `POISONED` | same | same capability |
| `apps/web/src/domains/characters/sheet/status/ConditionsEditor.tsx:79` | `EXHAUSTION` | hides Exhaustion from the "Add condition" select | condition policy capability: the id of the leveled condition, flagged on the reference DTO |
| `packages/rules-runtime/src/encounterPlayerProjection.ts:82` | `INVISIBLE` condition | `invisibleConditionTypeIds(conditionTypes)` picks ids by code | capability (visibility conditions) returns the condition id |
| `packages/rules-runtime/src/systems/dnd5e/characterMovementAndSenses.ts:174` | `WALK` | primary speed fallback by code (already inside `systems/dnd5e`) | name the Walking speed definition id |
| `packages/rules-runtime/src/character/sheetProjection.ts:744` | `WALK`/`WALKING`/label match | neutral file guesses "is this walking" from code **and label** | System movement capability names the walking speed id; drop the label heuristic |
| `packages/authoring/src/imports/importedEquipmentTerms.ts:28-31` | `GP`, `WALK`, `STEALTH`, `DWARVEN` | importer resolves SRD codes against the System record | dnd5e import adapter names the definition ids |
| `apps/web/.../startingEquipmentChoices.ts:11` | `GOLD` | local mode enum `EQUIPMENT/GOLD`, not a currency code | none (core code; keep) |

Ability codes (`STRENGTH` ... `CHARISMA`) are the largest literal family: **25 production files**
(web 6, rules-runtime 11, shared 5, session-worker 1, authoring 1, schema 1) plus `AbilityCode` in
`shared/domains/core/ability.ts`. Abilities have ids in `SRD_ABILITIES` and are vocabulary, so they belong to
RULES-2.T9f and RULES-2.T9e (DEXTERITY/CONSTITUTION literals), not to a new task.

Adjacent: the VTT sense effects (`BLINDSIGHT/DARKVISION/TREMORSENSE/TRUESIGHT` in `vttSceneRenderer.model.ts`) are
derived from sense `channel`/`illuminationAccess` properties, not from the sense code, so they are core (T9d).

## 5. Tag of each open RULES-2.T9* task

| Task | Status | Tag | Reason / wording fix |
| --- | --- | --- | --- |
| T9a | DONE | **core** | `rollMode`/`rollInfluence` have no id and the engine branches on them. Misnamed "vocabulary" |
| T9a2 | TODO | **core** | roll-mode enums, `keep`, evidence labels: all core codes |
| T9b | DONE | **core** | `ROLL_INFLUENCE` plus a System code |
| T9c | TODO | **core** | lifecycle consume/end codes, `ATTACK_ROLL`/`SPELL_CAST` traits, event table: event and trait kinds |
| T9d | TODO | **core** | illumination codes stay codes; the System supplies rank, `suppressesLight` and render class (properties of a code, no ids) |
| T9e | TODO | **vocabulary** | deletes the shared copy, CR order, ability literals, web defaults. Superseded by S1-S6 below; keep as the umbrella or retire it |
| T9f | TODO | **vocabulary + core** | abilities to definition ids is vocabulary. "Sizes list" is core unless sizes get ids; the engine branches on size (grapple limits, space), so default core and ask only if sizes must be campaign-authorable |
| T9g | TODO | **core** | `PACT` slot pools are "spell slot pools", named as core in the amendment. **Conflict:** the T9g note says D175 keeps `slotCost.poolCode` "a System vocabulary code"; read it as a System core code |
| T9h | TODO | n/a | this inventory |

Retitle T9a, T9a2, T9b, T9c, T9d from "System vocabulary" to "System core codes" when registering.

## 6. Rename `systemVocabularyRegistry` to core naming

The registry holds only `rollInfluence` and `rollMode` (see `systems/dnd5e/vocabulary.ts`), both core codes, and is
installed through a pure entry point that imports no execution code (`schemaBoundary.test.ts`). "Vocabulary" now
means the System record, so the name is wrong. Proposed:

| Today | Proposed |
| --- | --- |
| `systemVocabularyRegistry` | `systemCoreCodeRegistry` |
| `createSystemVocabularyRegistry`, `SystemVocabularyCapabilityAdapter` (`systemVocabularyCapability.ts`) | `createSystemCoreCodeRegistry`, `SystemCoreCodeAdapter` (`systemCoreCodeCapability.ts`) |
| `@artificer-toolkit/rules-runtime/platformSystemVocabulary` (pure entry point) | `.../platformSystemCoreCodes` |
| `systems/dnd5e/vocabulary.ts`, `dnd5eVocabularyCapabilityAdapter` | `systems/dnd5e/coreCodes.ts`, `dnd5eCoreCodeAdapter` |
| `schema/shared/systemVocabularyCode.ts`: `systemVocabularyCodeSchema`, `systemVocabularyEntrySchema`, `SystemVocabularyEntryDto` | `systemCoreCode.ts`: `systemCoreCodeSchema`, `systemCoreCodeEntrySchema`, `SystemCoreCodeEntryDto` |
| authoring `systemVocabularyRows`, `policyVocabulary` (`systemSourceRows.ts`) | `systemCoreCodeRows`, `coreCodes` |
| `lists: { rollInfluence, rollMode }` kind names | unchanged |

Keep as is (genuine vocabulary): `SystemVocabularySnapshot` (`schema/projections/systemVocabulary`),
`readSystemVocabularySnapshot`, `resolveSystemVocabulary`, `ImportSystemVocabulary`; they carry the System record's
ID-backed lists.

Blast radius (files): registry 10, `platformSystemVocabulary` 9, `systemVocabularyCapability` 6, `systemVocabularyCode`
45 (`systemVocabularyCodeSchema` 25, mostly `packages/schema`), `dnd5eVocabularyCapabilityAdapter` 41 (36 are
`packages/authoring` parity tests, 2 web, 3 rules-runtime), plus `docs/architecture/rules-runtime.md` and `transport.md`,
`apps/apis/convex/schemaBoundary.test.ts` (the pure-entry-point guard by path) and `apps/apis/convex/authoring/systemSources.ts`.
About 90 files, mechanical, no behaviour change.

## 7. Proposed tasks (vertical slices)

Sizes: S under half a day, M about a day, L multi-day. All close RULES-2.7. WSJF to be scored at registration.

| Id | Slice (user-visible behaviour or boundary proved) | Class | Size | Depends on |
| --- | --- | --- | --- | --- |
| **T9i** | Rename to core naming (section 6) incl. docs and `schemaBoundary.test.ts` path guard. Proof: existing registry, roll-mode and boundary tests green unchanged | core | M (mechanical, ~90 files) | none; land **before** T9a2 and T9c so they build on the new names |
| **S1 = T9e1** | CR-driven rules read the System record: Polymorph form filter ranks CRs from the System record; creature proficiency bonus comes from a dnd5e capability keyed by CR definition ID (or `rank`/`xp` on the CR entry, see question 1); shared `vocabulary/` folder, its barrel line and `SystemAuthored`/`SystemVocabularyKey` deleted; `shared-correctness` and `creatureStatBlocks` tests re-pointed at `source-data`; dev reseed if the DTO gains fields. Proof: Polymorph and creature check journey tests, `source-data` audit asserts CR bonuses and currency ratios | vocabulary | M | none |
| **S2 = T9e2** | Authoring defaults and Sheet condition list from the System: Fire/Poisoned defaults in the effect composer and spell authoring, Exhaustion exclusion in `ConditionsEditor`, speed label in `collectionPresentation`; a dnd5e capability names the definition ids and `apps/apis` exposes them on the System reference read. Proof: web component tests plus the authoring journey on real capability output | vocabulary (c) | M | S1 not required; touches different files |
| **S3 = T9e3** | Player Encounter projection hides Invisible by capability: `invisibleConditionTypeIds` takes the id from a dnd5e visibility capability; no code string in neutral projection. Proof: `encounterPlayerProjection` test, Session Worker projection journey | vocabulary (c) | S | none |
| **S4 = T9e4** | Walking speed by definition id in Sheet and movement: dnd5e names the Walking speed id; `sheetProjection.ts` drops the code and label heuristic; `characterMovementAndSenses.ts` uses the id. Proof: Sheet speed/movement tests, movement journey | vocabulary (c) | S | none |
| **S5 = T9e5** | Imported equipment terms resolve through a dnd5e import adapter that names the GP, Walk, Stealth and Dwarven definition ids. Proof: `importedEquipmentTerms` and `importPreparation` tests | vocabulary (c) | S | none |
| **S6 = T9e6** | Boundary test: `packages/shared` exports no vocabulary list and no neutral production file (rules-runtime outside `systems/`, web, authoring) compares a System record `code` to an upper-case literal from the list in section 4. Proof: test fails before S1-S5, passes after | guard | S | S1-S5 |
| T9f | as registered; add ability literals from section 4 (25 files) and mark sizes as core | vocabulary + core | L | S1 (so `AbilityCode`/CR reads are not mixed) |
| T9g | as registered, with D175 wording read as core code | core | M | T9i |

T9e stays as the umbrella of S1-S6, or retire it and register S1-S6 under their own ids. S1-S5 touch disjoint
files and can run in parallel in separate worktrees; S1 and S2 may both change the System reference DTO or seed data
depending on the answers to questions 1 and 2, so sequence those two if both choose "data on the record".

## 8. Questions for the user

1. **CR rank and proficiency bonus.** The System record's CR entries carry neither. Recommendation: an explicit
   `rank` (neutral ordinal) on the record, and the proficiency-by-CR table as a dnd5e capability keyed by CR definition id,
   because proficiency by CR is a D&D rule. The alternative, `xp` and `proficiencyBonus` as record fields, is simpler but puts a
   D&D rule in the neutral DTO.
2. **Defaults and policy flags on the reference DTO (S2).** Recommendation: a small `systemDefaults` object produced by the
   dnd5e capability (default damage type, default condition, leveled condition id), not per-entry flags on every list.
3. **Sizes (T9f):** core unless a campaign must add sizes. Default is core; no action needed unless the user disagrees.
