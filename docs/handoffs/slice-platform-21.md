# Slice PLATFORM-21.T1: the engine loads compiled content instead of recompiling

- **Closes:** PLATFORM-21.1 (compile once), PLATFORM-21.2 (stale projections migrate)
- **Decision:** user, 2026-10-17, option a: compile once at publish, as ADR 0003 describes
- **Branch:** `claude/platform-21-t1-28796e` → `ci/platform-21-t1a` (T1a, D163)
- **Status:** T1a in progress: v2 compiler fields, resolved Equipment row, stale-row migration and the registry/presentation split done; validating, then the dev-data migration run and CI

## Current state (verified 2026-10-19)

Publication and import already compile once and store the result in `authoredVersionCompilations`
(`compilePublicationDocument`, `apps/apis/convex/content/publicationDocument.ts`):
`{compilerVersion: 'subject-compiler-v1', projectionSchemaVersion: 1, authoredChecksum,
projectionChecksum, projectionJson}`. A compile error already throws inside the publish mutation.
Nothing reads that projection for evaluation. Every evaluation recompiles from authored records:

| Call site                                                                   | Compiles                                                       | Reached from                                                                                         |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `rules-runtime/character/characterRuleSnapshot.ts` `createAssemblyRegistry` | background, class, feat, every nested feature, race, equipment | Convex commit and Sheet, browser Builder Web Worker, Session Worker room (`nativeCharacterRules.ts`) |
| same file, `assembleCharacterRuleSnapshot` / `assembleCompanions`           | acquired-revision equipment, companion loadout equipment       | same                                                                                                 |
| `characterSpellCastActions.ts`, `characterSpellActionRuleFacts.ts`          | spell                                                          | Sheet and room actions                                                                               |
| `builderEligibility.ts`                                                     | feature                                                        | Builder                                                                                              |
| `encounterCreatureEquipmentSources.ts`, `content/creatureLoadoutHands.ts`   | creature loadout equipment                                     | Encounter / room                                                                                     |

All three evaluators reach the registry through `prepareCharacterRuleContext` and its injected
readers (Convex `characters/context.ts` readers; `createSnapshotReaders` over R2 snapshot objects for
the browser and the room). Snapshot `documents` parts carry authored roots plus aligned `versions`
pins, and no compilation.

Two shape gaps: the stored Equipment projection is `compileEquipment` (variant-shaped), while the
engine needs `compileResolvedEquipment` (resolved, `parentEquipmentIds`); and the registry's
`features` map is built from every nested feature, which the stored subject projections already
hold compiled inside their parent.

## Plan

1. **Projection version.** `compilerVersion` becomes `'subject-compiler-v2'` (one exported constant
   in `packages/shared` beside the compilers, which `authoredStoredCompilationSchema` reads). v2
   stores Equipment in its resolved engine shape and is the only accepted literal; v1 rows are
   migrated, not read.
2. **Hydration seam.** The readers return each publication with its stored compilation
   (`AuthoredPublicationDocument & {compilation}`), and `CharacterRuleRegistry` carries the parsed
   compiled projection beside each authored record. `createAssemblyRegistry` and the spell, eligibility
   and companion sites read compiled projections; the nested `features` map is taken from the
   compiled parents. Hydration fails closed when `compilerVersion` is not current or
   `authoredChecksum` differs from the publication's stored checksum (the snapshot `versions` pin or
   the Convex version row): a stale projection is never read.
3. **Snapshots.** `documents` objects gain an aligned `compilations` array beside `versions`
   (format 3, `v3/` keys; no format 2 compatibility, pre-launch). Build validation binds each entry
   to its root and pin checksum.
4. **No runtime compilers.** The compile imports leave `rules-runtime/character`,
   `encounterCreatureEquipmentSources.ts` and `creatureLoadoutHands.ts`; a lint/test guard proves
   no evaluation module imports `shared/subjects/compilers` or `shared/compilers`.
5. **Publish failure.** A compile failure returns its diagnostics through the publish result's
   existing error contract; a test proves the publish is refused and nothing is stored.
6. **Migration (PLATFORM-21.2).** `apps/apis/convex/content/compilationMigration.ts`, a
   `@convex-dev/migrations` definition like `rules/modifierOperationMigration.ts`: for each
   `authoredVersionCompilations` row whose `compilerVersion` is not current or whose
   `authoredChecksum` no longer matches its version, recompile from the stored version (with resolved
   parents for subraces and variants) and replace the row. Development data: run against the local
   container in a heavy batch, then rebuild snapshot heads (format 3).
7. **Measurement.** A Vitest bench under `packages/rules-runtime` over SRD fixtures (level-5 Fighter
   and Wizard, plus one room preparation): median and p95 of `prepareCharacterRuleContext` +
   `assembleCharacterRuleSnapshot` + sheet preparation, before (phase tip) and after, same machine,
   same fixtures. Results in `docs/validation/platform-21-evaluation-cost.md`; raw logs under
   `local-validation/platform-21-t1/`. The commit read budget test reports read bytes before and after.

## Ruling needed (sent to the Lane 1 orchestrator 2026-10-19)

D84 moved the compilation off `authoredVersions` precisely so Builder commit does not read it, and
commit is budgeted at 450 KB (one Class). PLATFORM-21.1 says the engine loads the stored projection
and no evaluation recompiles; commit runs the same engine. Options:

- **(a, recommended)** Commit reads the compilation row of each referenced version (one more
  document per root); measure it in `commitReadBudget.test.ts`; if a case exceeds 450 KB, amend the
  D84 budget with the measured number. One engine path. Size is unmeasured: subject compilers drop
  presentation metadata (ADR 0003), so the row may be smaller than the payload, but no projection
  byte count exists yet (packages are not built in this worktree). The first step of (a) is to
  measure it in `commitReadBudget.test.ts` before any other code changes.
- **(b)** Commit keeps compiling in its transaction as server re-validation, and only the browser
  Builder and the room hydrate. Keeps D84 intact but leaves two compile paths and contradicts the AC
  literally.

Also in the packet: snapshot `documents` format 3 (ADR 0036 amendment), implied by "the room loads
the stored projection".

## Log

- 2026-10-19: plan written; awaiting the ruling.
- 2026-10-19: orchestrator ruling (to be recorded as D163 once measured): option (a), one engine
  path; commit hydrates from the compilation rows; (b) rejected. Measure first: compilation row
  sizes and the commitReadBudget cases with commit reading those rows. If every case fits 450 KB for
  one Class and 650 KB for two, proceed and note in persistence.md and ADR 0036 that commit reads the
  compilation and no longer compiles. If over, check whether commit still needs the raw Class payload
  once the compilation is loaded and read the compilation instead when the payload is only compile
  input. If still over, stop and report the numbers; the D84 budget is the product owner's call.
  Confirmed: snapshot documents format 3 with aligned `compilations` (`v3/` keys, ADR 0036
  amendment), `subject-compiler-v2` with resolved Equipment, a `@convex-dev/migrations` recompile
  run on dev data in the same change, no format 2 reader.
- 2026-10-19: measured (convex-test, the `commitReadBudget` counter, SRD level 5, all compilation
  rows attached as the seed does; uncommitted harness, logs in `local-validation/platform-21-t1/`).
  KB of commit read plus write:

  | Case                 | Today | + compilation rows | Full swap (compilation instead of every payload) | Full swap + slimmed projection | Budget |
  | -------------------- | ----- | ------------------ | ------------------------------------------------ | ------------------------------ | ------ |
  | Fighter 5 / Champion | 361.6 | 527.1              | 324.1                                            | ~319                           | 450    |
  | Wizard 5 / Evocation | 416.3 | 616.5              | 404.5                                            | ~399                           | 450    |
  | Fighter 3 / Wizard 2 | 580.9 | 875.7              | 524.8                                            | ~519                           | 650    |

  Compiled projections carry almost no presentation text: labels, descriptions and instructions are
  about 5 KB per case; the bulk is structure (ids and grant fields). Spell compilations are larger
  than their payloads (Wizard: 83.5 KB against 62.4 KB). The counter JSON-escapes `projectionJson`,
  so compilation rows count 13-20% above their raw size; the table keeps the counter's numbers.
  An audit of the commit path found the Class payload is not compile input only today: Builder code
  reads authored-only fields (`subclassSelectionLevel`, `spellcasting.availableAtLevel`, proficiency
  `scalingKind`/`restrictions`, the `grants.*`/`progression.levels` shape, the subclass label used as
  a spell-source alias, the authored feature checksum identity guard). The full swap needs those in
  the v2 projection and the Builder reads moved to compiled shapes. Spell, Race, Equipment and
  Background payload use was not audited. Coding paused for the orchestrator's ruling.

- 2026-10-19: ruling D163: option 1, the full swap, no budget change. Split in the ledger:
  **PLATFORM-21.T1a** (this session, closes PLATFORM-21.2): `subject-compiler-v2` carries every field
  the Builder reads (the Class list above plus whatever the Spell, Race, Equipment and Background
  audit finds), stores Equipment resolved; Builder and rules-runtime reads move onto the compiled
  shapes while compiling still happens at runtime (behavior-preserving, proved by the existing tests
  plus one per moved field); the `@convex-dev/migrations` recompile of stale rows, run on dev data;
  lands green alone on `ci/platform-21-t1a`. **PLATFORM-21.T1b** (after T1a, closes PLATFORM-21.1):
  hydrate commit, the browser Builder and the room from stored rows, remove runtime recompilation,
  snapshot documents format 3 and the ADR 0036 amendment, publish blocked on compile failure,
  before/after measurements under `docs/validation/`. If a payload must stay raw and Wizard 5 then
  exceeds 450 KB, stop and report.
- 2026-10-19: audit of Race, Background, Feat, Equipment and Spell reads (commit path = `commit.ts`
  → `prepareCharacterBuilderFromContext` → `evaluateCharacterRules` → `loadCharacterSheetFacts`).
  Rules/eligibility fields v2 must gain beyond the Class list: Race label, ancestry and option labels
  (commit sourceLabels, issue messages), the subrace's own-versus-inherited feature split
  (`characterBuilderSelections.ts` RACE vs SUBRACE provenance); Background label; proficiency grants
  keep `scalingKind`/`restrictions` for every owner (Class, Background, Feat). Reader-only moves:
  Feat and Background chosen-grant owners read the compiled top-level grant arrays; feat spell-grant
  detection (`characterContextSpells.ts`) reads compiled `spells`; Race/Background feature-option
  filtering (`builderEligibility.ts` `filterRegistryFeatureOptions`) works over compiled features.
  T1b concerns: the Spell `systemId` hydration guard (`characterRuleEvaluation.ts`), the room's
  initiative checksum of the authored Spell (`encounterInitiativeDeclarationSources.ts`) and the
  `WeakMap` cache keyed on the authored Spell (`characterSpellCastActions.ts`). Prose (descriptions,
  details, quotes, material descriptions, feature descriptions) is read only by presentation (Sheet,
  Builder view, room), except the race/background catalogue description computed as a side effect on
  commit. Ruling requested on keeping prose out of v2 (presentation reads authored prose through an
  optional lookup that commit omits); carrying it would rebuild the payload and push Wizard 5 over.
- 2026-10-20: prose ruling (D163 amended): v2 carries rules fields and labels; prose stays in the
  authored payload and views read it through a presentation lookup by id. Conditions: commit persists
  no prose-derived value; descriptions are optional only at the rule-registry/commit boundary while
  presentation types stay strict; a test proves commit with and without the lookup gives the same
  readiness and writes. Audit: no Race/Background prose is persisted; `retainedRulesJson`
  (`content/acquiredEquipmentRules.ts`) stores full Equipment variant-chain and granted Spell
  documents, prose included, in `characterInventoryItems`. Ruling requested (option A: retain v2
  projections, migrate dev rows; option B: retained revisions keep prose).
- 2026-10-20: done and green in the light lane: `content/compilationMigration.ts` (+ test: superseded
  Background, Class, Equipment base and variant, Race base and subrace rows recompile to the
  publication compilation; second pass idempotent). `readAuthoredVersionCompilation` throws on a
  superseded row instead of handing v1 to a consumer. The table validator admits v1|v2 until T1b.
  Refactor plan: `CharacterRuleRegistry` holds compiled records (compiled at runtime in
  `prepareCharacterRuleContext` until T1b); `CharacterRuleContext.presentation` (optional) carries the
  authored records by id; `resolution.grants` drop prose; Builder/Sheet views take the lookup as a
  required input and join prose by id.
- 2026-10-20: registry split landed in the tree. `CharacterRuleRegistry` holds compiled records, built by
  `compileCharacterRuleSources` (`contextPreparation.ts`), which also returns the
  `CharacterPresentationLookup` (authored races, classes, backgrounds, feats, every nested and wanted
  feature, equipment, by id). `CharacterRuleContext.presentation` is optional (commit never reads it);
  `prepareCharacterRuleContext` always sets it and Sheet preparation, `projectCharacterSheetBundle`,
  `buildCharacterSheetPanel` and `toCharacterBuilderPayload` require it. Builder grants carry rules
  facts only; `withGrantProse` (`characterRuleContext.ts`) joins feature, resource and spellcasting prose
  by id in the views and throws on a missing record, so a view cannot render a silent blank. Tests:
  `compiledBuilderFields.test.ts` (each moved v2 field over the SRD) and
  `commitWithoutPresentation.test.ts` (commit with and without the lookup: same readiness, Character
  and stored stats).
- 2026-10-20: ruling C landed in the tree. `acquiredEquipmentRulesSchema` pins one EQUIPMENT leaf and its SPELL
  sources, each with a copy of the version's stored compilation (`authoredStoredCompilationSchema`) and a
  `presentation` block; `readAcquiredEquipmentRules` verifies both checksums and hydrates `CompiledEquipment` /
  `CompiledSpell` with no compile call. Engine spell maps are `CompiledSpell` (`spellsById`); current authored
  Spells stay in `currentSpellDocumentsById` and compile once at the context boundary
  (`compileCharacterRuleSpell`). `compilePublicationDocument` moved to `rules-runtime/authoredPublicationCompile`
  so fixtures pin real compiler output (`testing/pinnedRetainedRules.ts`). `content/compilationMigration` adds
  `repinCharacterRetainedRules` and `repinPartyRetainedRules` after the recompile step. Proofs:
  `retainedRulesWithoutCompile.test.ts` (compilers spied, none called) and `equipmentSourceLoss.test.ts` (Sheet
  keeps the pinned description after the source is deleted). Known gaps: Equipment Feature prose is not pinned,
  so a retained-only item's feature descriptions render empty; retained Spell prose is stored but no view reads it
  yet (Sheet spell lists read the catalogue index, so a retained-only Spell was absent before too).
- 2026-10-20: **PLATFORM-21.T1a2** (`ci/platform-21-t1a2`, D163 source-facts versioning). Stored `authoringSources`
  carry `factsVersion`; the seed and `content/sourceMigrations:backfillAuthoringSources` re-derive an older or
  absent version (cause: 7237c161b added `proficiency_grant_equipment` without refreshing stored facts). The local
  seed then stopped at SRD Halfling: SPELLS-32 retired the closed Race rule kinds (0c64e71a5 and siblings) without
  refreshing the stored canonical documents, so replacing a base Race recompiled its stored Lightfoot child, which
  the current schema rejects, and replacing the child first read the stale parent. No user-owned row was affected
  (all 1057 local roots parsed offline: 317 Creature and 3 Race failures, all canonical). Fix (ruling, folded in):
  the seed passes `reimportedSubjectIds` (changed subjects later batches replace) to `importSubjects`, and a parent
  replace's dependent recompile (`readRecompiledDependent`, shared by Race and Equipment) leaves those to their own
  import; any other dependent that does not parse fails, naming the row. Canonical rows refresh through the seed,
  which can now always do so. Proofs in `content/import.test.ts`: a Race and an Equipment family replaced over a
  retired stored dependent, and a non-reimported broken dependent refused by name.
  The seed next stopped at definitions: 8786d4527 added `contractVersion`, `publishedAt` and `publishedBy` to the
  seeded definition record without backfilling stored rows (all 61 local rows lacked them). `importDefinitions` now
  backfills absent publication metadata on a canonical row and still refuses a different present value (proof in
  `content/import.test.ts`).
- 2026-10-20: **PLATFORM-21.T1b** (`ci/platform-21-t1b`, D163 rulings #1 B with addendum and #2 A). Roots carry
  `catalogue.publishedActive` for every kind (`catalogue.spell.publishedActive` removed, no alias) and RACE, CLASS
  and BACKGROUND picker facts derived once at publish by `toContentSnapshotIndexEntry` (`rootCatalogueFacts`,
  `catalogueMetadata.ts`). Share and parent-chain authorization (`campaigns/contentAccess.ts`,
  `requireParentRoots`), the subclass and Spell witnesses and commit's rule publications
  (`toCharacterRuleFactsPublication`) and the held-item capture (ruling #3: `catalogue.equipment.quote`) read root
  rows only; Equipment pickers read `equipmentOptions.builder` with
  no payload fallback. `compilationMigration:run` gains `backfillRootCatalogueFacts`. The Sheet evaluator no longer
  requires presentation; the Sheet and turn-action projections require it. Proofs: `rootCatalogueFacts.test.ts` (status
  transitions), the migration backfill test, and `commitReadBudget.test.ts` (every payload unreadable before
  commit). Local data: the catalogue validator rejects stored `spell.publishedActive`, so the local backend needs
  a reseed (standing approval) before the schema push.
- 2026-10-20: **PLATFORM-21.T1b** finished in the tree (rulings #2 A and #3 A folded in). Encounter Creature
  `equipmentSources[]` pins hold the stored compilation. The room, blueprint snapshots and `creatureLoadoutHands`
  hydrate it, and `encounters/equipmentPinMigration` runs as steps of `compilationMigration:run`, which is now the
  only runner. The held-item capture builds its presentation from the root and `catalogue.equipment.quote`.
  `catalogue.publishedActive` treats an absent status as active, because canonical documents carry none and
  publication always writes `ACTIVE`; shares and held-item capture keep their earlier behaviour. Import compiles
  a base Race at insert, like base Equipment. Tests import canonical subjects through `importSeededSubjects`
  (`tests/fixtures/publication.ts`): the import, then the seed's derived step. Without runtime recompilation, a
  fixture that skips that step fails closed. Compile failure blocks publish:
  `racePublication.test.ts` "preserves state on unauthorized, stale, invalid-parent…" refuses a compile-step
  failure and leaves stored state unchanged; the Creature schema mirrors every compiler check, so no
  schema-valid Creature reaches a compiler failure. Measurements: `docs/validation/platform-21-evaluation-cost.md`
  (commit Fighter 5 313.8 KB, Wizard 5 385.9 KB, Fighter 3/Wizard 2 509.3 KB).
  Local dev data needs, in order: a reseed (standing approval), `content/compilationMigration:run`, a format 3
  snapshot rebuild, and a Session Worker room reset (Durable Object SQLite keeps old pins). These are known gaps,
  dev data only. Pending contest and action pins of snapshot checksums are not rewritten.
  `encounterBlueprintUpdates.resultJson` receipts keep the old pin shape.
