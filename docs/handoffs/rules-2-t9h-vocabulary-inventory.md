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
| `packages/rules-runtime/src/encounterFormChoice.ts:1,16` | `challengeRatings.findIndex` for CR order (Polymorph filter) | b | the function already takes `system.challengeRatings`; order by the entry's `rank` (ruling 1, S1) |
| `packages/rules-runtime/src/systems/dnd5e/creatureRuleFacts.ts:6,92` | `challengeRatings.find(code)` to get `proficiencyBonus` after the id lookup in `document.challengeRatings` | b | read `proficiencyBonus` from the CR entry on the System record (ruling 1, S1) |
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
| `apps/web/src/forms/guided/GuidedSimpleEffectComposer.tsx:57,59` | `FIRE` damage, `POISONED` condition | default picker values via `system.<list>.find(code)` | `defaults` object on the System record names the definition ids (ruling 2); web reads it through `apps/apis` |
| `apps/web/src/domains/spells/guided/GuidedSpellAuthoring.tsx:75,77` | `FIRE`, `POISONED` | same | same `defaults` object |
| `apps/web/src/domains/characters/sheet/status/ConditionsEditor.tsx:79` | `EXHAUSTION` | hides Exhaustion from the "Add condition" select | a definition attribute on the condition entry (for example `levelled`); the select filters on the attribute, not the code (ruling 2) |
| `packages/rules-runtime/src/encounterPlayerProjection.ts:82` | `INVISIBLE` condition | `invisibleConditionTypeIds(conditionTypes)` picks ids by code | condition attribute on the record entry (for example `unseen`); projection filters on it (ruling 3) |
| `packages/rules-runtime/src/systems/dnd5e/characterMovementAndSenses.ts:174` | `WALK` | primary speed fallback by code (already inside `systems/dnd5e`) | default movement type in the record's `defaults` object (ruling 3) |
| `packages/rules-runtime/src/character/sheetProjection.ts:744` | `WALK`/`WALKING`/label match | neutral file guesses "is this walking" from code **and label** | same `defaults` entry; drop the label heuristic (ruling 3) |
| `packages/authoring/src/imports/importedEquipmentTerms.ts:28-31` | `GP`, `WALK`, `STEALTH`, `DWARVEN` | importer resolves SRD codes against the System record | stays in the SRD importer (System-specific input mapping, not engine branching); constants become the source-data definition ids, no capability (ruling 3) |
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
| T9g | TODO | **core** | `PACT` slot pools are "spell slot pools", named as core in the amendment. Retag (orchestrator, 2026-10-22): `slotCost.poolCode` is a System core code, not a vocabulary code; change the T9g/D175 wording when registering |
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
| **S1 = T9e1** | CR-driven rules read the System record: Polymorph form filter ranks CRs from the System record; creature proficiency bonus, `xp` and an explicit `rank` become fields on each CR entry on the System record (DTO, seed from source-data; no code keyed by CR id, ruling 1); currency `baseValue` and the passive's ability also move onto their record entries; shared `vocabulary/` folder, its barrel line and `SystemAuthored`/`SystemVocabularyKey` deleted; `shared-correctness` and `creatureStatBlocks` tests re-pointed at `source-data`; dev reseed (the DTO gains fields). Proof: Polymorph and creature check journey tests, `source-data` audit asserts CR bonuses and currency ratios | vocabulary | M | none |
| **S2 = T9e2** | Authoring defaults and Sheet condition list from the System record: one `defaults` object on the record names the default damage type and condition ids (seeded from source-data, read by web through `apps/apis`); the condition entry gets a definition attribute (for example `levelled`) that `ConditionsEditor` filters on instead of `EXHAUSTION`; speed label in `collectionPresentation` from the System reference data. Proof: web component tests plus the authoring journey on real capability output | vocabulary | M | none; sequence with S1 (both change the System DTO and seed) |
| **S3 = T9e3** | Player Encounter projection hides Invisible by a condition attribute (for example `unseen`) on the record entry; `invisibleConditionTypeIds` filters on it, no code string. Proof: `encounterPlayerProjection` test, Session Worker projection journey | vocabulary | S | none; sequence with S1/S2 (DTO and seed) |
| **S4 = T9e4** | Walking speed from the record's `defaults` object (default movement type): `sheetProjection.ts` drops the code and label heuristic; `characterMovementAndSenses.ts` reads the default. Proof: Sheet speed/movement tests, movement journey | vocabulary | S | **S2** (creates `defaults`) |
| **S5 = T9e5** | The SRD importer's GP, Walk, Stealth and Dwarven constants become the source-data definition ids it maps to; no capability. Proof: `importedEquipmentTerms` and `importPreparation` tests | vocabulary | S | none |
| **S6 = T9e6** | Boundary test: `packages/shared` exports no vocabulary list and no neutral production file (rules-runtime outside `systems/`, web, authoring) compares a System record `code` to an upper-case literal from the list in section 4. Proof: test fails before S1-S5, passes after | guard | S | S1-S5 |
| T9f | as registered; add ability literals from section 4 (25 files) and mark sizes as core | vocabulary + core | L | S1 (so `AbilityCode`/CR reads are not mixed) |
| T9g | as registered, with D175 wording read as core code | core | M | T9i |

T9e stays as the umbrella of S1-S6, or retire it and register S1-S6 under their own ids. S1, S2 and S3 each change the System DTO and seed data, so sequence them. S4 depends on S2. S5 is independent.

## 8. Orchestrator rulings (2026-10-22)

Vocabulary is authorable data (ADR 0038/0039), so the open questions resolve to System-record data, not dnd5e code.

1. **Challenge rating.** `xp`, `proficiencyBonus` and an explicit `rank` (ordering) go on each CR entry on the System record,
   seeded from source-data. No code capability keyed by CR id: a homebrew System changes XP and proficiency without code.
   Currency `baseValue` and the ability a passive uses also move onto their record entries.
2. **Authoring defaults.** One `defaults` object on the System record names definition ids (default damage type, default
   condition, and so on), seeded from source-data; web reads it through `apps/apis`. It is not a capability. The Exhaustion
   filter is a property of the condition, so the entry carries a definition attribute (for example `levelled`) and the UI
   filters on it.
3. **S3-S5 (same principle: record data first, code names nothing).** S3: Invisible comes from a condition attribute (for
   example `unseen`) and projection filters on it. S4: the default movement type goes in the record's `defaults` object, so
   S4 depends on S2. S5: the SRD importer stays; it is System-specific input mapping, not engine branching, and its constants
   become the source-data definition ids.

Other decisions:

- **Sizes (T9f):** core unless a campaign must add sizes (default; no action needed).
- **T9g:** `slotCost.poolCode` is a System core code.
