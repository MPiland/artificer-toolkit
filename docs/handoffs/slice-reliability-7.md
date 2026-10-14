# Slice workbook: RELIABILITY-7 (the web uses the shared resolver and rules instead of copies)

**Status:** DONE (merged `e031c2738`; closed by the main session 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Two copies of product logic live in the web.

1. **RELIABILITY-7.1.** `apps/web/src/forms/node-map/staticResolvedModel.ts` (493 lines) mirrors the server's `nodeRuntimeService.ts`, embeds fixture options (Sorcerer, Wizard, Shortsword, Evocation and more roots than the server registry), and is imported by the production hook `useAuthoringResolvedModel.ts:39-50`. Authoring stories and tests must resolve node maps through the real `packages/authoring` resolver over an in-memory registry; delete the static copy and its fixture options from the production bundle.
2. **RELIABILITY-7.2.** The Builder, class detail and Creature stat blocks compute hit points, hit-die averages, ability modifiers and proficiency bonus locally: `characterAbilities.ts:1-222`, `CharacterHitpointProgression.tsx:81-127`, `ClassDetail.model.ts:94` and `321-331`, `CreatureDetail.model.ts:306`, `EncounterEnemyStatBlock.tsx:80`. Use the shared rules-runtime functions (ADR 0036; the server already uses them in `builderHitPoints.ts:108-146` and `characterVitals.ts:175`). Delete the legacy hit-point override and its "HP gained (legacy)" input, remove the field from the contract, and migrate development data in the same change (the main session resets and reseeds after merge).

Read first: the RELIABILITY-7 ledger entry and notes; ADR 0036; AGENTS.md "Web Folder Organization" (node maps resolve on the backend; only harnesses build forms locally); `packages/authoring` resolver entry points.

## Closes

- RELIABILITY-7.1 and RELIABILITY-7.2 (then RELIABILITY-7 is DONE once the journey is verified).

## File scope

`apps/web/src/forms/node-map/*`, `useAuthoringResolvedModel.ts`, authoring stories and test harnesses that import the static model, the Builder hit-point and ability files named above, `ClassDetail.model.ts`, `CreatureDetail.model.ts`, `EncounterEnemyStatBlock.tsx`, the hit-point override field in `packages/schema` and its Convex reads and writes, and their tests. Out of scope: prop-to-state reset fixes (RELIABILITY-9.T1 session owns `CharacterBuilderAuthoringRuntime.tsx`), the action drawer and VTT stage.

## Red-first checklist

1. An authoring story or test resolves a node map through `packages/authoring` and gets the server's options (red today: the static copy returns its embedded fixtures, for example roots the server registry lacks).
2. A production bundle check (or import-graph test) proves `staticResolvedModel` and its fixtures are absent from production code.
3. Builder, class detail, Creature detail and the Encounter enemy stat block show the same hit points, hit-die average, ability modifiers and proficiency bonus as the server for real SRD content, including one case where the local copy disagrees today (find it; if none disagrees, record why the test would still catch drift).
4. The legacy override is gone from the contract, the UI and stored development data; a Character that had one reads its hit points from the shared rules.

Storybook cannot run in a worktree: list the stories to run after merge in the status log.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: implemented on `claude/clever-panini-865ecb`; base `codex/phase-08-2-convex-cutover` merged. Logs live in the main checkout under `local-validation/reliability-7/`.
- 2026-10-14: review round (nested group editors, one reader factory, shared `resolveNestedRuntimeScopes` and `abilityModifier`, override test deleted, utils moved to `src/test`); base merged a third time. Final logs are the `g-*` and `h-*` set.

### Checklist evidence

| # | Proof | Red log | Green log |
| --- | --- | --- | --- |
| 1 | `useAuthoringResolvedModel.test.tsx` (the hook never serves an embedded copy) and `nodeRuntimeResolver.test.ts` (all SRD classes and speeds come from the real `packages/authoring` resolver) | `red-web-reliability-7` | `green-web-reliability-7-final`, `m-green-web-reliability-7` |
| 2 | `FormArchitectureBoundaries.test.ts`: the files are gone, production web code imports neither `@artificer-toolkit/authoring` nor `staticResolvedModel`, and nothing outside `src/test` or a `tests` folder imports `#test/*` | `red-web-reliability-7` | `h-green-web-reliability-7` |
| 3 | `sharedRulesParity.test.ts` (real SRD Fighter, Wizard, Barbarian and multiclass through the real server evaluation; class detail hit-die average and proficiency bonus for 20 levels; Creature modifiers for scores 1-30) and the new `EncounterEnemyStatBlock.test.tsx` describe | `red-web-reliability-7` | `green-web-parity-final`, `h-green-web-reliability-7`; `g-green-rules-runtime` (87 files) for the shared `abilityModifier` callers |
| 4 | `character-rules-contracts.test.ts` (contract drops `overridden`) (the Convex validator is built from this schema, so a stored `overridden` is rejected; the reset and reseed is the migration, see below) | `red-schema-contract` | `g-green-schema-contract` |
| 5 (review) | `AuthoredDomainAuthoringLayout.test.tsx` "renders a freshly added Creature sense editor while the root model has no scope for it": a nested group editor whose row the root model has no scope for resolves its own model (`FormRenderer.tsx`) | `r3-red-nested-editor` (combobox not found) | `h-green-web-reliability-7` |

Item 3, the case where the local copy disagreed: a custom class with hit die `2d6`. The web copy recomputed the stored rows as 8 and 6, while the server (shared `parseHitDie` returns no die) keeps the stored 10 and 5. Real SRD content did not disagree (the dice are all `1dN`), so those cases stay as drift guards: a reintroduced local copy would have to match the shared functions at every level and score to stay green.

### What changed

- 7.1: deleted `forms/node-map/staticResolvedModel.ts` (+ test) and `withStaticResolvedScopes.ts`. `useAuthoringResolvedModel` now uses the provided model or the backend resolution, nothing else. Stories and tests resolve through `apps/web/src/test/nodeRuntimeResolver.ts` (real `packages/authoring` resolver over the in-memory SRD, same reader contract as `createSystemSourceReader`). `packages/authoring/src/nodeRuntime/systemSourceRows.ts` is new: the vocabulary and sort helpers the Convex reader and this harness now share. `@artificer-toolkit/authoring` is a web devDependency (tests and stories only; the architecture test pins that).
- 7.2: new `rules-runtime` `hitPointRules.ts` (`parseHitDie`, `hitDieAverage`, `hitPointGain`) and `proficiencyBonus.ts`. The Builder (`characterAbilities.ts`, `CharacterHitpointProgression.tsx`, `CharacterAbilitiesStep.tsx`), class detail, Creature detail and the Encounter enemy stat block call them; the server paths (`builderHitPoints.ts`, `characterVitals.ts`, `characterModifiers.ts`, `characterDerivedStats.ts`) were folded onto the same functions, which also removed a third copy of the proficiency table.
- Legacy override: `overridden` removed from `characterHitpointLevelEntryDtoSchema`, the API contract and the shared type; the "HP gained (legacy)" input is gone.
- Docs: `docs/architecture/authoring-schema.md` (no web resolver copy; harness location), `docs/architecture/character.md` (shared hit point rules in the browser evaluation).

### Validation run

Final runs on the tree after the review round and the third base merge (RELIABILITY-3 and VTT_UI-5 `874e37636`), all exit 0 (logs in the main checkout under `local-validation/reliability-7/`):

- `g-build-*`: package builds in dependency order.
- `g-green-schema-contract` (1 file, 4 tests), `g-green-authoring` (7 files, 71 tests), `g-green-rules-runtime` (87 files, 991 tests): from the root `vitest.config.ts`; the file counts match the package directories.
- `h-green-web-reliability-7`: 14 files from `apps/web` with the web `vitest.config.ts` and `--project=unit` (the 12 earlier files plus `src/test/authoredRouteStory.utils.test.ts` and `src/domains/authoredRouteStory.fixtures.test.ts`); the file count matches the 14 listed. (`g-green-web-reliability-7` was exit 1 for two assertions fixed afterwards: the speed matcher and the boundary test's handling of `forms/tests`.)
- Typechecks `h-tc-shared`, `h-tc-schema`, `h-tc-rules-runtime`, `h-tc-rules-runtime-tests`, `h-tc-authoring`, `h-tc-web-app`, `h-tc-web-tests`, `h-tc-web-stories`, and `h-tc-apis-build` (covers the rewritten `systemSources.ts` and `authoredSources.ts`).

### Owed to the main checkout after merge

- `codegen:convex` against the local backend (refreshes `apps/apis/convex/_generated/api.d.ts`: seven stale `overridden?: boolean` entries for the removed field). Not run here: the worktree has no `apps/apis` dependencies.
- `typecheck:convex` (Convex test typing). In the worktree it fails only because `convex-test` and `@convex-dev/*` do not resolve (`tc-apis-convex` log); every non-environmental error there cascades from that. The touched Convex code (`authoredSources.ts`, `systemSources.ts`) passes `tc-apis-build`.
- Convex tests that read Character hit points (anything using `hitpoints.levels`).

### Stories to run after merge (Storybook cannot run in a worktree)

- All authored route stories, which now take their model from the real resolver: `{Background,Class,Creature,Equipment,Feat,Race,Spell,Vehicle}{Create,Edit}Route.stories.tsx`.
- `forms/previews/EquipmentParentPreview.stories.tsx`, `CampaignEncounterBuilderPage.stories.tsx`, `CampaignSettings.stories.tsx`, `SystemDetailPage.stories.tsx`.
- `CharacterBuilderAuthoringRuntime.stories.tsx` (Builder abilities and hit point steps: no "HP gained (legacy)" input, MANUAL method asks for a roll).
- Check the Creature and Encounter stat block stories for unchanged modifiers.

### Development-data migration

The main session resets and reseeds after merge. Stored `hitpoints.levels[].overridden` is not tolerated: `characterBuildStates` is Convex-validated (`zodToConvexFields(characterStoredBuildStateSchema.shape)`), so a stored row that still has the field is rejected until the reset and reseed removes it. There is no legacy-data handling (pre-launch); the reset and reseed after merge is the migration. The contract no longer carries the field (`character-rules-contracts.test.ts`). A MANUAL Character with no roll for a level now requires one instead of falling back to the override.

### Deviations

- Hit die `2d6` finding (item 3) and the proficiency level 0 edge: the web returned 1 where the server returns 2. Unreachable through SRD progression tables, so not covered by a test; the shared function is the single source now.
- The third proficiency copy in `characterDerivedStats.ts` was folded in, not only the web copies.
- `GuidedEntryJourneys` and `AuthoredDomainAuthoringLayout` stubbed the normalizer; they now use the real one. This exposed fixtures with relationship IDs that are not in the SRD (equipment, speed): the real normalizer clears them, which opens the "Clear hidden values?" confirmation. Fixtures now use real SRD IDs (`authoredRouteStory.fixtures.ts` speeds are the SRD speeds; the SRD walking code is `WALK`).
- A form with `resolveModel: false` and no provided model now renders nothing (the static branch used to render something). Test harnesses supply scopes through `withResolvedScopes`, which recurses into nested object and array groups and is re-resolved as values change. They also gate on the context's `providedModel` (it reaches the layout one render after local state) and warm the SRD facts first (`warmFixtureAuthoredSources`), because the first resolve builds the SRD source projections.
- Review round: a nested group editor rendered empty whenever the root model had scopes but none for its row (a freshly added row before re-resolve, and `{}` object groups permanently, because the server emits scopes only for populated rows). `FormRenderer` now resolves a child's own model whenever its scope lookup is undefined (`renderChild` and the delegated renderer).
- Review round: one resolver source reader, `createNodeRuntimeSourceReader` in `packages/authoring`, replaces the near-identical readers in `apps/apis/convex/authoring/systemSources.ts` and the web test harness; `resolveNestedRuntimeScopes` is exported from `@artificer-toolkit/authoring/nodeRuntime` and `withResolvedScopes.ts` calls it instead of a copy.
- Review round: `authoredRouteStory.utils.ts` moved to `src/test` (it imports the real resolver); `FormArchitectureBoundaries` now fails if production code imports `#test/*`. The VTT_UI-5 compact transport is kept: the story client answers with `compactNodeRuntimeResponse(...)` of the real resolver output, and `authoredRouteStory.utils.test.ts` asserts it expands to that output for `creature` and `spell`.
- Finding (existing, not this slice): the speed option `description` is never served. The `speed` node map selects `['id','label','tooltip']`, the System speed rows carry `description`, and the shared reader projects only the selected columns, in the Convex reader before this slice as well. So the Walking Speed option has no description in production. The matcher asserts what the resolver serves; the fix (select `description`, or the vocabulary carries `tooltip`) belongs to whoever owns the speed map.
- Several `nodeRuntimeResolver.test.ts` and parity assertions are stronger than before: the class filter now uses `category === 'BASE'`; the old `'CLASS'` filter matched nothing and passed vacuously.

### Risks

- The Character Builder registration (`authoringSessionState.ts:215`, `resolveModel: false`, `providedModel: undefined`) now has no static fallback. I assumed the Builder supplies its own models; I did not verify this in a browser. Check the Builder first after merge.
- Two `src/routes` web suites cannot load in a worktree (Vite `fs.allow`); run them in the main checkout.
- First-resolve latency of the SRD facts build (seconds) in tests that do not call `warmFixtureAuthoredSources`.

### Follow-ups (outside this slice)

- Speed option descriptions are not served (see Deviations, finding): the `speed` node map selects `tooltip`, the System speeds carry `description`. Needs an owner; not fixed here because it changes a shared node map's served options.

The remaining ability-modifier copies (`effectActionCompiler.ts`, `characterResources.ts`) were folded into this slice in the review round and now call the shared `abilityModifier`.

## Proposed ledger edits (filled by the slice session)

- RELIABILITY-7.1: DONE once the stories above pass and the Builder opens (risk above). Evidence: `red-web-reliability-7` / `green-web-reliability-7-final`, `FormArchitectureBoundaries.test.ts`.
- RELIABILITY-7.2: DONE. Evidence: `sharedRulesParity.test.ts`, `green-schema-contract`, `character-rules-contracts.test.ts`.
- RELIABILITY-7: DONE after the main checkout's codegen, `typecheck:convex`, Convex hit point tests and the story run pass.
